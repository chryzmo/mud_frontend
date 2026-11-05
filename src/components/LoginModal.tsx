import { FC, FormEvent, ReactElement, useState } from "react";
import { sendLogin, sendRegister } from "../protocol";

interface Props {
  ws: WebSocket;
  error: string;
  onErrorClear: () => void;
}

type Mode = 'login' | 'register';

const LoginModal: FC<Props> = ({ ws, error, onErrorClear }): ReactElement => {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const displayError = localError || error;

  const clearErrors = () => {
    setLocalError('');
    onErrorClear();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    clearErrors();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!username.trim() || !password.trim()) {
      setLocalError('Username and password are required.');
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      sendRegister(ws, username.trim(), password);
    } else {
      sendLogin(ws, username.trim(), password);
    }
  };

  return (
    <div id="login-overlay">
      <div id="login-card">
        <h2 id="login-title">
          {mode === 'login' ? 'Welcome to the MUD' : 'Create a Character'}
        </h2>

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="login-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {mode === 'register' && (
            <div className="login-field">
              <label htmlFor="login-confirm">Confirm Password</label>
              <input
                id="login-confirm"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          {displayError && (
            <div className="login-error">{displayError}</div>
          )}

          <button type="submit" id="login-submit-btn">
            {mode === 'login' ? 'Login' : 'Create Character'}
          </button>
        </form>

        <div id="login-secondary">
          {mode === 'login' ? (
            <>
              <span>New player?</span>
              <button className="login-link-btn" onClick={() => switchMode('register')}>
                Register a new character
              </button>
            </>
          ) : (
            <button className="login-link-btn" onClick={() => switchMode('login')}>
              ← Back to login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
