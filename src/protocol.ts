// The websocket protocol: every frame, both ways, is {"v":1,"t":type,"d":payload}.
// Server side and design: mud_server/src/internal/mudserver/protocol.go and
// mud_server/plans/json-protocol.md.
import * as MUDCONST from './utils/constants';
import { ChatMessage } from './types';
import { Stats } from './components/StatsBar';

// The protocol version is the websocket subprotocol, checked once per connection.
export const SUBPROTOCOL = 'mud.v1';

export type ServerMessage =
  | { t: 'text'; text: string }
  | { t: 'say'; who: string; text: string }
  | { t: 'arrive'; who: string; from?: string }
  | { t: 'leave'; who: string; to?: string }
  | { t: 'whisper'; who: string; text: string; out: boolean }
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
// isn't a JSON object of a type this client knows.
export function parseServerMessage(raw: string): ServerMessage | null {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(m) || typeof m.t !== 'string') return null;

  switch (m.t) {
    case 'text':
      return { t: 'text', text: str(m.text) };
    case 'say':
      return { t: 'say', who: str(m.who), text: str(m.text) };
    case 'arrive':
      return { t: 'arrive', who: str(m.who), from: str(m.from) || undefined };
    case 'leave':
      return { t: 'leave', who: str(m.who), to: str(m.to) || undefined };
    case 'whisper':
      return { t: 'whisper', who: str(m.who), text: str(m.text), out: m.out === true };
    case 'auth':
      return { t: 'auth', ok: m.ok === true, code: str(m.code) || undefined, message: str(m.message) };
    case 'stats':
      return {
        t: 'stats',
        stats: {
          hp: num(m.hp), maxhp: num(m.maxhp),
          mp: num(m.mp), maxmp: num(m.maxmp),
          atk: num(m.atk), atkbonus: num(m.atkbonus),
          def: num(m.def), defbonus: num(m.defbonus),
        },
      };
    case 'room':
      return {
        t: 'room',
        name: str(m.name),
        exits: Array.isArray(m.exits) ? m.exits.filter((e): e is string => typeof e === 'string') : [],
      };
    case 'inventory':
      return { t: 'inventory', text: str(m.text) };
    case 'error':
      return { t: 'error', code: str(m.code), message: str(m.message) };
    default:
      return null;
  }
}

const frame = (t: string, fields: Record<string, string>): string => JSON.stringify({ t, ...fields });

// sendCommand sends one in-game command line, e.g. "SAY hello".
export const sendCommand = (ws: WebSocket, line: string) => ws.send(frame('cmd', { line }));

export const sendLogin = (ws: WebSocket, username: string, password: string) =>
  ws.send(frame('login', { username, password }));

export const sendRegister = (ws: WebSocket, username: string, password: string) =>
  ws.send(frame('register', { username, password }));

// eventToChat words and styles the room and whisper events. The server sends
// facts; the wording and colour live here.
export function eventToChat(msg: ServerMessage): ChatMessage[] {
  switch (msg.t) {
    case 'say':
      return [{ type: 'player', playerName: msg.who, actionText: ` says: "${msg.text}"` }];
    case 'arrive':
      return [{
        type: 'player', playerName: msg.who,
        actionText: msg.from ? ` has entered the room from the ${msg.from}.` : ' has appeared in the room.',
      }];
    case 'leave':
      return [{
        type: 'player', playerName: msg.who,
        actionText: msg.to ? ` has left to the ${msg.to}.` : ' has poofed away.',
      }];
    case 'whisper':
      return msg.out
        ? [{ type: 'whisper', text: `You whisper to ${msg.who}, "${msg.text}"` }]
        : [{ type: 'whisper', text: `${msg.who} whispers, "${msg.text}"` }];
    default:
      return [];
  }
}

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
