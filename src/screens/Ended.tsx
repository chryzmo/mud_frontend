import { FC, ReactElement } from 'react';
import { EndReason } from '../net/connection';

interface Props {
  reason: Exclude<EndReason, 'bad_token'>; // a lost token goes to the recovery form instead
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
  bad_version: {
    title: 'Please reload',
    body: 'The game was updated. Reload the page to keep playing.',
    button: 'Reload',
  },
};

const Ended: FC<Props> = ({ reason, onResume }): ReactElement => {
  const t = TEXT[reason];
  return (
    <div id="login-overlay">
      <div id="login-card">
        <h2 id="login-title">{t.title}</h2>
        <p>{t.body}</p>
        <button type="button" id="login-submit-btn" onClick={reason === 'bad_version' ? () => window.location.reload() : onResume}>
          {t.button}
        </button>
      </div>
    </div>
  );
};

export default Ended;
