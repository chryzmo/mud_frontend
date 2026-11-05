import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

// App opens its socket at module load, so the stub must exist before it is imported.
class FakeSocket {
  static last: FakeSocket;
  sent: string[] = [];
  protocols: unknown;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  constructor(_url: string, protocols?: unknown) { this.protocols = protocols; FakeSocket.last = this; }
  send(data: string) { this.sent.push(data); }
}

const frame = (t: string, fields: Record<string, unknown> = {}) => JSON.stringify({ t, ...fields });
const deliver = (t: string, fields: Record<string, unknown> = {}) => act(() => { FakeSocket.last.onmessage!({ data: frame(t, fields) }); });

describe('App message routing', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('WebSocket', FakeSocket);
    Element.prototype.scrollIntoView = vi.fn(); // jsdom doesn't implement it
    const { default: App } = await import('./App');
    render(<App />);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('shows the login card and ignores the pre-login greeting text', () => {
    deliver('text', { text: 'Welcome to the MUD!\nRegister or log in to play.\n' });
    expect(screen.getByText('Welcome to the MUD', { selector: '#login-title' })).toBeInTheDocument();
    expect(document.querySelector('.login-error, #login-error')).toBeNull();
  });

  it('shows an auth failure and stays on the login card', () => {
    deliver('auth', { ok: false, code: 'bad_password', message: 'Incorrect password.' });
    expect(screen.getByText('Incorrect password.')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the MUD', { selector: '#login-title' })).toBeInTheDocument();
  });

  it('logs in on auth ok, then routes text, stats, room and inventory', () => {
    deliver('auth', { ok: true, message: 'Welcome back, ann!' });
    expect(document.getElementById('login-overlay')).toBeNull();

    deliver('text', { text: "You are in 'Start Room'\n" });
    expect(screen.getByText("You are in 'Start Room'")).toBeInTheDocument();

    deliver('stats', { hp: 12, maxhp: 20, mp: 3, maxmp: 10, atk: 5, atkbonus: 0, def: 10, defbonus: 0 });
    expect(screen.getByText('12 / 20')).toBeInTheDocument();

    deliver('room', { name: 'Start Room', exits: ['N'] });
    expect(screen.getByRole('button', { name: /^N/ })).toBeEnabled();

    deliver('error', { code: 'unknown_command', message: 'Unknown command.' });
    expect(screen.getByText('Unknown command.')).toBeInTheDocument();

    deliver('inventory', { text: 'Your inventory is empty.' });
    expect(screen.getByText(/Your inventory is empty\./)).toBeInTheDocument();
  });

  it('shows room events and whispers in the wording the client owns', () => {
    deliver('auth', { ok: true, message: 'Welcome back, ann!' });
    deliver('say', { who: 'bob', text: 'hello there' });
    expect(screen.getByText(/^\s*says: "hello there"$/)).toBeInTheDocument();
    deliver('arrive', { who: 'cy' });
    expect(screen.getByText(/^\s*has appeared in the room\.$/)).toBeInTheDocument();
    deliver('leave', { who: 'cy', to: 'N' });
    expect(screen.getByText(/^\s*has left to the N\.$/)).toBeInTheDocument();
    deliver('whisper', { who: 'bob', text: 'psst' });
    expect(screen.getByText('bob whispers, "psst"')).toHaveClass('whisperText');
    deliver('whisper', { who: 'bob', text: 'ok', out: true });
    expect(screen.getByText('You whisper to bob, "ok"')).toBeInTheDocument();
  });

  it('opens the socket with the protocol subprotocol', () => {
    expect(FakeSocket.last.protocols).toBe('mud.v1');
  });

  it('ignores frames that are not v1 envelopes', () => {
    act(() => { FakeSocket.last.onmessage!({ data: 'Welcome back, ann!' }); });
    expect(document.getElementById('login-overlay')).not.toBeNull();
  });
});
