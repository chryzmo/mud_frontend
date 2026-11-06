import { FC, FormEvent, ReactElement, useState } from 'react';
import { ConnState } from '../net/connection';

interface Props {
  conn: ConnState;
  onLogin: (name: string, password: string) => void;
}

// The staff sign-in, at /staff. Nothing links to it. The password is sent over the same
// secure connection as everything else and kept only in memory, so a reload asks again.
const StaffLogin: FC<Props> = ({ conn, onLogin }): ReactElement => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const busy = conn.phase === 'joining' || conn.phase === 'resuming';
  const error = conn.refusal?.message ?? '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || name.trim() === '' || password === '') return;
    onLogin(name.trim(), password);
  };

  return (
    <div id="login-overlay">
      <div id="login-card">
        <h2 id="login-title">Staff sign-in</h2>
        <form onSubmit={submit} autoComplete="on">
          <div className="login-field">
            <label htmlFor="staff-name">Name</label>
            <input
              id="staff-name" type="text" value={name} autoFocus autoComplete="username"
              autoCapitalize="off" autoCorrect="off" spellCheck={false}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="login-field">
            <label htmlFor="staff-password">Password</label>
            <input
              id="staff-password" type="password" value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button type="submit" id="login-submit-btn" disabled={busy}>{busy ? 'One moment…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
};

export default StaffLogin;
