// Replays the server's recorded transcripts (testdata/transcripts.json, generated
// by mud_server's TestWireTranscripts) through the real connection, over a scripted
// socket. For each connection in a scenario the recorded server frames are
// delivered in order, and every frame the recording says the client sent must be
// exactly what this client sends. Counting and resume rules therefore hold against
// what the server really did, not against memory.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Connection, ConnEvent, createConnection } from './connection';
import { createSessionStore } from './storage';
import { FakeSocket, MemoryKV } from './testSupport';
import transcriptFile from './testdata/transcripts.json';

type Frame = Record<string, unknown>;
interface Ev { send?: Frame; recv?: Frame; end?: string }
interface Scenario { scenario: string; about: string; connections: { events: Ev[] }[] }
const scenarios = (transcriptFile as unknown as { scenarios: Scenario[] }).scenarios;

class Harness {
  sockets: FakeSocket[] = [];
  kv = new MemoryKV();
  conn!: Connection;
  events: ConnEvent[] = [];

  constructor() {
    this.makeConnection();
  }

  makeConnection() {
    this.conn?.dispose();
    this.conn = createConnection({
      url: 'ws://test/ws',
      store: createSessionStore(this.kv),
      createSocket: () => {
        const s = new FakeSocket();
        this.sockets.push(s);
        return s;
      },
      random: () => 0, // no jitter: delays are the bare backoff, retry hints exact
    });
    this.conn.subscribe((e) => this.events.push(e));
  }

  // The page is reloaded: a new connection object (no frame count), storage kept or cleared.
  reload(clearStorage: boolean) {
    if (clearStorage) this.kv = new MemoryKV();
    this.makeConnection();
    this.conn.start();
  }

  // A page that holds this token and no frame count loads and resumes (a reload, or a stale device).
  coldResume(token: string) {
    this.kv.setItem('mud.token', token);
    this.makeConnection();
    this.conn.start();
  }

  async advanceToRetry() {
    const at = this.conn.getState().retryAt;
    if (at !== undefined) await vi.advanceTimersByTimeAsync(Math.max(0, at - Date.now()));
  }

  // The socket for connection number ci: made by a pending reconnect timer if there is
  // one, else by the player doing what the recording says they did.
  async socketFor(ci: number, first: Ev | undefined): Promise<FakeSocket> {
    const cold = first?.send?.t === 'resume' && first.send.received === undefined;
    if (cold) this.coldResume(String(first.send!.token));
    if (this.sockets.length <= ci) await this.advanceToRetry();
    if (this.sockets.length <= ci) this.act(first?.send);
    if (this.sockets.length <= ci) throw new Error(`the client did not open connection ${ci}`);
    return this.sockets[ci];
  }

  // What the player does to produce a recorded frame the client does not send by itself.
  act(frame: Frame | undefined) {
    switch (frame?.t) {
      case 'cmd':
        return void this.conn.sendCommand(String(frame.line));
      case 'recover':
        return void this.conn.recover(String(frame.name), String(frame.code));
      case 'resume':
        return void this.conn.resume();
      default: // join, or a recording with no send at all (bad-version): the player taps Join
        return void this.conn.join(String(frame?.name ?? 'Alice'));
    }
  }

  async expectSent(sock: FakeSocket, index: number, expected: Frame, label: string) {
    if (sock.sent.length <= index) await this.advanceToRetry(); // a wait the client runs itself (rate limit)
    if (sock.sent.length <= index) this.act(expected);
    expect(sock.sent.length, `${label}: the client sent nothing for ${JSON.stringify(expected)}`).toBeGreaterThan(index);
    expect(JSON.parse(sock.sent[index]), label).toEqual(expected);
  }
}

