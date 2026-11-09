import { describe, expect, it } from 'vitest';
import { createConnection } from '../net/connection';
import { createSessionStore } from '../net/storage';
import { FakeSocket, MemoryKV } from '../net/testSupport';
import { frameLines, textLines } from './entries';
import { createGameStore } from './store';
import { GameState, MAX_LOG, initialGameState, reduce } from './state';

const E = '\x1b[';
const say = (n: number) => ({ t: 'say' as const, who: 'bob', text: `line ${n}` });

describe('textLines', () => {
  it('styles colored names and keeps plain lines', () => {
    expect(textLines(`${E}1;31mGrak${E}0m attacks you!`)).toEqual([{ kind: 'combat', npcName: 'Grak', actionText: ' attacks you!' }]);
    expect(textLines(`${E}1;34mbob${E}0m is here.`)).toEqual([{ kind: 'player', playerName: 'bob', actionText: ' is here.' }]);
    expect(textLines(`${E}1;32msword${E}0m lies here.`)).toEqual([{ kind: 'item', itemName: 'sword', actionText: ' lies here.' }]);
    expect(textLines('You are in a room.\n\nExits: N')).toEqual([
      { kind: 'plain', text: 'You are in a room.' }, { kind: 'spacer' }, { kind: 'plain', text: 'Exits: N' },
    ]);
  });
});

describe('textLines with colour inside a line', () => {
  it('shows colour in the middle of a line instead of the raw escape', () => {
    expect(textLines(`You learn ${E}1;32mMend${E}0m. It is ready in slot 1.`)).toEqual([
      { kind: 'mixed', parts: [{ text: 'You learn ' }, { text: 'Mend', tone: 'item' }, { text: '. It is ready in slot 1.' }] },
    ]);
    expect(textLines(`You buy ${E}1;32mIRON SWORD${E}0m for 50 gold.`)).toEqual([
      { kind: 'mixed', parts: [{ text: 'You buy ' }, { text: 'IRON SWORD', tone: 'item' }, { text: ' for 50 gold.' }] },
    ]);
  });

  it('shows a line that is coloured from end to end as one coloured piece, not just its first word', () => {
    expect(textLines(`${E}1;32mA dozen little lights spring up.${E}0m`)).toEqual([
      { kind: 'mixed', parts: [{ text: 'A dozen little lights spring up.', tone: 'item' }] },
    ]);
  });

  it('leaves a name at the start of a line tappable', () => {
    expect(textLines(`${E}1;32mGOLD${E}0m`)).toEqual([{ kind: 'item', itemName: 'GOLD', actionText: '' }]);
  });
});

describe('textLines with italics', () => {
  it('shows a line wrapped in the italic escape as italic text, and the blank line after it as a spacer', () => {
    expect(textLines('\x1b[3m(+6 combat XP)\x1b[0m\n')).toEqual([
      { kind: 'italic', text: '(+6 combat XP)' },
      { kind: 'spacer' },
    ]);
  });

  it('leaves a line that only starts with the escape, or mixes it with colour, from showing a raw escape as italic', () => {
    const [line] = textLines('\x1b[3mItalic \x1b[1;32mgreen\x1b[0m');
    expect(line.kind).not.toBe('italic');
  });
});

describe('textLines with speech colours', () => {
  it('colours your own words teal and a character\'s words violet, leaving the rest as it came', () => {
    expect(textLines(`You say: ${E}1;36m"hello"${E}0m`)).toEqual([
      { kind: 'mixed', parts: [{ text: 'You say: ' }, { text: '"hello"', tone: 'speechme' }] },
    ]);
    expect(textLines(`${E}1;35m"Welcome, pilgrim."${E}0m The Gatewarden nods.`)).toEqual([
      { kind: 'mixed', parts: [{ text: '"Welcome, pilgrim."', tone: 'speechnpc' }, { text: ' The Gatewarden nods.' }] },
    ]);
    expect(textLines(`The Gatewarden mutters, ${E}1;35m"Forty thousand and one."${E}0m`)).toMatchObject([{ kind: 'mixed' }]);
  });

  it('still makes a name at the start of a line tappable', () => {
    expect(textLines(`${E}1;31mGrak${E}0m attacks you.`)).toEqual([{ kind: 'combat', npcName: 'Grak', actionText: ' attacks you.' }]);
  });
});

