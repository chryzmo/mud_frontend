// How long to wait before the next connection attempt. The jitter spreads a crowd
// of phones out after a restart; the server's join limit is the backstop.
// Numbers follow the reconnect-storm bot (mud_server/src/internal/mudbot/storm.go),
// which survived 5,000 simultaneous clients.

export type Random = () => number; // uniform in [0, 1)

const FIRST_RETRY_JITTER_MS = 1000; // a single dropped connection is usually a blip: come back fast
const RESTART_JITTER_MS = 5000; // the server said it is restarting: a crowd is coming back
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 10000;
const BACKOFF_JITTER_MS = 5000;
const RETRY_HINT_JITTER_MS = 500; // on top of the server's own jitter
const RETURN_JITTER_MS = 1000; // the page came back to the foreground, or the network did

// reconnectDelay is the wait before attempt number `attempt` (0 is the first retry
// after a drop), then exponential backoff with jitter.
export function reconnectDelay(attempt: number, random: Random, afterRestart = false): number {
  if (attempt <= 0) return random() * (afterRestart ? RESTART_JITTER_MS : FIRST_RETRY_JITTER_MS);
  const backoff = Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_CAP_MS);
  return backoff + random() * BACKOFF_JITTER_MS;
}

// retryHintDelay is how long to wait when the server said `retry_ms`: exactly that,
// plus a little jitter. Not a failure to back off from.
export const retryHintDelay = (retryMs: number, random: Random): number => retryMs + random() * RETRY_HINT_JITTER_MS;

// returnDelay is the short, jittered wait used when the page becomes visible or the
// network comes back, instead of whatever backoff was running.
export const returnDelay = (random: Random): number => random() * RETURN_JITTER_MS;
