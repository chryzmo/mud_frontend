import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { FakeSocket, MemoryKV, ThrowingKV } from './net/testSupport';
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
    expect(screen.getByRole('textbox', { name: 'Command' })).toBeInTheDocument(); // the command box
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

  it('opens an action sheet for a tapped name and sends the chosen action', () => {
    playing();
    deliver({ t: 'text', text: '\x1b[1;31mGrak\x1b[0m snarls at you.\n\x1b[1;32msword\x1b[0m lies here.' });
    fireEvent.click(screen.getByText('Grak'));
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'ATTACK Grak' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByText('sword'));
    fireEvent.click(screen.getByRole('button', { name: 'Pick up' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'GET sword' });
  });

  it('offers Examine for names in the log and for items in the pack', () => {
    playing();
    deliver({ t: 'text', text: '\x1b[1;31mGrak\x1b[0m snarls at you.\n\x1b[1;32msword\x1b[0m lies here.' });
    deliver({ t: 'say', who: 'bob', text: 'hi' });
    for (const [tap, line] of [['Grak', 'EXAMINE Grak'], ['sword', 'EXAMINE sword'], ['bob', 'EXAMINE bob']]) {
      fireEvent.click(screen.getByText(tap));
      fireEvent.click(screen.getByRole('button', { name: 'Examine' }));
      expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line });
    }
    deliver({ t: 'inventory', text: 'Your inventory contains:\n\n\x1b[1;32m2x rusty sword\x1b[0m\n' });
    fireEvent.click(screen.getByRole('button', { name: '2x rusty sword' }));
    fireEvent.click(screen.getByRole('button', { name: 'Examine' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'EXAMINE MY rusty sword' });
  });

  it('whispering from the sheet fills the input instead of sending', () => {
    playing();
    deliver({ t: 'say', who: 'bob', text: 'hi' });
    fireEvent.click(screen.getByText('bob'));
    const sent = sock().sent.length;
    fireEvent.click(screen.getByRole('button', { name: 'Whisper' }));
    expect(screen.getByPlaceholderText('What would you like to do..?')).toHaveValue('WHISPER bob ');
    expect(sock().sent).toHaveLength(sent);
  });

  it('sends the quick actions in one tap', () => {
    playing();
    fireEvent.click(screen.getByRole('button', { name: 'Look' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'LOOK' });
    fireEvent.click(screen.getByRole('button', { name: 'Items' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'INVENTORY' });
  });

  it('lets the player equip or drop an item from the inventory sheet', () => {
    playing();
    deliver({ t: 'inventory', text: 'Your inventory contains:\n\n\x1b[1;32m2x rusty sword\x1b[0m\n' });
    fireEvent.click(screen.getByRole('button', { name: '2x rusty sword' }));
    fireEvent.click(screen.getByRole('button', { name: 'Drop' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'DROP rusty sword' });
  });

  it('keeps the compass while the keyboard is up on a tall screen, and drops it on a short one', () => {
    class Viewport extends EventTarget { height = 700; offsetTop = 0; }
    const vv = new Viewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    try {
      playing();
      const game = () => document.getElementById('game')!;
      const box = screen.getByPlaceholderText('What would you like to do..?');
      fireEvent.focus(box);
      expect(game()).not.toHaveClass('cramped'); // 700px is plenty with the keyboard up

      act(() => { vv.height = 300; vv.dispatchEvent(new Event('resize')); }); // a short screen, or landscape
      expect(game()).toHaveClass('cramped');
      fireEvent.blur(box);
      expect(game()).not.toHaveClass('cramped');
    } finally {
      delete (window as unknown as Record<string, unknown>).visualViewport;
    }
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

describe('copying the recovery code', () => {
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  afterEach(() => {
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
    else delete (navigator as unknown as Record<string, unknown>).clipboard;
    delete (document as unknown as Record<string, unknown>).execCommand;
  });
  const showCode = () => mount({ 'mud.token': 'T', 'mud.name': 'Alice', 'mud.recovery': 'ABCD-EFGH-JKLM' });

  it('uses the clipboard API when the page has it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    showCode();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('ABCD-EFGH-JKLM');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('falls back to the copy command on a page without the clipboard API (plain http)', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    let copied = '';
    document.execCommand = vi.fn(() => {
      copied = document.querySelector('textarea')!.value;
      return true;
    });
    showCode();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(copied).toBe('ABCD-EFGH-JKLM');
    expect(document.querySelector('textarea')).toBeNull(); // the helper field is removed
  });

  it('says so when nothing can copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    document.execCommand = vi.fn(() => false);
    showCode();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument();
  });
});

describe('reconnect status', () => {
  function reconnecting() {
    mount({ 'mud.token': 'TOK', 'mud.name': 'Alice' });
    act(() => sock().open());
    deliver({ ...AUTH, resumed: true });
    act(() => sock().drop());
  }

  it('counts down to the next attempt and offers to retry now', () => {
    vi.useFakeTimers();
    try {
      reconnecting();
      // The first retry comes within a second; make the next one a longer wait.
      act(() => { vi.advanceTimersByTime(1000); });
      act(() => sock().drop());
      expect(screen.getByRole('status')).toHaveTextContent(/Connection lost\. Reconnecting in \d+s/);

      const before = sockets.length;
      fireEvent.click(screen.getByRole('button', { name: 'Retry now' }));
      expect(sockets).toHaveLength(before + 1);
      expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
    } finally {
      vi.useRealTimers();
    }
  });

  it('warns when the browser cannot keep the login', () => {
    kv = new MemoryKV();
    sockets = [];
    session = createSession({
      backing: new ThrowingKV(), url: 'ws://t/ws', signals: false,
      createSocket: () => { const s = new FakeSocket(); sockets.push(s); return s; },
    });
    session.store.saveSession('T', 'Alice'); // kept in memory only
    session.conn.start();
    render(<App session={session} />);
    act(() => sock().open());
    deliver({ ...AUTH, resumed: true });
    expect(screen.getByRole('note')).toHaveTextContent(/not saving your login/);
  });
});

describe('the game master', () => {
  afterEach(() => window.history.pushState({}, '', '/'));

  function atStaff() {
    window.history.pushState({}, '', '/staff');
    mount();
  }

  function signIn() {
    atStaff();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'boss' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a long password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    act(() => sock().open());
    deliver({ t: 'auth', ok: true, message: 'Welcome back, boss!', resumed: false, gap: false });
  }

  it('shows the staff sign-in at /staff, not the guest landing, and sends login', () => {
    atStaff();
    expect(screen.getByRole('heading', { name: 'Staff sign-in' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Pick a name')).toBeNull();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'boss' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a long password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    act(() => sock().open());
    expect(sock().sentFrames()).toEqual([{ t: 'login', username: 'boss', password: 'a long password' }]);
  });

  it('does not resume a guest character on the staff page', () => {
    kv = new MemoryKV();
    kv.setItem('mud.token', 'TOK');
    window.history.pushState({}, '', '/staff');
    sockets = [];
    session = createSession({
      backing: kv, url: 'ws://t/ws', signals: false,
      createSocket: () => { const s = new FakeSocket(); sockets.push(s); return s; },
    });
    render(<App session={session} />);
    expect(sockets).toHaveLength(0); // nothing connects until the GM signs in
    expect(screen.getByRole('heading', { name: 'Staff sign-in' })).toBeInTheDocument();
  });

  it('shows why a sign-in was refused', () => {
    atStaff();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'boss' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong password!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    act(() => sock().open());
    deliver({ t: 'auth', ok: false, code: 'bad_password', message: 'Incorrect password.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect password.');
  });

  it('gives a signed-in GM the panel, whose buttons send GM commands', () => {
    signIn();
    deliver({ t: 'room', name: 'Start Room', exits: [] });
    fireEvent.click(screen.getByRole('button', { name: 'GM' }));
    expect(screen.getByRole('dialog', { name: 'Game master' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Who is here' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'GM WHO' });
    expect(screen.queryByRole('dialog')).toBeNull(); // the answer is in the log

    fireEvent.click(screen.getByRole('button', { name: 'GM' }));
    fireEvent.change(screen.getByLabelText('Announce to everyone'), { target: { value: 'The feast begins at nine!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Announce' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'GM ANNOUNCE The feast begins at nine!' });

    fireEvent.click(screen.getByRole('button', { name: 'GM' }));
    expect(screen.getByRole('button', { name: 'Mute 15 min' })).toBeDisabled(); // needs a name
    fireEvent.change(screen.getByLabelText('Player'), { target: { value: 'bob' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mute 15 min' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'GM MUTE bob 15' });

    fireEvent.click(screen.getByRole('button', { name: 'GM' })); // the name is remembered
    expect(screen.getByLabelText('Player')).toHaveValue('bob');
    fireEvent.click(screen.getByRole('button', { name: 'Lock joins' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'GM LOCK' });
  });

  it('asks twice before kicking', () => {
    signIn();
    fireEvent.click(screen.getByRole('button', { name: 'GM' }));
    fireEvent.change(screen.getByLabelText('Player'), { target: { value: 'bob' } });
    const sent = sock().sent.length;
    fireEvent.click(screen.getByRole('button', { name: 'Kick 10 min' }));
    expect(sock().sent).toHaveLength(sent); // nothing yet
    fireEvent.click(screen.getByRole('button', { name: 'Really kick bob for 10 min?' }));
    expect(sock().sentFrames().pop()).toEqual({ t: 'cmd', line: 'GM KICK bob 10' });
  });

  it('shows no GM button to a guest', () => {
    mount({ 'mud.token': 'TOK', 'mud.name': 'Alice' });
    act(() => sock().open());
    deliver({ t: 'auth', ok: true, message: 'Welcome back', resumed: true, gap: true });
    expect(screen.getByPlaceholderText('What would you like to do..?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'GM' })).toBeNull();
  });
});

describe('being kicked', () => {
  it('lands on a calm "taking a break" screen with the server\'s words, and a tap asks again', () => {
    mount({ 'mud.token': 'TOK', 'mud.name': 'Alice' });
    act(() => sock().open());
    deliver({ t: 'auth', ok: true, message: 'Welcome back', resumed: true, gap: true });
    deliver({ t: 'error', code: 'kicked', message: 'A GM asked you to take a break for 10 minutes. You can come back after that.' });
    expect(screen.getByRole('heading', { name: 'Taking a break' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('10 minutes');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    act(() => sock().open());
    expect(sock().sentFrames().pop()).toMatchObject({ t: 'resume', token: 'TOK' });
    deliver({ t: 'auth', ok: false, code: 'kicked', message: 'Please try again in about 9 minutes.' });
    expect(screen.getByRole('status')).toHaveTextContent('about 9 minutes');
  });
});