describe('frameLines', () => {
  it('words the room events and whispers', () => {
    expect(frameLines({ t: 'say', who: 'bob', text: 'hi' })).toEqual([{ kind: 'player', playerName: 'bob', actionText: ' says: ', speech: '"hi"' }]);
    expect(frameLines({ t: 'arrive', who: 'bob', from: 'north' })[0]).toMatchObject({ actionText: ' has entered the room from the north.' });
    expect(frameLines({ t: 'arrive', who: 'bob' })[0]).toMatchObject({ actionText: ' has appeared in the room.' });
    expect(frameLines({ t: 'leave', who: 'bob', to: 'south' })[0]).toMatchObject({ actionText: ' has left to the south.' });
    expect(frameLines({ t: 'leave', who: 'bob' })[0]).toMatchObject({ actionText: ' has poofed away.' });
    expect(frameLines({ t: 'whisper', who: 'bob', text: 'psst', out: false })).toEqual([{ kind: 'whisper', text: 'bob whispers, "psst"' }]);
    expect(frameLines({ t: 'whisper', who: 'bob', text: 'psst', out: true })).toEqual([{ kind: 'whisper', text: 'You whisper to bob, "psst"' }]);
  });

  it('adds nothing for state frames and unknown types', () => {
    expect(frameLines({ t: 'room', name: 'Hall', exits: [], locked: [], things: [], people: [], items: [] })).toEqual([]);
    expect(frameLines({ t: 'unknown', type: 'leaderboard' })).toEqual([]);
  });
});

describe('reduce', () => {
  it('keeps room, stats and inventory out of the log', () => {
    let s = initialGameState();
    s = reduce(s, { type: 'frame', frame: { t: 'room', name: 'Hall', exits: ['N', 'E'], locked: [], things: [], people: [], items: [] } });
    s = reduce(s, { type: 'frame', frame: { t: 'stats', stats: { hp: 1, maxhp: 2, mp: 3, maxmp: 4, atk: 5, atkbonus: 0, def: 6, defbonus: 0 } } });
    s = reduce(s, { type: 'frame', frame: { t: 'inventory', text: 'a sword' } });
    expect(s).toMatchObject({ log: [], room: { name: 'Hall', exits: ['N', 'E'] }, stats: { hp: 1 }, inventory: 'a sword' });
    expect(reduce(s, { type: 'closeInventory' }).inventory).toBeNull();
  });

  it('logs global chat and announcements, and keeps the latest announcement as a banner until it is dismissed', () => {
    let s = initialGameState();
    s = reduce(s, { type: 'frame', frame: { t: 'chat', who: 'Ann', text: 'hi all', gm: false } });
    expect(s.log).toMatchObject([{ kind: 'chat', who: 'Ann', text: 'hi all', gm: false }]);
    expect(s.banner).toBeNull();
    s = reduce(s, { type: 'frame', frame: { t: 'announce', text: 'Feast at nine', from: 'gm' } });
    expect(s.log[1]).toMatchObject({ kind: 'announce', label: 'GM', text: 'Feast at nine' });
    expect(s.banner).toMatchObject({ label: 'GM', text: 'Feast at nine' });
    s = reduce(s, { type: 'frame', frame: { t: 'announce', text: 'The bell tolls', from: 'event' } });
    expect(s.banner).toMatchObject({ label: 'Event', text: 'The bell tolls' });
    expect(reduce(s, { type: 'dismissBanner' }).banner).toBeNull();
  });

  it('caps the log, dropping the oldest and keeping ids unique and increasing', () => {
    let s: GameState = initialGameState();
    for (let i = 0; i < MAX_LOG + 25; i++) s = reduce(s, { type: 'frame', frame: say(i) });
    expect(s.log).toHaveLength(MAX_LOG);
    expect(s.log[0]).toMatchObject({ actionText: ' says: ', speech: '"line 25"' });
    const ids = s.log.map((e) => e.id);
    expect(new Set(ids).size).toBe(MAX_LOG);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });

  it('starts clean for a new character but keeps the log across a resume', () => {
    let s = reduce(initialGameState(), { type: 'frame', frame: say(1) });
    s = reduce(s, { type: 'frame', frame: { t: 'room', name: 'Hall', exits: [], locked: [], things: [], people: [], items: [] } });
    const resumed = reduce(s, { type: 'welcome', resumed: true, gap: false });
    expect(resumed).toBe(s);
    const fresh = reduce(s, { type: 'welcome', resumed: false, gap: false });
    expect(fresh).toMatchObject({ log: [], room: null });
    expect(fresh.nextId).toBe(s.nextId); // keys never repeat
  });

  it('marks a gap in the log', () => {
    let s = reduce(initialGameState(), { type: 'frame', frame: say(1) });
    s = reduce(s, { type: 'welcome', resumed: true, gap: true });
    expect(s.log).toHaveLength(2);
    expect(s.log[1]).toMatchObject({ kind: 'divider' });
  });
});

