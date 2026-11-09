// How server frames become lines in the log. The server sends facts; the wording
// and colour live here. Colour still arrives as ANSI escapes inside `text` frames
// (a message can mix colours), so this module reads them.
import { ServerFrame } from '../net/frames';
import { MUDCOLOR } from '../utils/constants';

export type EntryBody =
  | { kind: 'plain'; text: string }
  | { kind: 'spacer' }
  | { kind: 'italic'; text: string } // a line the server wrapped in the italic escape (XP gains)
  | { kind: 'combat'; npcName: string; actionText: string }
  | { kind: 'player'; playerName: string; actionText: string; speech?: string; color?: string; badge?: string } // speech: the quoted words of a SAY, shown in their own colour
  | { kind: 'item'; itemName: string; actionText: string }
  | { kind: 'mixed'; parts: { text: string; tone?: Tone }[] } // a line with colour in the middle, or all of it
  | { kind: 'whisper'; text: string }
  | { kind: 'chat'; who: string; text: string; gm: boolean; color?: string; badge?: string } // global chat
  | { kind: 'announce'; label: string; text: string }
  | { kind: 'echo'; text: string } // a command the player sent
  | { kind: 'notice'; text: string } // from the client: a slow-down, an unknown command
  | { kind: 'divider'; text: string }; // the client's own marker, e.g. messages may have been missed

// A log line. `id` is unique and increasing, so it is a stable React key even
// after the oldest lines have been dropped from the front.
export type Entry = EntryBody & { id: number };

// The colour of a piece of a line. npc, player and item are names (red, blue, green); speechme and speechnpc are
// spoken words (teal for what you said, violet for what a character in the world says); feature is a piece of
// scenery named in a line ("You notice: ..."), which a tap examines; topic is something to ask a character about, which a tap asks (the character is the red name
// earlier in the same line).
export type Tone = 'npc' | 'player' | 'item' | 'speechme' | 'speechnpc' | 'feature' | 'topic';

const TONES: Record<string, Tone> = { '31m': 'npc', '34m': 'player', '32m': 'item', '36m': 'speechme', '35m': 'speechnpc', '33m': 'feature', '37m': 'topic' };

// colourParts splits a line at its colour escapes ("You learn <green>Mend</green>.") into parts. An escape of a
// colour the client does not use is dropped, its text left plain.
function colourParts(line: string): { text: string; tone?: Tone }[] {
  const parts: { text: string; tone?: Tone }[] = [];
  const re = /\x1b\[1;(\d+m)([^\x1b]*)\x1b\[0m/g;
  let at = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > at) parts.push({ text: line.slice(at, m.index) });
    parts.push({ text: m[2], tone: TONES[m[1]] });
    at = m.index + m[0].length;
  }
  if (at < line.length) parts.push({ text: line.slice(at) });
  return parts;
}

const ITALIC_START = '\x1b[3m';
// The name colour and badge a server line attaches to a player's name: ESC ] look ; colour ; badge BEL (each may be empty).
const LOOK = /^\x1b\]look;([a-z]*);([a-z]*)\x07/;

// textLines turns a block of game text into entries, one per line.
export function textLines(text: string): EntryBody[] {
  const { ESCAPE_START, ESCAPE_END, RED, BLUE, GREEN } = MUDCOLOR;
  const out: EntryBody[] = [];

  // The name is what the colour covers, so a name of several words ("Grak the Unbroken") is tapped whole; an
  // unclosed colour falls back to its first word.
  const colored = (line: string, color: string) => {
    const open = ESCAPE_START + color;
    const close = line.indexOf(ESCAPE_END, open.length);
    if (close > 0) return { name: line.slice(open.length, close), rest: line.slice(close + ESCAPE_END.length) };
    const stripped = line.replace(open, '');
    const name = stripped.split(' ')[0];
    return { name, rest: stripped.slice(name.length) };
  };

  for (const line of text.split('\n')) {
    // A whole line in italics: ESC[3m ... ESC[0m, as the server sends XP gains.
    if (line.startsWith(ITALIC_START) && line.endsWith(ESCAPE_END) && !line.slice(ITALIC_START.length, -ESCAPE_END.length).includes('\x1b')) {
      out.push({ kind: 'italic', text: line.slice(ITALIC_START.length, -ESCAPE_END.length) });
      continue;
    }
    // Colour only at the start, ending at once ("Grak" + " attacks you"), is a tappable name below. Colour in the
    // middle of a line, or over all of a line of words ("You learn Mend."), is shown as it came.
    const closes = line.indexOf(ESCAPE_END);
    const wholeLine = line.startsWith(ESCAPE_START) && closes === line.length - ESCAPE_END.length && line.slice(0, closes).includes(' ');
    const startsWithName = [RED, BLUE, GREEN].some((c) => line.startsWith(ESCAPE_START + c));
    if (line.includes(ESCAPE_START) && (!startsWithName || wholeLine)) {
      out.push({ kind: 'mixed', parts: colourParts(line) });
    } else if (line.startsWith(ESCAPE_START + RED)) {
      const { name, rest } = colored(line, RED);
      out.push({ kind: 'combat', npcName: name, actionText: rest });
    } else if (line.startsWith(ESCAPE_START + BLUE)) {
      const { name, rest } = colored(line, BLUE);
      // A name in a list can carry the player's name colour and badge: ESC]look;<colour>;<badge>BEL right after it.
      const look = LOOK.exec(rest);
      out.push({
        kind: 'player', playerName: name, actionText: look ? rest.slice(look[0].length) : rest,
        ...(look && look[1] ? { color: look[1] } : {}), ...(look && look[2] ? { badge: look[2] } : {}),
      });
    } else if (line.startsWith(ESCAPE_START + GREEN)) {
      const { name, rest } = colored(line, GREEN);
      out.push({ kind: 'item', itemName: name, actionText: rest });
    } else if (line === '') {
      out.push({ kind: 'spacer' });
    } else {
      out.push({ kind: 'plain', text: line });
    }
  }
  return out;
}

// frameLines is what a frame adds to the log: nothing for frames that update other
// state (stats, room, inventory) or that this client does not know.
export function frameLines(frame: ServerFrame): EntryBody[] {
  switch (frame.t) {
    case 'text':
      return textLines(frame.text);
    case 'say':
      return [{ kind: 'player', playerName: frame.who, actionText: ' says: ', speech: `"${frame.text}"`, color: frame.color, badge: frame.badge }];
    case 'arrive':
      return [{
        kind: 'player', playerName: frame.who, color: frame.color, badge: frame.badge,
        actionText: frame.from ? ` has entered the room from the ${frame.from}.` : ' has appeared in the room.',
      }];
    case 'leave':
      return [{
        kind: 'player', playerName: frame.who, color: frame.color, badge: frame.badge,
        actionText: frame.to ? ` has left to the ${frame.to}.` : ' has poofed away.',
      }];
    case 'whisper':
      return [{
        kind: 'whisper',
        text: frame.out ? `You whisper to ${frame.who}, "${frame.text}"` : `${frame.who} whispers, "${frame.text}"`,
      }];
    case 'chat':
      return [{ kind: 'chat', who: frame.who, text: frame.text, gm: frame.gm, color: frame.color, badge: frame.badge }];
    case 'announce':
      return [{ kind: 'announce', label: frame.from === 'event' ? 'Event' : 'GM', text: frame.text }];
    default:
      return [];
  }
}