// Checks that go beyond the recorded frames, keyed "scenario#connection", run after that connection.
const after: Record<string, (h: Harness) => Promise<void>> = {
  'join#0': async (h) => {
    expect(h.conn.getState().phase).toBe('online');
    expect(h.kv.getItem('mud.token')).toBe('TOKEN-1');
    expect(h.kv.getItem('mud.name')).toBe('Alice');
    expect(h.kv.getItem('mud.recovery')).toBe('RECOVERY-1'); // kept until the player confirms
    expect(h.events.find((e) => e.type === 'welcome')).toMatchObject({ type: 'welcome', recovery: 'RECOVERY-1' });
  },
  'join-refused#0': async (h) => {
    expect(h.conn.getState()).toMatchObject({ phase: 'online', refusal: undefined });
    expect(h.sockets).toHaveLength(1); // every refusal reused the one connection
  },
  'idle#0': async (h) => {
    expect(h.conn.getState()).toMatchObject({ phase: 'ended', endReason: 'idle' });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(h.sockets).toHaveLength(1); // no reconnecting by itself: that would take the slot straight back
    expect(h.kv.getItem('mud.token')).toBe('TOKEN-1'); // a tap resumes
  },
  'replaced#0': async (h) => {
    expect(h.conn.getState()).toMatchObject({ phase: 'ended', endReason: 'replaced' });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(h.sockets).toHaveLength(1); // the two tabs must not fight
  },
  'bad-version#0': async (h) => {
    expect(h.conn.getState()).toMatchObject({ phase: 'ended', endReason: 'bad_version' });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(h.sockets).toHaveLength(1);
  },
  'server-restarting#0': async (h) => {
    expect(h.conn.getState()).toMatchObject({ phase: 'reconnecting', waitReason: 'server_restarting' });
    await h.advanceToRetry();
    expect(h.sockets).toHaveLength(2); // it comes back by itself
  },
  'join-rate-limited#0': async (h) => {
    expect(h.sockets).toHaveLength(1); // waited the hint and asked again on the same connection
    expect(h.conn.getState().phase).toBe('online');
  },
  'command-rate-limited#0': async (h) => {
    expect(h.conn.getState()).toMatchObject({ phase: 'online', retryAt: undefined });
    expect(h.events.filter((e) => e.type === 'notice')).toHaveLength(1); // a notice, not a wait
  },
  'kicked#0': async (h) => {
    expect(h.conn.getState()).toMatchObject({ phase: 'ended', endReason: 'kicked' });
    expect(h.conn.getState().endMessage).toContain('take a break');
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(h.sockets).toHaveLength(1); // no reconnecting by itself
    expect(h.kv.getItem('mud.token')).toBe('TOKEN-1'); // the character is kept
  },
  'kicked#1': async (h) => {
    // A page reloaded during the break: refused, and it stays refused without a reconnect loop.
    expect(h.conn.getState()).toMatchObject({ phase: 'ended', endReason: 'kicked' });
    expect(h.conn.getState().endMessage).toContain('take a break');
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(h.sockets).toHaveLength(2);
    expect(h.kv.getItem('mud.token')).toBe('TOKEN-1');
  },
  'recover#1': async (h) => {
    expect(h.kv.getItem('mud.token')).toBe('TOKEN-2'); // both secrets replaced
    expect(h.kv.getItem('mud.recovery')).toBe('RECOVERY-2');
  },
  'recover-locked#1': async (h) => {
    expect(h.conn.getState()).toMatchObject({ phase: 'landing', refusal: { code: 'recovery_locked', retryMs: 900000 } });
  },
  'recover#3': async (h) => {
    // The old token, from a stale device: terminal, and the stored token is cleared.
    expect(h.conn.getState()).toMatchObject({ phase: 'ended', endReason: 'bad_token' });
    expect(h.kv.getItem('mud.token')).toBeNull();
  },
  'resume-bad-token#0': async (h) => {
    expect(h.conn.getState()).toMatchObject({ phase: 'ended', endReason: 'bad_token' });
    expect(h.kv.getItem('mud.token')).toBeNull();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(h.sockets).toHaveLength(1);
  },
};

// Before this connection of the scenario, the page is reloaded.
const reloadBefore: Record<string, { clearStorage: boolean }> = {
  'recover#1': { clearStorage: true }, // storage was cleared: only the recovery code remains
  'recover-locked#1': { clearStorage: true },
};

describe('replaying the server transcripts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  for (const sc of scenarios) {
    it(`${sc.scenario}: ${sc.about}`, async () => {
      const h = new Harness();
      for (let ci = 0; ci < sc.connections.length; ci++) {
        const key = `${sc.scenario}#${ci}`;

        const events = sc.connections[ci].events;
        if (reloadBefore[key]) h.reload(reloadBefore[key].clearStorage);
        const sock = await h.socketFor(ci, events.find((e) => e.send));
        sock.open();

        let sentIndex = 0;
        for (const ev of events) {
          const label = `${key}`;
          if (ev.recv) sock.deliver(ev.recv);
          else if (ev.send) await h.expectSent(sock, sentIndex++, ev.send, label);
          else if (ev.end === 'cut' || ev.end === 'server_closed') sock.drop();
        }
        if (sc.scenario !== 'bad-version') expect(sock.sent, `${key}: frames the recording does not have`).toHaveLength(sentIndex);
        await after[key]?.(h);
      }
    });
  }

  it('replays every recorded scenario', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(16);
  });
});
