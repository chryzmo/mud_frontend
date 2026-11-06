import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Connection, ConnEvent, REPLY_TIMEOUT_MS, STALE_AFTER_HIDDEN_MS, attachBrowserSignals, createConnection } from './connection';
import { KV, createSessionStore } from './storage';
import { FakeSocket, MemoryKV, ThrowingKV } from './testSupport';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(options: { random?: () => number; kv?: KV } = {}) {
  const sockets: FakeSocket[] = [];
  const kv = options.kv ?? new MemoryKV();
  const events: ConnEvent[] = [];
  const conn = createConnection({
    url: 'ws://test/ws',
    store: createSessionStore(kv),
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    random: options.random ?? (() => 0),
  });
  conn.subscribe((e) => events.push(e));
  const last = () => sockets[sockets.length - 1];
  const sent = (s: FakeSocket) => s.sentFrames();
  return { conn, sockets, kv, events, last, sent };
}
type H = ReturnType<typeof setup>;

const GAME_START = [
  { t: 'text', text: 'You are in a room' },
  { t: 'room', name: 'Start Room', exits: ['N'] },
  { t: 'stats', hp: 20, maxhp: 20, mp: 10, maxmp: 10, atk: 5, atkbonus: 0, def: 10, defbonus: 0 },
];

// joinOnline joins as Alice and plays the three frames that follow admission (count 3).
function joinOnline(h: H, token = 'T1', recovery = 'R1') {
  h.conn.join('Alice');
  const s = h.last();
  s.open();
  s.deliver({ t: 'hello', message: 'Welcome' });
  s.deliver({ t: 'auth', ok: true, message: 'Welcome, Alice!', token, recovery });
  GAME_START.forEach((f) => s.deliver(f));
  return s;
}

const delayOf = (h: H) => h.conn.getState().retryAt! - Date.now();

describe('frame counting', () => {
  it('counts every frame but hello, auth and error, including types it does not know', () => {
    const h = setup();
    const s = joinOnline(h);
    expect(h.conn.frameCount()).toBe(3);
    s.deliver({ t: 'global_chat', who: 'gm', text: 'hello all' }); // a later phase's frame
    s.deliver({ t: 'error', code: 'unknown_command', message: 'What?' });
    s.deliver({ t: 'hello', message: 'again' });
    s.deliver({ t: 'say', who: 'Bob', text: 'hi' });
    expect(h.conn.frameCount()).toBe(5);

    s.drop();
    vi.advanceTimersByTime(0);
    h.last().open();
    expect(h.sent(h.last())[0]).toEqual({ t: 'resume', token: 'T1', received: 5 });
  });

  it('ignores game frames that arrive before admission', () => {
    const h = setup();
    h.conn.join('Alice');
    h.last().open();
    h.last().deliver({ t: 'text', text: 'stray' });
    expect(h.conn.frameCount()).toBe(0);
  });

  it('marks replayed frames, counts them after base, and then the live ones', () => {
    const h = setup();
    const s = joinOnline(h);
    s.drop();
    vi.advanceTimersByTime(0);
    const s2 = h.last();
    s2.open();
    s2.deliver({ t: 'auth', ok: true, message: 'back', resumed: true, replayed: 2, base: 3 });
    s2.deliver({ t: 'say', who: 'Bob', text: 'one' });
    s2.deliver({ t: 'say', who: 'Bob', text: 'two' });
    s2.deliver({ t: 'say', who: 'Bob', text: 'live' });
    const frames = h.events.filter((e): e is Extract<ConnEvent, { type: 'frame' }> => e.type === 'frame').slice(3);
    expect(frames.map((e) => e.replayed)).toEqual([true, true, false]);
    expect(h.conn.frameCount()).toBe(6);
  });
});

