// The wire format of the `mud.v1` protocol: every frame, both ways, is a flat JSON
// object with a type `t`. Server side: mud_server/src/internal/mudserver/protocol.go.
// The sequences that matter (counting, base, resume) are pinned by the server's
// recorded transcripts in testdata/transcripts.json.

export const SUBPROTOCOL = 'mud.v1';

export interface Stats {
  hp: number; maxhp: number;
  mp: number; maxmp: number;
  atk: number; atkbonus: number;
  def: number; defbonus: number;
}

export interface AuthFrame {
  t: 'auth';
  ok: boolean;
  code?: string;
  message: string;
  // Sent once, on join and on recover. Store the token; show the recovery code.
  token?: string;
  recovery?: string;
  // Resume and recover replies.
  resumed: boolean;
  gap: boolean;
  replayed: number;
  base?: number; // the client's frame count before any replayed frames; absent means 0
  retryMs?: number; // recovery_locked: how long until the name accepts codes again
}

export interface ErrorFrame {
  t: 'error';
  code: string;
  message: string;
  retryMs?: number; // rate_limited from the join limiter: when to try again
}

export type ServerFrame =
  | { t: 'hello'; message: string }
  | AuthFrame
  | ErrorFrame
  | { t: 'text'; text: string }
  | { t: 'say'; who: string; text: string }
  | { t: 'chat'; who: string; text: string; gm: boolean }
  | { t: 'announce'; text: string; from: 'gm' | 'event' }
  | { t: 'arrive'; who: string; from?: string }
  | { t: 'leave'; who: string; to?: string }
  | { t: 'whisper'; who: string; text: string; out: boolean }
  | { t: 'stats'; stats: Stats }
  | { t: 'room'; name: string; exits: string[]; locked: string[]; things: RoomThing[]; people: RoomThing[]; items: RoomItem[] }
  | { t: 'inventory'; text: string }
  // A type this client does not know (a later phase's frame). It still counts.
  | { t: 'unknown'; type: string };

// Every frame is counted except these. Count by the frame's type, not by whether
// this client understands it: the server counts every one it sends.
const NOT_COUNTED = new Set(['hello', 'auth', 'error']);

export const isCounted = (frame: ServerFrame): boolean => !NOT_COUNTED.has(frame.t === 'unknown' ? frame.type : frame.t);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const optStr = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
const optNum = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

// parseFrame decodes one server frame. It returns null only for something that is
// not a JSON object with a string type; an unfamiliar type is an `unknown` frame.
export function parseFrame(raw: unknown): ServerFrame | null {
  if (typeof raw !== 'string') return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(m) || typeof m.t !== 'string') return null;

  switch (m.t) {
    case 'hello':
      return { t: 'hello', message: str(m.message) };
    case 'auth':
      return {
        t: 'auth', ok: m.ok === true, code: optStr(m.code), message: str(m.message),
        token: optStr(m.token), recovery: optStr(m.recovery),
        resumed: m.resumed === true, gap: m.gap === true, replayed: num(m.replayed),
        base: optNum(m.base), retryMs: optNum(m.retry_ms),
      };
    case 'error':
      return { t: 'error', code: str(m.code), message: str(m.message), retryMs: optNum(m.retry_ms) };
    case 'text':
      return { t: 'text', text: str(m.text) };
    case 'say':
      return { t: 'say', who: str(m.who), text: str(m.text) };
    case 'arrive':
      return { t: 'arrive', who: str(m.who), from: optStr(m.from) };
    case 'chat':
      return { t: 'chat', who: str(m.who), text: str(m.text), gm: m.gm === true };
    case 'announce':
      return { t: 'announce', text: str(m.text), from: m.from === 'event' ? 'event' : 'gm' };
    case 'leave':
      return { t: 'leave', who: str(m.who), to: optStr(m.to) };
    case 'whisper':
      return { t: 'whisper', who: str(m.who), text: str(m.text), out: m.out === true };
    case 'stats':
      return {
        t: 'stats',
        stats: {
          hp: num(m.hp), maxhp: num(m.maxhp), mp: num(m.mp), maxmp: num(m.maxmp),
          atk: num(m.atk), atkbonus: num(m.atkbonus), def: num(m.def), defbonus: num(m.defbonus),
        },
      };
    case 'room':
      return {
        t: 'room', name: str(m.name),
        exits: strList(m.exits), locked: strList(m.locked),
        things: things(m.things), people: things(m.people), items: roomItems(m.items),
      };
    case 'inventory':
      return { t: 'inventory', text: str(m.text) };
    default:
      return { t: 'unknown', type: m.t };
  }
}

// Outgoing frames.
export const cmdFrame = (line: string): string => JSON.stringify({ t: 'cmd', line });
export const joinFrame = (name: string): string => JSON.stringify({ t: 'join', name });
// A password account (the GM) signs in with login; guests never do.
export const loginFrame = (name: string, password: string): string => JSON.stringify({ t: 'login', username: name, password });
export const recoverFrame = (name: string, code: string): string => JSON.stringify({ t: 'recover', name, code });
// received is how many counted frames this page has processed. Leave it out on a
// freshly loaded page: the server then treats it as remembering nothing.
export const resumeFrame = (token: string, received?: number): string =>
  JSON.stringify(received === undefined ? { t: 'resume', token } : { t: 'resume', token, received });

// What is here, as the structured room frame carries it. Every list may be missing (an older
// server, or nothing of that kind in the room), and one bad entry is skipped, not fatal.
export interface RoomThing {
  id: string;
  name: string;
  verbs: string[];
}
export interface RoomItem {
  name: string;
  qty: number;
}

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string') : []);

function things(v: unknown): RoomThing[] {
  if (!Array.isArray(v)) return [];
  const out: RoomThing[] = [];
  for (const e of v) {
    if (e && typeof e === 'object' && typeof (e as { name?: unknown }).name === 'string') {
      const m = e as { id?: unknown; name: string; verbs?: unknown };
      out.push({ id: typeof m.id === 'string' ? m.id : m.name, name: m.name, verbs: strList(m.verbs) });
    }
  }
  return out;
}

function roomItems(v: unknown): RoomItem[] {
  if (!Array.isArray(v)) return [];
  const out: RoomItem[] = [];
  for (const e of v) {
    if (e && typeof e === 'object' && typeof (e as { name?: unknown }).name === 'string') {
      const m = e as { name: string; qty?: unknown };
      out.push({ name: m.name, qty: typeof m.qty === 'number' ? m.qty : 1 });
    }
  }
  return out;
}
