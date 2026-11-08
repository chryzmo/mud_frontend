import { describe, expect, it } from 'vitest';
import { cmdFrame, isCounted, joinFrame, loginFrame, parseFrame, recoverFrame, resumeFrame } from './frames';
import transcripts from './testdata/transcripts.json';

const f = (t: string, fields: Record<string, unknown> = {}) => JSON.stringify({ t, ...fields });

describe('parseFrame', () => {
  it('parses the game frames', () => {
    expect(parseFrame(f('text', { text: 'hi' }))).toEqual({ t: 'text', text: 'hi' });
    expect(parseFrame(f('say', { who: 'bob', text: 'hi' }))).toEqual({ t: 'say', who: 'bob', text: 'hi' });
    expect(parseFrame(f('arrive', { who: 'bob', from: 'N' }))).toEqual({ t: 'arrive', who: 'bob', from: 'N' });
    expect(parseFrame(f('leave', { who: 'bob' }))).toEqual({ t: 'leave', who: 'bob', to: undefined });
    expect(parseFrame(f('whisper', { who: 'bob', text: 'psst', out: true }))).toEqual({ t: 'whisper', who: 'bob', text: 'psst', out: true });
    expect(parseFrame(f('room', { name: 'Hall', exits: ['N', 7, 'S'] }))).toEqual({
      t: 'room', name: 'Hall', exits: ['N', 'S'], locked: [], things: [], people: [], items: [],
    });
    expect(parseFrame(f('room', {
      name: 'Hall', exits: ['N'], locked: ['D'],
      things: [{ id: 'c1', name: 'clock', verbs: ['TURN', 7] }, { id: 'x' }, 'junk'],
      people: [{ id: 'porter', name: 'Porter' }], items: [{ name: 'KEY', qty: 2 }, { name: 'GOLD' }],
    }))).toEqual({
      t: 'room', name: 'Hall', exits: ['N'], locked: ['D'],
      things: [{ id: 'c1', name: 'clock', verbs: ['TURN'] }], // a bad entry is skipped, not fatal
      people: [{ id: 'porter', name: 'Porter', verbs: [] }], items: [{ name: 'KEY', qty: 2 }, { name: 'GOLD', qty: 1 }],
    });
    expect(parseFrame(f('chat', { who: 'Ann', text: 'hi all', ch: 'global' }))).toEqual({ t: 'chat', who: 'Ann', text: 'hi all', gm: false });
    expect(parseFrame(f('chat', { who: 'boss', text: 'hello', ch: 'global', gm: true }))).toEqual({ t: 'chat', who: 'boss', text: 'hello', gm: true });
    expect(parseFrame(f('announce', { text: 'Feast!', from: 'event' }))).toEqual({ t: 'announce', text: 'Feast!', from: 'event' });
    expect(parseFrame(f('announce', { text: 'Hi', from: 'gm' }))).toEqual({ t: 'announce', text: 'Hi', from: 'gm' });
    expect(parseFrame(f('inventory', { text: 'nothing' }))).toEqual({ t: 'inventory', text: 'nothing' });
    expect(parseFrame(f('stats', { hp: 5, maxhp: 20, mp: 1, maxmp: 2, atk: 3, atkbonus: 0, def: 4, defbonus: 1 }))).toEqual({
      t: 'stats', stats: { hp: 5, maxhp: 20, mp: 1, maxmp: 2, atk: 3, atkbonus: 0, def: 4, defbonus: 1 },
    });
  });

  it('reads level, XP and the next level from stats, and leaves them out for an older server', () => {
    expect(parseFrame('{"t":"stats","hp":1,"maxhp":2,"mp":3,"maxmp":4,"atk":5,"atkbonus":0,"def":6,"defbonus":0,"level":2,"xp":30,"next":60}')).toMatchObject({ t: 'stats', stats: { level: 2, xp: 30, next: 60 } });
    const old = parseFrame('{"t":"stats","hp":1,"maxhp":2,"mp":3,"maxmp":4,"atk":5,"atkbonus":0,"def":6,"defbonus":0}');
    expect(old).toMatchObject({ stats: { level: undefined, xp: undefined, next: undefined } });
  });

  it('parses an auth reply with the join, resume and recover fields', () => {
    expect(parseFrame(f('auth', { ok: true, message: 'Welcome', token: 'T', recovery: 'R' }))).toEqual({
      t: 'auth', ok: true, code: undefined, message: 'Welcome', token: 'T', recovery: 'R',
      resumed: false, gap: false, replayed: 0, base: undefined, retryMs: undefined,
    });
    const resumed = parseFrame(f('auth', { ok: true, message: 'back', resumed: true, gap: true, replayed: 2, base: 7 }));
    expect(resumed).toMatchObject({ ok: true, resumed: true, gap: true, replayed: 2, base: 7 });
    expect(parseFrame(f('auth', { ok: false, code: 'recovery_locked', message: 'wait', retry_ms: 900000 }))).toMatchObject({
      ok: false, code: 'recovery_locked', retryMs: 900000,
    });
  });

  it('parses errors with and without a retry hint', () => {
    expect(parseFrame(f('error', { code: 'rate_limited', message: 'slow', retry_ms: 1200 }))).toEqual({
      t: 'error', code: 'rate_limited', message: 'slow', retryMs: 1200,
    });
    expect(parseFrame(f('error', { code: 'rate_limited', message: 'Slow down.' }))).toMatchObject({ retryMs: undefined });
  });

  it('parses the spells frame and skips what is malformed', () => {
    expect(parseFrame(f('spells', {
      known: [{ key: 'firebolt', name: 'Firebolt', effect: 'bolt', cost: 3, cooldown: 4, desc: 'Fire.' }, 'junk'],
      ready: ['firebolt', '', ''],
    }))).toEqual({
      t: 'spells',
      known: [{ key: 'firebolt', name: 'Firebolt', effect: 'bolt', cost: 3, cooldown: 4, desc: 'Fire.' }],
      ready: ['firebolt', '', ''],
    });
    expect(parseFrame(f('spells'))).toEqual({ t: 'spells', known: [], ready: [] });
  });

  it('turns a type it does not know into an unknown frame instead of dropping it', () => {
    expect(parseFrame(f('global_chat', { who: 'gm', text: 'hello all' }))).toEqual({ t: 'unknown', type: 'global_chat' });
  });

  it('rejects what is not a JSON object with a string type', () => {
    for (const bad of ['not json', '[]', '"text"', '{}', '{"t":1}', 'null']) expect(parseFrame(bad)).toBeNull();
    expect(parseFrame(undefined)).toBeNull();
    expect(parseFrame(new ArrayBuffer(1))).toBeNull();
  });
});

