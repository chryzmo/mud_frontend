import { FC, FormEvent, ReactElement, useState } from 'react';
import { ConnState } from '../net/connection';

interface Props {
  conn: ConnState;
  savedName: string;
  notice?: string; // why the player is here, e.g. the session was lost
  startInRecover?: boolean;
  onJoin: (name: string) => void;
  onRecover: (name: string, code: string) => void;
}

// What to tell the player about a refused join or recovery.
function refusalText(conn: ConnState): string {
  const r = conn.refusal;
  if (!r) return '';
  if (r.code === 'recovery_locked' && r.retryMs) {
    return `Too many wrong codes for that name. Try again in ${Math.ceil(r.retryMs / 60000)} minutes.`;
  }
  return r.message;
}

const Landing: FC<Props> = ({ conn, savedName, notice, startInRecover, onJoin, onRecover }): ReactElement => {
  const [recovering, setRecovering] = useState(!!startInRecover);
  const [name, setName] = useState(recovering ? savedName : '');
  const [code, setCode] = useState('');
  const busy = conn.phase === 'joining' || conn.phase === 'recovering';
  const waiting = busy && conn.waitReason === 'rate_limited';
  const error = refusalText(conn);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || name.trim() === '') return;
    if (recovering) onRecover(name.trim(), code.trim());
    else onJoin(name.trim());
  };

  return (
    <div id="login-overlay">
      <div id="login-card">
        <h2 id="login-title">{recovering ? 'Recover your character' : 'Welcome to the MUD'}</h2>
        {notice && <div className="login-note">{notice}</div>}
        <form onSubmit={submit} autoComplete="off">
          <div className="login-field">
            <label htmlFor="landing-name">{recovering ? 'Character name' : 'Pick a name'}</label>
            <input
              id="landing-name" type="text" value={name} autoFocus
              autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint={recovering ? 'next' : 'go'}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {recovering && (
            <div className="login-field">
              <label htmlFor="landing-code">Recovery code</label>
              <input
                id="landing-code" type="text" value={code}
                autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="go"
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          )}
          {error && <div className="login-error" role="alert">{error}</div>}
          {waiting && <div className="login-note">Lots of players are joining. Trying again in a moment…</div>}
          <button type="submit" id="login-submit-btn" disabled={busy}>
            {busy ? 'One moment…' : recovering ? 'Recover' : 'Play'}
          </button>
        </form>
        <div id="login-secondary">
          <button className="login-link-btn" onClick={() => setRecovering(!recovering)}>
            {recovering ? '← Back' : 'I have a recovery code'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Landing;
