// The session state machine: owns the websocket, the frame count, resume and
// reconnect. It knows nothing about React. Rules come from the server's guest
// protocol (mud_server/plans/guest-sessions.md) and are pinned by the recorded
// transcripts in testdata/transcripts.json.
import {
  AuthFrame, ErrorFrame, ServerFrame, SUBPROTOCOL, cmdFrame, isCounted, joinFrame, loginFrame, parseFrame, recoverFrame, resumeFrame,
} from './frames';
import { Random, reconnectDelay, retryHintDelay, returnDelay } from './backoff';
import { SessionStore } from './storage';

export type Phase =
  | 'landing' // not connected; nothing stored, or waiting for the player to join or retry
  | 'joining'
  | 'recovering'
  | 'resuming'
  | 'online'
  | 'reconnecting' // the connection dropped; waiting to try again
  | 'ended'; // terminal: no automatic reconnect, the player must tap

// Why a session ended for good. idle, replaced and kicked keep the token (a tap resumes, and a
// kick is refused until its break is over); bad_token cleared it; bad_version needs a page reload.
export type EndReason = 'idle' | 'replaced' | 'bad_token' | 'bad_version' | 'kicked';

export type WaitReason = 'rate_limited' | 'at_capacity' | 'busy' | 'server_restarting' | 'connection_lost';

// A join or recover the server (or the network) refused. The Join screen shows it.
export interface Refusal {
  code: string; // invalid_name, name_taken, at_capacity, bad_recovery, recovery_locked, connection_lost, ...
  message: string;
  retryMs?: number;
}

export interface ConnState {
  phase: Phase;
  endReason?: EndReason;
  endMessage?: string; // the server's own words for why (a kick says for how long)
  attempt: number; // automatic reconnect attempts since the last time we were online
  retryAt?: number; // epoch ms of the next automatic attempt or resend
  waitReason?: WaitReason;
  refusal?: Refusal;
  offline: boolean; // the browser says the network is down
  persistent: boolean; // false: credentials live in memory only, a reload loses the character
  staff: boolean; // signed in with a password (the GM); reconnects sign in again from memory
}

export type ConnEvent =
  | { type: 'state'; state: ConnState }
  // The server let us in. recovery is set after join and recover: show it.
  | { type: 'welcome'; resumed: boolean; gap: boolean; replayed: number; message: string; recovery?: string }
  // A counted game frame. replayed: it is one the server held for us across a drop.
  | { type: 'frame'; frame: ServerFrame; replayed: boolean }
  // A server error that does not end the session (a slow-down notice, an unknown command).
  | { type: 'notice'; code: string; message: string };

export interface SocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export interface ConnectionOptions {
  url: string;
  store: SessionStore;
  createSocket?: (url: string, protocol: string) => SocketLike;
  random?: Random;
  now?: () => number;
}

type Request =
  | { kind: 'join'; name: string }
  | { kind: 'recover'; name: string; code: string }
  | { kind: 'login'; name: string; password: string; relogin: boolean } // staff; relogin: after a drop
  | { kind: 'resume' };

const OPEN = 1;
// Hidden for longer than this and the socket is probably dead: resume instead of trusting it.
export const STALE_AFTER_HIDDEN_MS = 10_000;
// A connect or request that gets no answer for this long is treated as a dropped
// connection. A phone on a weak signal can leave a socket "connecting" forever.
export const REPLY_TIMEOUT_MS = 15_000;

const defaultCreateSocket = (url: string, protocol: string): SocketLike =>
  new WebSocket(url, protocol) as unknown as SocketLike;