describe('isCounted', () => {
  it('counts every frame except hello, auth and error, known or not', () => {
    for (const raw of [f('text', { text: 'x' }), f('say'), f('room'), f('stats'), f('inventory'), f('whisper'), f('arrive'), f('leave'), f('global_chat')]) {
      expect(isCounted(parseFrame(raw)!), raw).toBe(true);
    }
    for (const raw of [f('hello'), f('auth', { ok: true }), f('error', { code: 'x' })]) {
      expect(isCounted(parseFrame(raw)!), raw).toBe(false);
    }
  });
});

describe('outgoing frames', () => {
  it('builds the client messages', () => {
    expect(JSON.parse(cmdFrame('LOOK'))).toEqual({ t: 'cmd', line: 'LOOK' });
    expect(JSON.parse(joinFrame('Alice'))).toEqual({ t: 'join', name: 'Alice' });
    expect(JSON.parse(recoverFrame('Alice', 'ABCD-EFGH'))).toEqual({ t: 'recover', name: 'Alice', code: 'ABCD-EFGH' });
    expect(JSON.parse(resumeFrame('tok', 4))).toEqual({ t: 'resume', token: 'tok', received: 4 });
    expect(JSON.parse(resumeFrame('tok', 0))).toEqual({ t: 'resume', token: 'tok', received: 0 });
  });

  it('signs staff in with a username and password', () => {
    expect(JSON.parse(loginFrame('boss', 'a long password'))).toEqual({ t: 'login', username: 'boss', password: 'a long password' });
  });

  it('leaves received out when the page remembers nothing', () => {
    expect(JSON.parse(resumeFrame('tok'))).toEqual({ t: 'resume', token: 'tok' });
  });
});

// The server's recorded frames must all be understood: a type this parser calls
// unknown would be counted but never shown.
describe('the server transcripts', () => {
  it('parse into frames this client knows', () => {
    let n = 0;
    for (const scenario of transcripts.scenarios) {
      for (const conn of scenario.connections) {
        for (const ev of conn.events) {
          if (!('recv' in ev) || !ev.recv) continue;
          const frame = parseFrame(JSON.stringify(ev.recv));
          expect(frame, `${scenario.scenario}: ${JSON.stringify(ev.recv)}`).not.toBeNull();
          expect(frame!.t, `${scenario.scenario}: ${JSON.stringify(ev.recv)}`).not.toBe('unknown');
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(100);
  });
});
