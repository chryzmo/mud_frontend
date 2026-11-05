// The websocket protocol: every frame, both ways, is {"v":1,"t":type,"d":payload}.
// Server side and design: mud_server/src/internal/mudserver/protocol.go and
// mud_server/plans/json-protocol.md.
import * as MUDCONST from './utils/constants';
import { ChatMessage } from './types';
import { Stats } from './components/StatsBar';

export const PROTOCOL_VERSION = 1;

export type ServerMessage =
  | { t: 'text'; text: string; kind: string }
  | { t: 'auth'; ok: boolean; code?: string; message: string }
  | { t: 'stats'; stats: Stats }
  | { t: 'room'; name: string; exits: string[] }
  | { t: 'inventory'; text: string }
  | { t: 'error'; code: string; message: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

// parseServerMessage decodes one frame, or returns null for anything that
// isn't a v1 envelope of a type this client knows.
export function parseServerMessage(raw: string): ServerMessage | null {
  let env: unknown;
  try {
    env = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(env) || env.v !== PROTOCOL_VERSION || typeof env.t !== 'string') return null;
  const d = isObject(env.d) ? env.d : {};

  switch (env.t) {
    case 'text':
      return { t: 'text', text: str(d.text), kind: str(d.kind) || 'plain' };
    case 'auth':
      return { t: 'auth', ok: d.ok === true, code: str(d.code) || undefined, message: str(d.message) };
    case 'stats':
      return {
        t: 'stats',
        stats: {
          hp: num(d.hp), maxhp: num(d.maxhp),
          mp: num(d.mp), maxmp: num(d.maxmp),
          atk: num(d.atk), atkbonus: num(d.atkbonus),
          def: num(d.def), defbonus: num(d.defbonus),
        },
      };
    case 'room':
      return {
        t: 'room',
        name: str(d.name),
        exits: Array.isArray(d.exits) ? d.exits.filter((e): e is string => typeof e === 'string') : [],
      };
    case 'inventory':
      return { t: 'inventory', text: str(d.text) };
    case 'error':
      return { t: 'error', code: str(d.code), message: str(d.message) };
    default:
      return null;
  }
}

const frame = (t: string, d: unknown): string => JSON.stringify({ v: PROTOCOL_VERSION, t, d });

// sendCommand sends one in-game command line, e.g. "SAY hello".
export const sendCommand = (ws: WebSocket, line: string) => ws.send(frame('cmd', { line }));

export const sendLogin = (ws: WebSocket, username: string, password: string) =>
  ws.send(frame('login', { username, password }));

export const sendRegister = (ws: WebSocket, username: string, password: string) =>
  ws.send(frame('register', { username, password }));

// textToChat turns a block of game text into chat entries, one per line. Colour
// still arrives as ANSI escapes inside the text (a message can mix colours, so
// the message's `kind` alone isn't enough to style every line).
export function textToChat(text: string): ChatMessage[] {
  const { ESCAPE_START, ESCAPE_END, RED, BLUE, GREEN } = MUDCONST.MUDCOLOR;
  const out: ChatMessage[] = [];

  const colored = (line: string, color: string) => {
    const stripped = line.replace(ESCAPE_START + color, '').replace(ESCAPE_END, '');
    const name = stripped.split(' ')[0];
    return { name, rest: stripped.slice(name.length) };
  };

  for (const line of text.split('\n')) {
    if (line.startsWith(ESCAPE_START + RED)) {
      const { name, rest } = colored(line, RED);
      out.push({ type: 'combat', npcName: name, actionText: rest });
    } else if (line.startsWith(ESCAPE_START + BLUE)) {
      const { name, rest } = colored(line, BLUE);
      out.push({ type: 'player', playerName: name, actionText: rest });
    } else if (line.startsWith(ESCAPE_START + GREEN)) {
      const { name, rest } = colored(line, GREEN);
      out.push({ type: 'item', itemName: name, actionText: rest });
    } else if (line === '') {
      out.push({ type: 'spacer' });
    } else {
      out.push({ type: 'plain', text: line, bold: false });
    }
  }
  return out;
}
