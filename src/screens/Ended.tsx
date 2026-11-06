import { FC, ReactElement } from 'react';
import { EndReason } from '../net/connection';

interface Props {
  reason: Exclude<EndReason, 'bad_token'>; // a lost token goes to the recovery form instead
  message?: string; // the server's own words, if it gave any (a kick says for how long)
  onResume: () => void;
}

const TEXT: Record<Props['reason'], { title: string; body: string; button: string }> = {
  idle: {
    title: 'Still there?',
    body: 'You were away for a while, so we paused your character to make room for others.',
    button: 'Back to the game',
  },
  replaced: {
    title: 'Opened somewhere else',
    body: 'This character was opened on another device or tab. Only one can play at a time.',
    button: 'Play here instead',
  },
  kicked: {
    title: 'Taking a break',
    body: 'A GM asked you to take a short break from the game. Your character is safe, and you can come back when it is over.',
    button: 'Try again',
  },
  bad_version: {
    title: 'Please reload',
    body: 'The game was updated. Reload the page to keep playing.',
    button: 'Reload',
  },
};

const Ended: FC<Props> = ({ reason, message, onResume }): ReactElement => {
  const t = TEXT[reason];
  return (
    <div id="login-overlay">
      <div id="login-card">
        <h2 id="login-title">{t.title}</h2>
        <p>{t.body}</p>
        {reason === 'kicked' && message && <div className="login-note" role="status">{message}</div>}
        <button type="button" id="login-submit-btn" onClick={reason === 'bad_version' ? () => window.location.reload() : onResume}>
          {t.button}
        </button>
      </div>
    </div>
  );
};

export default Ended;