describe('starting up', () => {
  it('does nothing without a stored character', () => {
    const h = setup();
    h.conn.start();
    expect(h.sockets).toHaveLength(0);
    expect(h.conn.getState().phase).toBe('landing');
  });

  it('resumes a stored character without a frame count: a freshly loaded page remembers nothing', () => {
    const kv = new MemoryKV();
    createSessionStore(kv).saveSession('T9', 'Alice');
    const h = setup({ kv });
    h.conn.start();
    h.last().open();
    expect(h.sent(h.last())).toEqual([{ t: 'resume', token: 'T9' }]);
    expect(h.conn.getState().phase).toBe('resuming');
  });

  it('keeps the token and name, and the recovery code until it is acknowledged', () => {
    const h = setup();
    joinOnline(h);
    const reloaded = createSessionStore(h.kv);
    expect(reloaded.getToken()).toBe('T1');
    expect(reloaded.getName()).toBe('Alice');
    expect(reloaded.getPendingRecovery()).toBe('R1');
    h.conn.acknowledgeRecovery();
    expect(createSessionStore(h.kv).getPendingRecovery()).toBeNull();
  });

  it('works with storage that refuses everything, and says the character will not survive a reload', () => {
    const h = setup({ kv: new ThrowingKV() });
    const s = joinOnline(h);
    expect(h.conn.getState()).toMatchObject({ phase: 'online', persistent: false });
    s.drop();
    vi.advanceTimersByTime(0);
    h.last().open();
    expect(h.sent(h.last())[0]).toMatchObject({ t: 'resume', token: 'T1' }); // the token lives in memory
  });

  it('a connection lost before the join reply goes back to the join screen, without retrying', () => {
    const h = setup();
    h.conn.join('Alice');
    h.last().open();
    h.last().drop();
    expect(h.conn.getState()).toMatchObject({ phase: 'landing', refusal: { code: 'connection_lost' } });
    vi.advanceTimersByTime(120_000);
    expect(h.sockets).toHaveLength(1);
  });
});

describe('joining', () => {
  it('shows the server refusal and lets the player try again on the same connection', () => {
    const h = setup();
    h.conn.join('a');
    const s = h.last();
    s.open();
    s.deliver({ t: 'auth', ok: false, code: 'invalid_name', message: 'Names need at least 3 characters.' });
    expect(h.conn.getState()).toMatchObject({ phase: 'landing', refusal: { code: 'invalid_name', message: 'Names need at least 3 characters.' } });
    h.conn.join('Alice');
    expect(h.sockets).toHaveLength(1);
    expect(h.sent(s).map((f) => f.name)).toEqual(['a', 'Alice']);
    expect(h.conn.getState().refusal).toBeUndefined();
  });

  it('at capacity on a join is a refusal to show, not a retry loop', () => {
    const h = setup();
    h.conn.join('Alice');
    h.last().open();
    h.last().deliver({ t: 'auth', ok: false, code: 'at_capacity', message: 'The event is at capacity.' });
    expect(h.conn.getState()).toMatchObject({ phase: 'landing', refusal: { code: 'at_capacity' } });
    vi.advanceTimersByTime(60_000);
    expect(h.sockets).toHaveLength(1);
  });

  it('shows how long a locked name must wait', () => {
    const h = setup();
    h.conn.recover('Alice', 'code');
    h.last().open();
    h.last().deliver({ t: 'auth', ok: false, code: 'recovery_locked', message: 'Try again in 15 minutes.', retry_ms: 900000 });
    expect(h.conn.getState().refusal).toMatchObject({ code: 'recovery_locked', retryMs: 900000 });
  });
});

describe('waiting as the server asks', () => {
  it('waits exactly retry_ms (plus jitter) on a rate-limited join, every time, never longer', () => {
    const h = setup({ random: () => 0.5 });
    h.conn.join('Alice');
    const s = h.last();
    s.open();
    for (let round = 1; round <= 3; round++) {
      s.deliver({ t: 'error', code: 'rate_limited', message: 'busy', retry_ms: 1200 });
      expect(delayOf(h)).toBe(1200 + 250); // the hint plus half of the 500 ms jitter, not doubled
      expect(h.conn.getState().waitReason).toBe('rate_limited');
      vi.advanceTimersByTime(1449);
      expect(s.sent).toHaveLength(round); // not yet
      vi.advanceTimersByTime(1);
      expect(s.sent).toHaveLength(round + 1);
    }
    expect(h.sockets).toHaveLength(1);
  });

  it('treats rate_limited without retry_ms as a notice, not a reason to wait or reconnect', () => {
    const h = setup();
    const s = joinOnline(h);
    s.deliver({ t: 'error', code: 'rate_limited', message: 'Slow down. Too many commands.' });
    expect(h.conn.getState()).toMatchObject({ phase: 'online', retryAt: undefined, waitReason: undefined });
    expect(h.events[h.events.length - 1]).toEqual({ type: 'notice', code: 'rate_limited', message: 'Slow down. Too many commands.' });
  });

  it('retries when a resume finds the server at capacity or the character busy', () => {
    for (const [code, reason] of [['at_capacity', 'at_capacity'], ['failed', 'busy']] as const) {
      const h = setup();
      const s = joinOnline(h);
      s.drop();
      vi.advanceTimersByTime(0);
      h.last().open();
      h.last().deliver({ t: 'auth', ok: false, code, message: 'try later' });
      expect(h.conn.getState()).toMatchObject({ phase: 'reconnecting', waitReason: reason });
      vi.advanceTimersByTime(60_000);
      expect(h.sockets.length).toBeGreaterThan(2);
    }
  });
});