describe('createGameStore', () => {
  function setup() {
    const kv = new MemoryKV();
    const sockets: FakeSocket[] = [];
    const conn = createConnection({
      url: 'ws://t/ws', store: createSessionStore(kv), random: () => 0,
      createSocket: () => { const s = new FakeSocket(); sockets.push(s); return s; },
    });
    const game = createGameStore(conn);
    conn.join('Alice');
    sockets[0].open();
    sockets[0].deliver({ t: 'auth', ok: true, message: 'Welcome', token: 'T', recovery: 'R', resumed: false, gap: false });
    return { conn, game, sock: sockets[0] };
  }

  it('turns game frames into state and tells subscribers', () => {
    const { game, sock } = setup();
    let calls = 0;
    game.subscribe(() => calls++);
    sock.deliver({ t: 'room', name: 'Start Room', exits: ['N'], locked: [], things: [], people: [], items: [] });
    sock.deliver({ t: 'say', who: 'bob', text: 'hi' });
    expect(game.getState().room).toEqual({ name: 'Start Room', exits: ['N'], locked: [], things: [], people: [], items: [] });
    expect(game.getState().log).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it('echoes a command and sends it, ignoring blank lines', () => {
    const { game, sock } = setup();
    game.send('  SAY hello ');
    game.send('   ');
    expect(JSON.parse(sock.sent[sock.sent.length - 1])).toEqual({ t: 'cmd', line: 'SAY hello' });
    expect(game.getState().log).toEqual([{ id: 1, kind: 'echo', text: 'SAY hello' }]);
  });

  it('does not pretend a command went out while the connection is down', () => {
    const { game, sock } = setup();
    sock.drop(); // reconnecting: nothing can be sent
    game.send('SAY anyone there');
    expect(game.getState().log).toMatchObject([{ kind: 'notice', text: expect.stringContaining('Not connected') }]);
    expect(game.getState().log.some((e) => e.kind === 'echo')).toBe(false);
  });

  it('logs a server notice without ending the session', () => {
    const { conn, game, sock } = setup();
    sock.deliver({ t: 'error', code: 'rate_limited', message: 'Slow down.' });
    expect(game.getState().log).toMatchObject([{ kind: 'notice', text: 'Slow down.' }]);
    expect(conn.getState().phase).toBe('online');
  });

  it('stops listening after dispose', () => {
    const { game, sock } = setup();
    game.dispose();
    sock.deliver({ t: 'say', who: 'bob', text: 'hi' });
    expect(game.getState().log).toEqual([]);
  });
});

describe('the spells frame', () => {
  it('replaces what the player knows and has readied, and starts empty', () => {
    expect(initialGameState().spells).toBeNull();
    const firebolt = { key: 'firebolt', name: 'Firebolt', effect: 'bolt', cost: 3, cooldown: 4, desc: 'Fire.' };
    const first = reduce(initialGameState(), { type: 'frame', frame: { t: 'spells', known: [firebolt], ready: ['firebolt', '', ''] } });
    expect(first.spells).toEqual({ known: [firebolt], ready: ['firebolt', '', ''] });
    expect(first.log).toHaveLength(0); // it draws no line in the log
    const second = reduce(first, { type: 'frame', frame: { t: 'spells', known: [firebolt], ready: ['', '', 'firebolt'] } });
    expect(second.spells?.ready).toEqual(['', '', 'firebolt']);
  });
});
