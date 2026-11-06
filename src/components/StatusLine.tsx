import { FC, ReactElement, useEffect, useState } from 'react';
import { ConnState } from '../net/connection';

// The text above the log when the game is not live, or empty. With a retry time, it
// counts down to it.
export function statusText(conn: ConnState, now: number): string {
  if (conn.offline) return 'You are offline. Waiting for the network…';
  const wait = conn.retryAt === undefined ? '' : ` in ${Math.max(1, Math.ceil((conn.retryAt - now) / 1000))}s`;
  if (conn.phase === 'resuming') return 'Reconnecting…';
  if (conn.phase === 'reconnecting') {
    if (conn.waitReason === 'server_restarting') return `The game is restarting. Reconnecting${wait}…`;
    if (conn.waitReason === 'at_capacity') return `The game is full. Trying again${wait}…`;
    return `Connection lost. Reconnecting${wait}…`;
  }
  return '';
}

// Ticks while a countdown is showing, so "in 4s" counts down.
function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return active ? now : Date.now();
}

interface Props {
  conn: ConnState;
  onRetry: () => void;
}

const StatusLine: FC<Props> = ({ conn, onRetry }): ReactElement | null => {
  const counting = conn.phase === 'reconnecting' && conn.retryAt !== undefined;
  const text = statusText(conn, useNow(counting));
  const canRetry = conn.phase === 'reconnecting' || conn.phase === 'resuming';
  return (
    <>
      {!conn.persistent && (
        <div className="statusline warn" role="note">
          This browser is not saving your login, so reloading would lose your character. Keep your recovery code.
        </div>
      )}
      {text && (
        <div className="statusline" role="status">
          <span>{text}</span>
          {canRetry && <button type="button" className="statusline-retry" onClick={onRetry}>Retry now</button>}
        </div>
      )}
    </>
  );
};

export default StatusLine;