export function createConnection(opts: ConnectionOptions) {
  const { url, store } = opts;
  const createSocket = opts.createSocket ?? defaultCreateSocket;
  const random = opts.random ?? Math.random;
  const now = opts.now ?? Date.now;

  let state: ConnState = { phase: 'landing', attempt: 0, offline: false, persistent: store.persistent, staff: false };
  const listeners = new Set<(e: ConnEvent) => void>();

  let sock: SocketLike | null = null;
  let generation = 0; // handlers of a replaced socket are ignored
  let pending: Request | null = null; // sent, waiting for its auth reply
  let admitted = false;
  let count = 0; // counted frames processed on this page; only meaningful once haveCount
  let haveCount = false; // false on a freshly loaded page: resume without a count
  let replayLeft = 0;
  let afterRestart = false;
  // The staff password lives only in this variable, never in storage: a dropped connection signs in
  // again from it, a page reload asks for it again.
  let staffCreds: { name: string; password: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let replyTimer: ReturnType<typeof setTimeout> | null = null; // armed while waiting for a connect or an auth reply

  const emit = (e: ConnEvent) => listeners.forEach((l) => l(e));

  const setState = (patch: Partial<ConnState>) => {
    state = { ...state, ...patch, persistent: store.persistent };
    emit({ type: 'state', state });
  };

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const waitThen = (ms: number, fn: () => void) => {
    clearTimer();
    setState({ retryAt: now() + ms });
    timer = setTimeout(() => {
      timer = null;
      setState({ retryAt: undefined });
      fn();
    }, ms);
  };

  // dropSocket detaches and closes the current socket without any handler firing.
  const disarmReply = () => {
    if (replyTimer !== null) clearTimeout(replyTimer);
    replyTimer = null;
  };

  const armReply = () => {
    disarmReply();
    replyTimer = setTimeout(() => {
      replyTimer = null;
      dropSocket();
      handleClose();
    }, REPLY_TIMEOUT_MS);
  };

  const dropSocket = () => {
    disarmReply();
    const s = sock;
    sock = null;
    generation++;
    if (!s) return;
    s.onopen = s.onmessage = s.onclose = s.onerror = null;
    try {
      s.close();
    } catch {
      // already closed
    }
  };

  const sendPending = () => {
    if (!sock || !pending) return;
    if (pending.kind === 'join') sock.send(joinFrame(pending.name));
    else if (pending.kind === 'recover') sock.send(recoverFrame(pending.name, pending.code));
    else if (pending.kind === 'login') sock.send(loginFrame(pending.name, pending.password));
    else {
      const token = store.getToken();
      if (token) sock.send(resumeFrame(token, haveCount ? count : undefined));
    }
    armReply();
  };

  // request starts a join, recover or resume. A socket that is open and not yet
  // admitted (after a refusal) is reused: the server keeps it usable.
  const request = (req: Request) => {
    pending = req;
    admitted = false;
    if (sock && sock.readyState === OPEN) {
      sendPending();
      return;
    }
    dropSocket();
    const g = generation;
    const s = createSocket(url, SUBPROTOCOL);
    sock = s;
    armReply();
    s.onopen = () => {
      if (g === generation) sendPending();
    };
    s.onmessage = (ev) => {
      if (g === generation) handleMessage(ev.data);
    };
    s.onclose = () => {
      if (g === generation) handleClose();
    };
    s.onerror = () => {}; // a close always follows
  };

  const end = (reason: EndReason, message?: string) => {
    clearTimer();
    pending = null;
    admitted = false;
    dropSocket();
    setState({ phase: 'ended', endReason: reason, endMessage: message, retryAt: undefined, waitReason: undefined });
  };

  const scheduleReconnect = (why: WaitReason, immediate = false) => {
    admitted = false;
    pending = null;
    const attempt = state.attempt;
    const delay = immediate ? returnDelay(random) : reconnectDelay(attempt, random, afterRestart);
    afterRestart = false;
    setState({ phase: 'reconnecting', waitReason: why, attempt: immediate ? attempt : attempt + 1 });
    waitThen(delay, connectResume);
  };

  const connectResume = () => {
    if (staffCreds) {
      // A staff session has no token: sign in again with what the page remembers.
      setState({ phase: 'resuming' });
      request({ kind: 'login', ...staffCreds, relogin: true });
      return;
    }
    if (!store.getToken()) {
      setState({ phase: 'landing', waitReason: undefined });
      return;
    }
    setState({ phase: 'resuming' });
    request({ kind: 'resume' });
  };

  const handleClose = () => {
    disarmReply();
    sock = null;
    switch (state.phase) {
      case 'ended':
      case 'landing':
        return;
      case 'joining':
      case 'recovering':
        // We may have sent the join and lost the reply; there is nothing to resume.
        staffCreds = null;
        pending = null;
        admitted = false;
        clearTimer();
        setState({
          phase: 'landing', retryAt: undefined, waitReason: undefined,
          refusal: { code: 'connection_lost', message: 'The connection was lost. Please try again.' },
        });
        return;
      default:
        scheduleReconnect(afterRestart ? 'server_restarting' : 'connection_lost');
    }
  };

  const admit = (f: AuthFrame) => {
    disarmReply();
    const req = pending;
    pending = null;
    if (!req) return;
    admitted = true;
    haveCount = true;
    count = f.base ?? 0; // the count before any replayed frames; they are counted as they arrive
    replayLeft = f.replayed;
    clearTimer();
    if ((req.kind === 'join' || req.kind === 'recover') && f.token) {
      store.saveSession(f.token, req.name);
      if (f.recovery) store.saveRecovery(f.recovery);
    }
    const relogin = req.kind === 'login' && req.relogin; // a password account has no replay: what came meanwhile is lost
    setState({
      phase: 'online', attempt: 0, retryAt: undefined, waitReason: undefined, refusal: undefined, endReason: undefined,
      endMessage: undefined, staff: req.kind === 'login',
    });
    emit({
      type: 'welcome', resumed: relogin || f.resumed, gap: relogin || f.gap, replayed: f.replayed, message: f.message,
      recovery: req.kind === 'join' || req.kind === 'recover' ? f.recovery : undefined,
    });
  };

  const refuse = (f: AuthFrame) => {
    disarmReply();
    const req = pending;
    if (!req) return;
    const code = f.code ?? 'failed';
    const relogin = req.kind === 'login' && req.relogin;
    if (req.kind === 'resume' || relogin) {
      if (code === 'kicked') {
        end('kicked', f.message); // on a break: stop, keep the token, a tap asks again
        return;
      }
      if (req.kind === 'resume' && code === 'bad_token') {
        store.clearToken();
        end('bad_token');
        return;
      }
      if (relogin && (code === 'bad_password' || code === 'unknown_user')) {
        // The credentials no longer work (changed on the host): back to the sign-in form.
        staffCreds = null;
        pending = null;
        dropSocket();
        setState({ phase: 'landing', staff: false, waitReason: undefined, refusal: { code, message: f.message } });
        return;
      }
      // Capacity, a busy character (the old session is still being cleared), an internal error: try again later.
      dropSocket();
      scheduleReconnect(code === 'at_capacity' ? 'at_capacity' : 'busy');
      return;
    }
    if (req.kind === 'login') staffCreds = null;
    pending = null;
    setState({
      phase: 'landing', waitReason: undefined,
      refusal: { code, message: f.message, retryMs: f.retryMs },
    });
  };

  const handleError = (f: ErrorFrame) => {
    switch (f.code) {
      case 'idle':
        return end('idle');
      case 'replaced':
        return end('replaced');
      case 'bad_version':
        return end('bad_version');
      case 'kicked':
        return end('kicked', f.message);
      case 'restarting':
        afterRestart = true; // the close follows; come back with the wide jitter
        return;
      case 'rate_limited':
        if (f.retryMs !== undefined && pending) {
          // The join limit: wait exactly as told, then ask again on the same socket.
          disarmReply(); // the wait is the server's instruction, not a silent connection
          setState({ waitReason: 'rate_limited' });
          waitThen(retryHintDelay(f.retryMs, random), () => {
            setState({ waitReason: undefined });
            sendPending();
          });
          return;
        }
        break; // the per-command limiter: only a notice
    }
    emit({ type: 'notice', code: f.code, message: f.message });
  };

  const handleMessage = (data: unknown) => {
    const f = parseFrame(data);
    if (!f) return;
    switch (f.t) {
      case 'hello':
        return;
      case 'auth':
        return f.ok ? admit(f) : refuse(f);
      case 'error':
        return handleError(f);
    }
    if (!admitted) return;
    if (isCounted(f)) count++;
    const replayed = replayLeft > 0;
    if (replayed) replayLeft--;
    emit({ type: 'frame', frame: f, replayed });
  };

  // closeAndResume replaces a socket we no longer trust, soon, with a little jitter.
  const closeAndResume = () => {
    dropSocket();
    scheduleReconnect('connection_lost', true);
  };

  return {
    getState: () => state,
    frameCount: () => count,
    subscribe(listener: (e: ConnEvent) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // start runs once when the page loads: resume if a character is stored. A fresh
    // page has no frame count, so the server gives it a gap and a fresh look.
    start() {
      if (store.getToken()) {
        haveCount = false;
        setState({ phase: 'resuming' });
        request({ kind: 'resume' });
      }
    },

    // login is the staff sign-in (the GM, at /staff). The password stays in memory so that a dropped
    // connection can sign in again by itself; it is never stored.
    login(name: string, password: string) {
      if (admitted) return;
      staffCreds = { name, password };
      setState({ phase: 'joining', refusal: undefined, waitReason: undefined });
      request({ kind: 'login', name, password, relogin: false });
    },

    join(name: string) {
      if (admitted) return;
      setState({ phase: 'joining', refusal: undefined, waitReason: undefined });
      request({ kind: 'join', name });
    },

    recover(name: string, code: string) {
      if (admitted) return;
      setState({ phase: 'recovering', refusal: undefined, waitReason: undefined });
      request({ kind: 'recover', name, code });
    },

    // resume is the tap after `idle` or `replaced` (and a manual retry): get the character back.
    resume() {
      if (admitted || !store.getToken()) return;
      clearTimer();
      setState({ phase: 'resuming', endReason: undefined, waitReason: undefined, retryAt: undefined });
      request({ kind: 'resume' });
    },

    // retryNow is the player's "try again now" while the game is reconnecting: skip the wait,
    // or give up on an attempt that is taking too long, and connect again straight away.
    retryNow() {
      if (state.phase !== 'reconnecting' && state.phase !== 'resuming') return;
      clearTimer();
      dropSocket();
      setState({ retryAt: undefined });
      connectResume();
    },

    sendCommand(line: string): boolean {
      if (!admitted || !sock || sock.readyState !== OPEN) return false;
      sock.send(cmdFrame(line));
      return true;
    },

    acknowledgeRecovery: () => store.acknowledgeRecovery(),

    // The page came back to the foreground after hiddenMs. A phone that was asleep
    // has usually lost its socket without being told.
    pageVisible(hiddenMs: number) {
      if (state.phase === 'online' && hiddenMs > STALE_AFTER_HIDDEN_MS) closeAndResume();
      else if (state.phase === 'reconnecting') scheduleReconnect(state.waitReason ?? 'connection_lost', true);
    },

    networkOnline() {
      if (state.offline) setState({ offline: false });
      if (state.phase === 'online') closeAndResume();
      else if (state.phase === 'reconnecting') scheduleReconnect(state.waitReason ?? 'connection_lost', true);
    },

    networkOffline() {
      setState({ offline: true });
    },

    dispose() {
      staffCreds = null;
      clearTimer();
      pending = null;
      dropSocket();
      listeners.clear();
    },
  };
}

export type Connection = ReturnType<typeof createConnection>;

// attachBrowserSignals feeds the connection the page-visibility and network events.
export function attachBrowserSignals(
  conn: Connection,
  win: Window = window,
  doc: Document = document,
  now: () => number = Date.now,
): () => void {
  let hiddenAt: number | null = null;
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') {
      hiddenAt = now();
    } else {
      conn.pageVisible(hiddenAt === null ? 0 : now() - hiddenAt);
      hiddenAt = null;
    }
  };
  const onPageShow = (e: Event) => {
    // Restored from the back/forward cache: whatever socket it had is gone.
    if ((e as PageTransitionEvent).persisted) conn.pageVisible(Number.POSITIVE_INFINITY);
  };
  const onOnline = () => conn.networkOnline();
  const onOffline = () => conn.networkOffline();
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pageshow', onPageShow);
  win.addEventListener('online', onOnline);
  win.addEventListener('offline', onOffline);
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('pageshow', onPageShow);
    win.removeEventListener('online', onOnline);
    win.removeEventListener('offline', onOffline);
  };
}
