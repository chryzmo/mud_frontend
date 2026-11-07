import { describe, expect, it } from 'vitest';
import { bannerText, countdown, current, startLabel } from './events';
import { parseFrame } from '../net/frames';
import { initialGameState, reduce } from './state';

const MIN = 60000;
const HOUR = 60 * MIN;

describe('countdown', () => {
  it('uses the loosest useful words', () => {
    expect(countdown(20000)).toBe('under a minute');
    expect(countdown(12 * MIN)).toBe('12 min');
    expect(countdown(3 * HOUR)).toBe('3 h');
    expect(countdown(72 * HOUR)).toBe('3 days');
  });
});

describe('bannerText', () => {
  const s = { now: [{ title: 'Feast', ends: 1000 + 30 * MIN }], next: [{ title: 'Quiz', at: 1000 + 2 * HOUR }] };
  it('says what is on now, with the time left', () => {
    expect(bannerText(s, 1000)).toBe('On now: Feast, ends in 30 min');
  });
  it('counts the others when several are on', () => {
    const two = { ...s, now: [...s.now, { title: 'Dance', ends: 1000 + HOUR }] };
    expect(bannerText(two, 1000)).toBe('On now: Feast, ends in 30 min (+1 more)');
  });
  it('shows the next event when none is on, and drops what has ended', () => {
    expect(bannerText(s, 1000 + 31 * MIN)).toBe('Next: Quiz, in 89 min');
    expect(bannerText(s, 1000 + 3 * HOUR)).toBeNull();
  });
  it('has nothing to say without a schedule', () => {
    expect(bannerText(null, 0)).toBeNull();
    expect(bannerText({ now: [], next: [] }, 0)).toBeNull();
  });
  it('hides an event whose start has passed until the server says it began', () => {
    expect(current({ now: [], next: [{ title: 'Quiz', at: 500 }] }, 1000).next).toEqual([]);
  });
});

describe('startLabel', () => {
  it('shows a clock time and the con time', () => {
    expect(startLabel(Date.UTC(2027, 0, 7, 17, 0))).toMatch(/\d{1,2}:\d{2}/);
    expect(startLabel(Date.UTC(2027, 0, 7, 17, 0))).toContain('ET');
  });
});

describe('the events frame', () => {
  const raw = JSON.stringify({ t: 'events', now: [{ title: 'Feast', ends: 5 }], next: [{ title: 'Quiz', at: 9 }, 'junk'] });
  it('is read, ignoring bad entries', () => {
    const f = parseFrame(raw);
    expect(f).toEqual({ t: 'events', now: [{ title: 'Feast', ends: 5 }], next: [{ title: 'Quiz', at: 9 }] });
  });
  it('replaces the schedule in the game state, and adds no log line', () => {
    const f = parseFrame(raw);
    const next = reduce(initialGameState(), { type: 'frame', frame: f! });
    expect(next.events).toEqual({ now: [{ title: 'Feast', ends: 5 }], next: [{ title: 'Quiz', at: 9 }] });
    expect(next.log).toHaveLength(0);
  });
});
