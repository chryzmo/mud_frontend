import { describe, expect, it, vi } from 'vitest';
import { parseServerMessage, sendCommand, sendLogin, sendRegister, textToChat } from './protocol';

const frame = (t: string, d?: unknown, v = 1) => JSON.stringify({ v, t, d });

describe('parseServerMessage', () => {
  it('parses text with its kind', () => {
    expect(parseServerMessage(frame('text', { text: 'hi', kind: 'player' }))).toEqual({ t: 'text', text: 'hi', kind: 'player' });
  });

  it('defaults a missing kind to plain', () => {
    expect(parseServerMessage(frame('text', { text: 'hi' }))).toEqual({ t: 'text', text: 'hi', kind: 'plain' });
  });

  it('parses auth success and failure', () => {
    expect(parseServerMessage(frame('auth', { ok: true, message: 'Welcome back, a!' })))
      .toEqual({ t: 'auth', ok: true, code: undefined, message: 'Welcome back, a!' });
    expect(parseServerMessage(frame('auth', { ok: false, code: 'bad_password', message: 'Incorrect password.' })))
      .toEqual({ t: 'auth', ok: false, code: 'bad_password', message: 'Incorrect password.' });
  });

  it('never treats a missing ok as success', () => {
    expect(parseServerMessage(frame('auth', { message: 'x' }))).toMatchObject({ ok: false });
  });

  it('parses stats, room, inventory and error', () => {
    expect(parseServerMessage(frame('stats', { hp: 1, maxhp: 2, mp: 3, maxmp: 4, atk: 5, atkbonus: 6, def: 7, defbonus: 8 })))
      .toEqual({ t: 'stats', stats: { hp: 1, maxhp: 2, mp: 3, maxmp: 4, atk: 5, atkbonus: 6, def: 7, defbonus: 8 } });
    expect(parseServerMessage(frame('room', { name: 'Hall', exits: ['N', 'S'] }))).toEqual({ t: 'room', name: 'Hall', exits: ['N', 'S'] });
    expect(parseServerMessage(frame('room', { name: 'Closet', exits: null }))).toEqual({ t: 'room', name: 'Closet', exits: [] });
    expect(parseServerMessage(frame('inventory', { text: 'Your inventory is empty.' }))).toEqual({ t: 'inventory', text: 'Your inventory is empty.' });
    expect(parseServerMessage(frame('error', { code: 'rate_limited', message: 'Slow down.' }))).toEqual({ t: 'error', code: 'rate_limited', message: 'Slow down.' });
  });

  it('rejects anything that is not a v1 envelope of a known type', () => {
    for (const raw of ['plain text', '{', '[]', 'null', '{"v":1}', frame('dance', {}), frame('text', { text: 'x' }, 2), frame('text', { text: 'x' }, 0)]) {
      expect(parseServerMessage(raw)).toBeNull();
    }
  });
});

describe('outgoing frames', () => {
  const fakeSocket = () => ({ send: vi.fn() }) as unknown as WebSocket;

  it('wraps a command line', () => {
    const ws = fakeSocket();
    sendCommand(ws, 'SAY "hi" \\ there');
    expect(JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({ v: 1, t: 'cmd', d: { line: 'SAY "hi" \\ there' } });
  });

  it('sends credentials as fields, so spaces and quotes survive', () => {
    const ws = fakeSocket();
    sendLogin(ws, 'ann', 'pass word"');
    sendRegister(ws, 'bob', 'p w');
    const sent = (ws.send as ReturnType<typeof vi.fn>).mock.calls.map(c => JSON.parse(c[0]));
    expect(sent).toEqual([
      { v: 1, t: 'login', d: { username: 'ann', password: 'pass word"' } },
      { v: 1, t: 'register', d: { username: 'bob', password: 'p w' } },
    ]);
  });
});

describe('textToChat', () => {
  const red = (s: string) => `\x1b[1;31m${s}\x1b[0m`;
  const blue = (s: string) => `\x1b[1;34m${s}\x1b[0m`;
  const green = (s: string) => `\x1b[1;32m${s}\x1b[0m`;

  it('styles each line by its leading colour', () => {
    expect(textToChat(`${red('Grak')} looks at you.\n${blue('bob')} says: "hi"\n${green('sword')} lies here.`)).toEqual([
      { type: 'combat', npcName: 'Grak', actionText: ' looks at you.' },
      { type: 'player', playerName: 'bob', actionText: ' says: "hi"' },
      { type: 'item', itemName: 'sword', actionText: ' lies here.' },
    ]);
  });

  it('keeps colours per line inside a multi-line room description', () => {
    expect(textToChat(`You are in 'Arena'\n\nThe monsters here are:\n${red('Orc')}\n`)).toEqual([
      { type: 'plain', text: "You are in 'Arena'", bold: false },
      { type: 'spacer' },
      { type: 'plain', text: 'The monsters here are:', bold: false },
      { type: 'combat', npcName: 'Orc', actionText: '' },
      { type: 'spacer' },
    ]);
  });

  it('does not treat a stats-looking or exits-looking line specially', () => {
    expect(textToChat('Exits: [N] [S]')).toEqual([{ type: 'plain', text: 'Exits: [N] [S]', bold: false }]);
  });
});
