import { FC, ReactElement, useState } from 'react';

interface Props {
  code: string;
  onConfirm: () => void;
}

// copyText puts text on the clipboard. The async API exists only on secure pages
// (https, localhost); elsewhere, such as a dev server on a LAN address, fall back
// to selecting a hidden field and the old copy command.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.top = '0';
  field.style.opacity = '0';
  document.body.appendChild(field);
  try {
    field.select();
    field.setSelectionRange(0, text.length); // iOS ignores select() on its own
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(field);
  }
}

// Shown once, after joining or recovering. It cannot be skipped: it is the only way
// back into the character if this browser forgets it.
const RecoveryCode: FC<Props> = ({ code, onConfirm }): ReactElement => {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    setCopied((await copyText(code)) ? 'yes' : 'failed');
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
          <button type="button" onClick={copy}>{copied === 'yes' ? 'Copied' : 'Copy'}</button>
          {canShare && <button type="button" onClick={share}>Share</button>}
        </div>
        {copied === 'failed' && <div className="login-note">Could not copy. Touch and hold the code to select it, or take a screenshot.</div>}
        <label className="recovery-confirm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved my code
        </label>
        <button type="button" id="login-submit-btn" disabled={!saved} onClick={onConfirm}>Start playing</button>
      </div>
    </div>
  );
};

export default RecoveryCode;
