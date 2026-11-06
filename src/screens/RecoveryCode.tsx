import { FC, ReactElement, useState } from 'react';

interface Props {
  code: string;
  onConfirm: () => void;
}

// Shown once, after joining or recovering. It cannot be skipped: it is the only way
// back into the character if this browser forgets it.
const RecoveryCode: FC<Props> = ({ code, onConfirm }): ReactElement => {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false); // the code is selectable on screen as the fallback
    }
  };
  const share = () => {
    navigator.share({ text: `My MUD recovery code: ${code}` }).catch(() => {});
  };

  return (
    <div id="login-overlay">
      <div id="login-card">
        <h2 id="login-title">Save your recovery code</h2>
        <p>If this phone forgets you, this code is the only way back to your character. Screenshot it or copy it somewhere safe.</p>
        <div className="recovery-code" data-testid="recovery-code">{code}</div>
        <div className="recovery-actions">
          <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          {canShare && <button type="button" onClick={share}>Share</button>}
        </div>
        <label className="recovery-confirm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved my code
        </label>
        <button type="button" id="login-submit-btn" disabled={!saved} onClick={onConfirm}>Start playing</button>
      </div>
    </div>
  );
};

export default RecoveryCode;
