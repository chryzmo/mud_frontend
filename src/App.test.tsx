import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { FakeSocket, MemoryKV } from './net/testSupport';
import { createSession, Session } from './session';

let sockets: FakeSocket[];
let kv: MemoryKV;
let session: Session;

const sock = () => sockets[sockets.length - 1];
const deliver = (frame: object) => act(() => sock().deliver(frame));
const AUTH = { t: 'auth', ok: true, message: 'Welcome', resumed: false, gap: false };

function mount(preset: Record<string, string> = {}) {
  kv = new MemoryKV();
  Object.entries(preset).forEach(([k, v]) => kv.setItem(k, v));
  sockets = [];
  session = createSession({
    backing: kv, url: 'ws://t/ws', signals: false,
    createSocket: () => { const s = new FakeSocket(); sockets.push(s); return s; },
  });
  session.conn.start();
  render(<App session={session} />);
}

// Type a name and press Play, then let the server admit us.
function joinAs(name: string) {
  fireEvent.change(screen.getByLabelText('Pick a name'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  act(() => sock().open());
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn(); // jsdom doesn't implement it
});
afterEach(() => session.dispose());

describe('joining as a guest', () => {
  it('offers a name and no password', () => {
    mount();
    expect(screen.getByLabelText('Pick a name')).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it('sends join, then holds the player on the recovery code until they confirm it', () => {
    mount();
    joinAs('Alice');
    expect(sock().sentFrames()).toEqual([{ t: 'join', name: 'Alice' }]);
    deliver({ ...AUTH, token: 'TOK', recovery: 'ABCD-EFGH-JKLM' });

    expect(screen.getByTestId('recovery-code')).toHaveTextContent('ABCD-EFGH-JKLM');
    const start = screen.getByRole('button', { name: 'Start playing' });
    expect(start).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I have saved my code'));
    fireEvent.click(start);

    expect(screen.queryByTestId('recovery-code')).toBeNull();
    expect(screen.getByRole('textbox', { name: '' })).toBeInTheDocument(); // the command box
    expect(kv.getItem('mud.recovery')).toBeNull();
  });

  it('shows the recovery code again after a reload until it is confirmed', () => {
    mount({ 'mud.token': 'TOK', 'mud.name': 'Alice', 'mud.recovery': 'ABCD-EFGH-JKLM' });
    expect(screen.getByTestId('recovery-code')).toHaveTextContent('ABCD-EFGH-JKLM');
  });

  it('shows why a name was refused and lets the player try another', () => {
    mount();
    joinAs('Alice');
    deliver({ t: 'auth', ok: false, code: 'name_taken', message: 'That name is taken.', resumed: false, gap: false });
    expect(screen.getByRole('alert')).toHaveTextContent('That name is taken.');
    fireEvent.change(screen.getByLabelText('Pick a name'), { target: { value: 'Alice2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'join', name: 'Alice2' });
    expect(sockets).toHaveLength(1); // the same connection
  });

  it('tells the player to wait when the server is rate limiting joins', () => {
    mount();
    joinAs('Alice');
    deliver({ t: 'error', code: 'rate_limited', message: 'Busy.', retry_ms: 1000 });
    expect(screen.getByText(/Lots of players are joining/)).toBeInTheDocument();
  });
});

describe('recovering a character', () => {
  it('sends the name and code, and shows the new code', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'I have a recovery code' }));
    fireEvent.change(screen.getByLabelText('Character name'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText('Recovery code'), { target: { value: 'ABCD-EFGH-JKLM' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recover' }));
    act(() => sock().open());
    expect(sock().sentFrames()).toEqual([{ t: 'recover', name: 'Alice', code: 'ABCD-EFGH-JKLM' }]);
    deliver({ ...AUTH, resumed: true, token: 'NEW', recovery: 'WXYZ-WXYZ-WXYZ' });
    expect(screen.getByTestId('recovery-code')).toHaveTextContent('WXYZ-WXYZ-WXYZ');
  });

  it('says how long a locked name must wait', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'I have a recovery code' }));
    fireEvent.change(screen.getByLabelText('Character name'), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recover' }));
    act(() => sock().open());
    deliver({ t: 'auth', ok: false, code: 'recovery_locked', message: 'Locked.', retry_ms: 900000, resumed: false, gap: false });
    expect(screen.getByRole('alert')).toHaveTextContent('Try again in 15 minutes');
  });
});

describe('playing', () => {
  function playing() {
    mount({ 'mud.token': 'TOK', 'mud.name': 'Alice' });
    act(() => sock().open());
    deliver({ ...AUTH, resumed: true, gap: true });
  }

  it('resumes a stored character straight into the game', () => {
    playing();
    expect(sock().sentFrames()).toEqual([{ t: 'resume', token: 'TOK' }]); // a fresh page has no count
    expect(screen.getByText(/Some messages may have been missed/)).toBeInTheDocument();
  });

  it('draws text, room events, stats and exits, and sends moves', () => {
    playing();
    deliver({ t: 'room', name: 'Start Room', exits: ['N'] });
    deliver({ t: 'text', text: "You are in 'Start Room'\n" });
    deliver({ t: 'stats', hp: 12, maxhp: 20, mp: 3, maxmp: 10, atk: 5, atkbonus: 0, def: 10, defbonus: 0 });
    deliver({ t: 'say', who: 'bob', text: 'hello there' });
    deliver({ t: 'whisper', who: 'bob', text: 'psst', out: false });
    expect(screen.getByText("You are in 'Start Room'")).toBeInTheDocument();
    expect(screen.getByText('12 / 20')).toBeInTheDocument();
    expect(screen.getByText(/^\s*says: "hello there"$/)).toBeInTheDocument();
    expect(screen.getByText('bob whispers, "psst"')).toHaveClass('whisperText');

    fireEvent.click(screen.getByRole('button', { name: /^N/ }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'MOVE N' });
    expect(screen.getByText('> MOVE N')).toBeInTheDocument();
  });

  it('sends what is typed and clears the box', () => {
    playing();
    const box = screen.getByPlaceholderText('What would you like to do..?');
    fireEvent.input(box, { target: { value: 'SAY hi' } });
    fireEvent.submit(box.closest('form')!);
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'SAY hi' });
    expect(box).toHaveValue('');
  });

  it('shows the inventory reply', () => {
    playing();
    deliver({ t: 'inventory', text: 'Your inventory is empty.' });
    expect(screen.getByText(/Your inventory is empty\./)).toBeInTheDocument();
  });

  it('keeps the game on screen and says so while reconnecting', () => {
    playing();
    act(() => sock().drop());
    expect(screen.getByRole('status')).toHaveTextContent('Connection lost. Reconnecting');
    expect(screen.getByPlaceholderText('What would you like to do..?')).toBeInTheDocument();
  });

  it('says when the browser is offline', () => {
    playing();
    act(() => session.conn.networkOffline());
    expect(screen.getByRole('status')).toHaveTextContent('offline');
  });
});

describe('sessions that end', () => {
  function playing() {
    mount({ 'mud.token': 'TOK', 'mud.name': 'Alice' });
    act(() => sock().open());
    deliver({ ...AUTH, resumed: true });
  }

  it('idle: explains, and one tap resumes with the count the page had', () => {
    playing();
    deliver({ t: 'text', text: 'hello' });
    deliver({ t: 'error', code: 'idle', message: 'Idle.' });
    expect(screen.getByText('Still there?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the game' }));
    act(() => sock().open());
    expect(sock().sentFrames()).toEqual([{ t: 'resume', token: 'TOK', received: 1 }]);
  });

  it('replaced: explains and offers to play here', () => {
    playing();
    deliver({ t: 'error', code: 'replaced', message: 'Elsewhere.' });
    expect(screen.getByText('Opened somewhere else')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play here instead' })).toBeInTheDocument();
  });

  it('bad token: lands on recovery with the saved name filled in', () => {
    mount({ 'mud.token': 'OLD', 'mud.name': 'Alice' });
    act(() => sock().open());
    deliver({ t: 'auth', ok: false, code: 'bad_token', message: 'No.', resumed: false, gap: false });
    expect(screen.getByText(/could not find your session/)).toBeInTheDocument();
    expect(screen.getByLabelText('Character name')).toHaveValue('Alice');
    expect(screen.getByLabelText('Recovery code')).toBeInTheDocument();
  });

  it('bad version: asks for a reload', () => {
    mount();
    joinAs('Alice');
    deliver({ t: 'error', code: 'bad_version', message: 'Old.' });
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
