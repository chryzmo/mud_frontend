import { describe, expect, it } from 'vitest';
import { reconnectDelay, retryHintDelay, returnDelay } from './backoff';

describe('reconnectDelay', () => {
  it('comes back within a second after a single drop', () => {
    expect(reconnectDelay(0, () => 0)).toBe(0);
    expect(reconnectDelay(0, () => 0.999)).toBeLessThan(1000);
  });

  it('spreads a crowd over five seconds after the server said it is restarting', () => {
    expect(reconnectDelay(0, () => 0.999, true)).toBeGreaterThan(4900);
    expect(reconnectDelay(0, () => 0.999, true)).toBeLessThan(5000);
  });

  it('then backs off exponentially to a cap, with up to five seconds of jitter', () => {
    const none = (attempt: number) => reconnectDelay(attempt, () => 0);
    expect([1, 2, 3, 4, 5, 6, 20].map(none)).toEqual([1000, 2000, 4000, 8000, 10000, 10000, 10000]);
    expect(reconnectDelay(3, () => 0.999)).toBeGreaterThan(4000 + 4900);
    expect(reconnectDelay(3, () => 0.999)).toBeLessThan(4000 + 5000);
  });
});

describe('retryHintDelay', () => {
  it('waits what the server said, plus a little jitter, and never backs off further', () => {
    expect(retryHintDelay(1200, () => 0)).toBe(1200);
    expect(retryHintDelay(1200, () => 0.999)).toBeLessThan(1200 + 500);
    expect(retryHintDelay(1200, () => 0.5)).toBe(retryHintDelay(1200, () => 0.5));
  });
});

describe('returnDelay', () => {
  it('is short', () => {
    expect(returnDelay(() => 0.999)).toBeLessThan(1000);
  });
});