describe('reconnecting', () => {
  it('backs off exponentially to a cap while the server is unreachable, then resets once online', () => {
    const h = setup();
    const s = joinOnline(h);
    s.drop();
    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      waits.push(delayOf(h));
      vi.advanceTimersByTime(delayOf(h));
      h.last().drop(); // never even opens
    }
    expect(waits).toEqual([0, 1000, 2000, 4000, 8000, 10000, 10000]);

    vi.advanceTimersByTime(delayOf(h));
    h.last().open();
    h.last().deliver({ t: 'auth', ok: true, message: 'back', resumed: true });
    expect(h.conn.getState()).toMatchObject({ phase: 'online', attempt: 0 });
    h.last().drop();
    expect(delayOf(h)).toBe(0); // the next drop starts from the short first retry again
  });

  it('comes back within a second after a single drop, and with the wide jitter after a restart notice', () => {
    const quick = setup({ random: () => 0.999 });
    joinOnline(quick).drop();
    expect(delayOf(quick)).toBeLessThan(1000);

    const restart = setup({ random: () => 0.999 });
    const s = joinOnline(restart);
    s.deliver({ t: 'error', code: 'restarting', message: 'The server is restarting.' });
    s.drop();
    expect(delayOf(restart)).toBeGreaterThan(4900);
    expect(delayOf(restart)).toBeLessThan(5000);
    expect(restart.conn.getState().waitReason).toBe('server_restarting');
  });

  it('does not reconnect after idle, replaced or bad_version, and a tap resumes with the count it had', () => {
    for (const code of ['idle', 'replaced', 'bad_version'] as const) {
      const h = setup();
      const s = joinOnline(h);
      s.deliver({ t: 'error', code, message: 'x' });
      s.drop();
      expect(h.conn.getState()).toMatchObject({ phase: 'ended', endReason: code });
      vi.advanceTimersByTime(10 * 60_000);
      expect(h.sockets).toHaveLength(1);
      if (code === 'bad_version') continue;
      h.conn.resume();
      h.last().open();
      expect(h.sent(h.last())[0]).toEqual({ t: 'resume', token: 'T1', received: 3 });
    }
  });

  it('on bad_token forgets the token, keeps the name, stops, and can recover with the code', () => {
    const kv = new MemoryKV();
    createSessionStore(kv).saveSession('STALE', 'Alice');
    const h = setup({ kv });
    h.conn.start();
    h.last().open();
    h.last().deliver({ t: 'auth', ok: false, code: 'bad_token', message: "That resume token isn't valid." });
    expect(h.conn.getState()).toMatchObject({ phase: 'ended', endReason: 'bad_token' });
    expect(createSessionStore(kv).getToken()).toBeNull();
    expect(createSessionStore(kv).getName()).toBe('Alice');
    vi.advanceTimersByTime(10 * 60_000);
    expect(h.sockets).toHaveLength(1);

    h.conn.recover('Alice', 'abcd-efgh-jklm');
    const s = h.last();
    s.open();
    expect(h.sent(s)).toEqual([{ t: 'recover', name: 'Alice', code: 'abcd-efgh-jklm' }]);
    s.deliver({ t: 'auth', ok: true, message: 'Welcome back', resumed: true, gap: true, token: 'T2', recovery: 'R2' });
    expect(h.conn.getState().phase).toBe('online');
    const reloaded = createSessionStore(kv);
    expect([reloaded.getToken(), reloaded.getPendingRecovery()]).toEqual(['T2', 'R2']);
    expect(h.events.find((e) => e.type === 'welcome' && e.recovery === 'R2')).toBeTruthy();
  });

  it('a resume that works shows a gap and no recovery code', () => {
    const h = setup();
    const s = joinOnline(h);
    s.drop();
    vi.advanceTimersByTime(0);
    h.last().open();
    h.last().deliver({ t: 'auth', ok: true, message: 'back', resumed: true, gap: true, base: 0 });
    const welcomes = h.events.filter((e) => e.type === 'welcome');
    const welcome = welcomes[welcomes.length - 1];
    expect(welcome).toMatchObject({ resumed: true, gap: true, recovery: undefined });
  });
});

