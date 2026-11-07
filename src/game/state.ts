// The game state a screen draws: the capped log, the room, stats and the inventory
// text. A pure reducer; nothing here touches the socket or React.
import { RoomItem, RoomThing, ServerFrame, Stats } from '../net/frames';
import { Cosmetics } from '../cosmetics';
import { Entry, EntryBody, frameLines } from './entries';

// A long session must not grow the page without bound: the oldest lines go first.
export const MAX_LOG = 500;

export interface RoomInfo {
  name: string;
  exits: string[];
  locked: string[];
  things: RoomThing[];
  people: RoomThing[];
  items: RoomItem[];
}

export interface GameState {
  log: Entry[];
  nextId: number;
  room: RoomInfo | null;
  stats: Stats | null;
  // The text of the last INVENTORY reply, until the player closes it.
  inventory: string | null;
  // The latest announcement from the GM or an event, until it is dismissed or replaced.
  banner: { id: number; label: string; text: string } | null;
  // What this player owns and wears; null until the server says they own something.
  cosmetics: Cosmetics | null;
}

export type GameAction =
  | { type: 'frame'; frame: ServerFrame }
  // The server let us in. A fresh character (join, recover) starts clean; a resume
  // keeps the log, and a gap says that some of it is missing.
  | { type: 'welcome'; resumed: boolean; gap: boolean }
  | { type: 'echo'; line: string }
  | { type: 'notice'; message: string }
  | { type: 'closeInventory' }
  | { type: 'dismissBanner' };

export const initialGameState = (): GameState => ({ log: [], nextId: 1, room: null, stats: null, inventory: null, banner: null, cosmetics: null });

const GAP_TEXT = 'You were disconnected for a while. Some messages may have been missed.';

// append adds lines, numbering them and dropping the oldest beyond MAX_LOG.
function append(state: GameState, lines: EntryBody[]): GameState {
  if (lines.length === 0) return state;
  let id = state.nextId;
  const added = lines.map((body): Entry => ({ ...body, id: id++ }));
  const log = state.log.concat(added);
  return { ...state, log: log.length > MAX_LOG ? log.slice(log.length - MAX_LOG) : log, nextId: id };
}

export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'welcome': {
      const base = action.resumed ? state : { ...initialGameState(), nextId: state.nextId };
      return action.resumed && action.gap ? append(base, [{ kind: 'divider', text: GAP_TEXT }]) : base;
    }
    case 'echo':
      return append(state, [{ kind: 'echo', text: action.line }]);
    case 'notice':
      return append(state, [{ kind: 'notice', text: action.message }]);
    case 'dismissBanner':
      return state.banner === null ? state : { ...state, banner: null };
    case 'closeInventory':
      return state.inventory === null ? state : { ...state, inventory: null };
    case 'frame': {
      const f = action.frame;
      switch (f.t) {
        case 'stats':
          return { ...state, stats: f.stats };
        case 'room':
          return { ...state, room: { name: f.name, exits: f.exits, locked: f.locked, things: f.things, people: f.people, items: f.items } };
        case 'inventory':
          return { ...state, inventory: f.text };
        case 'cosmetics':
          return { ...state, cosmetics: { colors: f.colors, badges: f.badges, color: f.color, badge: f.badge } };
        case 'announce': {
          const lines = frameLines(f);
          const next = append(state, lines);
          return { ...next, banner: { id: state.nextId, label: lines[0].kind === 'announce' ? lines[0].label : 'GM', text: f.text } };
        }
        default:
          return append(state, frameLines(f));
      }
    }
  }
}
