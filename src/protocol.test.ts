import { describe, expect, it, vi } from 'vitest';
import { SUBPROTOCOL, eventToChat, parseServerMessage, sendCommand, sendLogin, sendRegister, textToChat } from './protocol';

const frame = (t: string, fields: Record<string, unknown> = {}) => JSON.stringify({ t, ...fields });

describe('parseServerMessage', () => {
  it('parses text', () => {
    expect(parseServerMessage(frame('text', { text: 'hi' }))).toEqual({ t: 'text', text: 'hi' });
  });

  it('parses the room events', () => {
    expect(parseServerMessage(frame('say', { who: 'bob', text: 'hi' }))).toEqual({ t: 'say', who: 'bob', text: 'hi' });
    expect(parseServerMessage(frame('arrive', { who: 'bob' }))).toEqual({ t: 'arrive', who: 'bob', from: undefined });
    expect(parseServerMessage(frame('arrive', { who: 'bob', from: 'N' }))).toEqual({ t: 'arrive', who: 'bob', from: 'N' });
    expect(parseServerMessage(frame('leave', { who: 'bob' }))).toEqual({ t: 'leave', who: 'bob', to: undefined });
    expect(parseServerMessage(frame('leave', { who: 'bob', to: 'S' }))).toEqual({ t: 'leave', who: 'bob', to: 'S' });
  });

  it('parses a received whisper and your own echo', () => {
    expect(parseServerMessage(frame('whisper', { who: 'bob', text: 'psst' }))).toEqual({ t: 'whisper', who: 'bob', text: 'psst', out: false });
    expect(parseServerMessage(frame('whisper', { who: 'bob', text: 'psst', out: true }))).toEqual({ t: 'whisper', who: 'bob', text: 'psst', out: true });
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

  it('rejects anything that is not a JSON object of a known type', () => {
    for (const raw of ['plain text', '{', '[]', 'null', '{"text":"x"}', '{"t":5}', frame('dance')]) {
      expect(parseServerMessage(raw)).toBeNull();
    }
  });
});

describe('eventToChat', () => {
  it('words a heard SAY as a clickable player line', () => {
    expect(eventToChat({ t: 'say', who: 'bob', text: 'hi' })).toEqual([{ type: 'player', playerName: 'bob', actionText: ' says: "hi"' }]);
  });

  it('words arrivals and departures, with and without a direction', () => {
    expect(eventToChat({ t: 'arrive', who: 'bob' })).toEqual([{ type: 'player', playerName: 'bob', actionText: ' has appeared in the room.' }]);
    expect(eventToChat({ t: 'arrive', who: 'bob', from: 'N' })).toEqual([{ type: 'player', playerName: 'bob', actionText: ' has entered the room from the N.' }]);
    expect(eventToChat({ t: 'leave', who: 'bob' })).toEqual([{ type: 'player', playerName: 'bob', actionText: ' has poofed away.' }]);
    expect(eventToChat({ t: 'leave', who: 'bob', to: 'S' })).toEqual([{ type: 'player', playerName: 'bob', actionText: ' has left to the S.' }]);
  });

  it('words whispers both ways', () => {
    expect(eventToChat({ t: 'whisper', who: 'bob', text: 'psst', out: false })).toEqual([{ type: 'whisper', text: 'bob whispers, "psst"' }]);
    expect(eventToChat({ t: 'whisper', who: 'bob', text: 'psst', out: true })).toEqual([{ type: 'whisper', text: 'You whisper to bob, "psst"' }]);
  });

  it('has nothing to show for other message types', () => {
    expect(eventToChat({ t: 'text', text: 'x' })).toEqual([]);
  });
});

describe('outgoing frames', () => {
  const fakeSocket = () => ({ send: vi.fn() }) as unknown as WebSocket;

  it('sends flat, version-free messages', () => {
    const ws = fakeSocket();
    sendCommand(ws, 'SAY "hi" \\ there');
    expect((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('{"t":"cmd","line":"SAY \\"hi\\" \\\\ there"}');
  });

  it('sends credentials as fields, so spaces and quotes survive', () => {
    const ws = fakeSocket();
    sendLogin(ws, 'ann', 'pass word"');
    sendRegister(ws, 'bob', 'p w');
    const sent = (ws.send as ReturnType<typeof vi.fn>).mock.calls.map(c => JSON.parse(c[0]));
    expect(sent).toEqual([
      { t: 'login', username: 'ann', password: 'pass word"' },
      { t: 'register', username: 'bob', password: 'p w' },
    ]);
  });

  it('names the subprotocol the server requires', () => {
    expect(SUBPROTOCOL).toBe('mud.v1');
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