describe('page visibility and the network', () => {
  it('leaves a recently hidden page alone, but replaces the socket of one that was away a while', () => {
    const h = setup();
    const s = joinOnline(h);
    h.conn.pageVisible(STALE_AFTER_HIDDEN_MS - 1);
    expect(h.conn.getState().phase).toBe('online');
    expect(s.closedByClient).toBe(false);

    h.conn.pageVisible(STALE_AFTER_HIDDEN_MS + 1);
    expect(s.closedByClient).toBe(true);
    expect(h.conn.getState()).toMatchObject({ phase: 'reconnecting' });
    vi.advanceTimersByTime(1000);
    h.last().open();
    expect(h.sent(h.last())[0]).toEqual({ t: 'resume', token: 'T1', received: 3 }); // gap-free: the count is kept
  });

  it('cuts a long backoff short when the page returns or the network comes back', () => {
    const h = setup({ random: () => 0.5 });
    const s = joinOnline(h);
    s.drop();
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(delayOf(h));
      h.last().drop();
    }
    expect(delayOf(h)).toBeGreaterThan(8000);
    h.conn.pageVisible(0);
    expect(delayOf(h)).toBe(500);

    h.conn.networkOnline();
    expect(delayOf(h)).toBe(500);
    vi.advanceTimersByTime(500);
    expect(h.conn.getState().phase).toBe('resuming');
  });

  it('replaces the socket when the network comes back while it believes it is online', () => {
    const h = setup();
    const s = joinOnline(h);
    h.conn.networkOffline();
    expect(h.conn.getState().offline).toBe(true);
    h.conn.networkOnline();
    expect(h.conn.getState().offline).toBe(false);
    expect(s.closedByClient).toBe(true);
    expect(h.conn.getState().phase).toBe('reconnecting');
  });

  it('does nothing once the session has ended or before it began', () => {
    const h = setup();
    h.conn.pageVisible(60_000);
    h.conn.networkOnline();
    expect(h.sockets).toHaveLength(0);
    const s = joinOnline(h);
    s.deliver({ t: 'error', code: 'idle', message: 'away' });
    h.conn.pageVisible(60_000);
    h.conn.networkOnline();
    vi.advanceTimersByTime(60_000);
    expect(h.sockets).toHaveLength(1);
    expect(h.conn.getState().phase).toBe('ended');
  });
});

describe('sending commands', () => {
  it('sends only while online', () => {
    const h = setup();
    expect(h.conn.sendCommand('LOOK')).toBe(false);
    const s = joinOnline(h);
    expect(h.conn.sendCommand('LOOK')).toBe(true);
    const frames = h.sent(s);
    expect(frames[frames.length - 1]).toEqual({ t: 'cmd', line: 'LOOK' });
    s.drop();
    expect(h.conn.sendCommand('LOOK')).toBe(false);
  });
});

describe('attachBrowserSignals', () => {
  const fakeConn = () =>
    ({ pageVisible: vi.fn(), networkOnline: vi.fn(), networkOffline: vi.fn() }) as unknown as Connection &
      Record<'pageVisible' | 'networkOnline' | 'networkOffline', ReturnType<typeof vi.fn>>;

  const setVisibility = (state: 'hidden' | 'visible') =>
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });

  afterEach(() => setVisibility('visible'));

  it('tells the connection how long the page was hidden, and about the network', () => {
    const conn = fakeConn();
    let t = 1000;
    const detach = attachBrowserSignals(conn, window, document, () => t);

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    t = 31_000;
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(conn.pageVisible).toHaveBeenCalledWith(30_000);

    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('offline'));
    expect(conn.networkOnline).toHaveBeenCalledTimes(1);
    expect(conn.networkOffline).toHaveBeenCalledTimes(1);

    const restored = new Event('pageshow') as Event & { persisted: boolean };
    restored.persisted = true;
    window.dispatchEvent(restored);
    expect(conn.pageVisible).toHaveBeenLastCalledWith(Number.POSITIVE_INFINITY);

    detach();
    window.dispatchEvent(new Event('online'));
    expect(conn.networkOnline).toHaveBeenCalledTimes(1);
  });
});

