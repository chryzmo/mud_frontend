// How server frames become lines in the log. The server sends facts; the wording
// and colour live here. Colour still arrives as ANSI escapes inside `text` frames
// (a message can mix colours), so this module reads them.
import { ServerFrame } from '../net/frames';
import { MUDCOLOR } from '../utils/constants';

export type EntryBody =
  | { kind: 'plain'; text: string }
  | { kind: 'spacer' }
  | { kind: 'combat'; npcName: string; actionText: string }
  | { kind: 'player'; playerName: string; actionText: string; color?: string; badge?: string }
  | { kind: 'item'; itemName: string; actionText: string }
  | { kind: 'mixed'; parts: { text: string; tone?: 'npc' | 'player' | 'item' }[] } // a line with colour in the middle, or all of it
  | { kind: 'whisper'; text: string }
  | { kind: 'chat'; who: string; text: string; gm: boolean; color?: string; badge?: string } // global chat
  | { kind: 'announce'; label: string; text: string }
  | { kind: 'echo'; text: string } // a command the player sent
  | { kind: 'notice'; text: string } // from the client: a slow-down, an unknown command
  | { kind: 'divider'; text: string }; // the client's own marker, e.g. messages may have been missed

// A log line. `id` is unique and increasing, so it is a stable React key even
// after the oldest lines have been dropped from the front.
export type Entry = EntryBody & { id: number };

const TONES: Record<string, 'npc' | 'player' | 'item'> = { '31m': 'npc', '34m': 'player', '32m': 'item' };

// colourParts splits a line at its colour escapes ("You learn <green>Mend</green>.") into parts. An escape of a
// colour the client does not use is dropped, its text left plain.
function colourParts(line: string): { text: string; tone?: 'npc' | 'player' | 'item' }[] {
  const parts: { text: string; tone?: 'npc' | 'player' | 'item' }[] = [];
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

// textLines turns a block of game text into entries, one per line.
export function textLines(text: string): EntryBody[] {
  const { ESCAPE_START, ESCAPE_END, RED, BLUE, GREEN } = MUDCOLOR;
  const out: EntryBody[] = [];

  const colored = (line: string, color: string) => {
    const stripped = line.replace(ESCAPE_START + color, '').replace(ESCAPE_END, '');
    const name = stripped.split(' ')[0];
    return { name, rest: stripped.slice(name.length) };
  };

  for (const line of text.split('\n')) {
    // Colour only at the start, ending at once ("Grak" + " attacks you"), is a tappable name below. Colour in the
    // middle of a line, or over all of a line of words ("You learn Mend."), is shown as it came.
    const closes = line.indexOf(ESCAPE_END);
    const wholeLine = line.startsWith(ESCAPE_START) && closes === line.length - ESCAPE_END.length && line.slice(0, closes).includes(' ');
    if (line.includes(ESCAPE_START) && (!line.startsWith(ESCAPE_START) || wholeLine)) {
      out.push({ kind: 'mixed', parts: colourParts(line) });
    } else if (line.startsWith(ESCAPE_START + RED)) {
      const { name, rest } = colored(line, RED);
      out.push({ kind: 'combat', npcName: name, actionText: rest });
    } else if (line.startsWith(ESCAPE_START + BLUE)) {
      const { name, rest } = colored(line, BLUE);
      out.push({ kind: 'player', playerName: name, actionText: rest });
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
      return [{ kind: 'player', playerName: frame.who, actionText: ` says: "${frame.text}"`, color: frame.color, badge: frame.badge }];
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