describe('a connection that never answers', () => {
  it('gives up on a resume whose socket never opens, and tries a fresh socket', () => {
    const h = setup();
    joinOnline(h).drop();
    vi.advanceTimersByTime(delayOf(h));
    expect(h.sockets).toHaveLength(2); // connecting, and it stays that way: no open, no close
    expect(h.conn.getState().phase).toBe('resuming');

    vi.advanceTimersByTime(REPLY_TIMEOUT_MS);
    expect(h.sockets[1].closedByClient).toBe(true);
    expect(h.conn.getState()).toMatchObject({ phase: 'reconnecting', waitReason: 'connection_lost' });
    vi.advanceTimersByTime(delayOf(h));
    expect(h.sockets).toHaveLength(3);
  });

  it('gives up on a resume that opens but is never answered', () => {
    const h = setup();
    joinOnline(h).drop();
    vi.advanceTimersByTime(delayOf(h));
    h.last().open();
    vi.advanceTimersByTime(REPLY_TIMEOUT_MS);
    expect(h.conn.getState().phase).toBe('reconnecting');
  });

  it('sends a hanging join back to the join screen', () => {
    const h = setup();
    h.conn.join('Alice');
    vi.advanceTimersByTime(REPLY_TIMEOUT_MS);
    expect(h.conn.getState()).toMatchObject({ phase: 'landing', refusal: { code: 'connection_lost' } });
  });

  it('does not time out a reply that arrives, or a wait the server asked for', () => {
    const h = setup();
    h.conn.join('Alice');
    h.last().open();
    vi.advanceTimersByTime(REPLY_TIMEOUT_MS - 1);
    h.last().deliver({ t: 'error', code: 'rate_limited', message: 'Busy.', retry_ms: 60_000 });
    vi.advanceTimersByTime(40_000); // longer than the timeout, shorter than the server's wait
    expect(h.conn.getState()).toMatchObject({ phase: 'joining', waitReason: 'rate_limited' });
    expect(h.sockets).toHaveLength(1);

    vi.advanceTimersByTime(30_000); // the join is sent again, and now it is answered
    h.last().deliver({ t: 'auth', ok: true, message: 'Welcome', token: 'T', recovery: 'R' });
    vi.advanceTimersByTime(10 * 60_000);
    expect(h.conn.getState().phase).toBe('online');
    expect(h.sockets).toHaveLength(1);
  });
});

describe('retryNow', () => {
  it('connects again straight away instead of waiting out the backoff', () => {
    const h = setup();
    joinOnline(h).drop();
    vi.advanceTimersByTime(delayOf(h));
    h.last().drop(); // the second attempt fails too, so the next wait is a second or more
    expect(h.conn.getState().phase).toBe('reconnecting');
    const before = h.sockets.length;

    h.conn.retryNow();
    expect(h.sockets).toHaveLength(before + 1);
    expect(h.conn.getState()).toMatchObject({ phase: 'resuming', retryAt: undefined });
    h.last().open();
    h.last().deliver({ t: 'auth', ok: true, message: 'back', resumed: true });
    expect(h.conn.getState().phase).toBe('online');
  });

  it('abandons an attempt that is hanging and starts a fresh one', () => {
    const h = setup();
    joinOnline(h).drop();
    vi.advanceTimersByTime(delayOf(h)); // connecting, never opens
    const hung = h.last();
    h.conn.retryNow();
    expect(hung.closedByClient).toBe(true);
    expect(h.last()).not.toBe(hung);
  });

  it('does nothing when the game is online or the session has ended', () => {
    const h = setup();
    const s = joinOnline(h);
    h.conn.retryNow();
    expect(h.sockets).toHaveLength(1);
    s.deliver({ t: 'error', code: 'idle', message: 'Idle.' });
    h.conn.retryNow();
    expect(h.sockets).toHaveLength(1);
    expect(h.conn.getState()).toMatchObject({ phase: 'ended', endReason: 'idle' });
  });
});
