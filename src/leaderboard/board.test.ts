import { describe, expect, it, vi } from 'vitest';
import { Board, parseBoard, renderBoard } from './board';

const sample = {
  updated: '2027-01-08T12:00:00Z', total: 3,
  overall: [
    { name: 'Ann', level: 3, xp: 120, explore: 100, combat: 20, color: 'gold', badge: 'star' },
    { name: 'Bob', level: 2, xp: 30, explore: 10, combat: 20 },
  ],
  explorers: [{ name: 'Ann', level: 3, xp: 120, explore: 100, combat: 20 }],
  fighters: [],
};

const root = () => {
  document.body.innerHTML = '<main id="board"></main>';
  return document.getElementById('board')!;
};
const draw = (board: Board | null, tab: 'overall' | 'explorers' | 'fighters' = 'overall', stale = false, onTab = () => {}) => {
  const r = root();
  renderBoard(r, { board, tab, stale }, onTab);
  return r;
};

describe('parseBoard', () => {
  it('reads a leaderboard and skips a bad entry instead of failing', () => {
    const b = parseBoard({ ...sample, overall: [...sample.overall, { name: 5 }, null, { name: '' }] })!;
    expect(b.overall.map((e) => e.name)).toEqual(['Ann', 'Bob']);
    expect(b.total).toBe(3);
    expect(b.fighters).toEqual([]);
  });
  it('rejects what is not a leaderboard', () => {
    for (const bad of [null, 'x', [], {}, { overall: 'no' }]) expect(parseBoard(bad)).toBeNull();
  });
  it('tolerates missing tabs and numbers', () => {
    const b = parseBoard({ overall: [{ name: 'Z' }] })!;
    expect(b.overall[0]).toMatchObject({ name: 'Z', level: 1, xp: 0 });
    expect(b.explorers).toEqual([]);
  });
});

describe('renderBoard', () => {
  it('lists each tab with its own score, level and the cosmetics the player chose', () => {
    const board = parseBoard(sample)!;
    const r = draw(board);
    const rows = [...r.querySelectorAll('.row')];
    expect(rows).toHaveLength(2);
    expect([...rows].map((r) => r.querySelector('.rank')!.textContent)).toEqual(['1', '2']);
    expect(rows[0].textContent).toContain('Ann');
    expect(rows[0].textContent).toContain('Level 3');
    expect(rows[0].textContent).toContain('120 XP');
    expect(rows[0].querySelector('.name.nc-gold')).not.toBeNull();
    expect(rows[0].querySelector('[role=img]')?.getAttribute('aria-label')).toBe('star badge');
    expect(rows[1].querySelector('.nc-gold')).toBeNull();
    expect(draw(board, 'explorers').querySelector('.row')!.textContent).toContain('100 exploring');
    expect(r.textContent).toContain('3 players ranked');
  });

  it('marks the active tab and reports a tap on another', () => {
    const onTab = vi.fn();
    const r = draw(parseBoard(sample)!, 'overall', false, onTab);
    const tabs = [...r.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    tabs[2].click();
    expect(onTab).toHaveBeenCalledWith('fighters');
  });

  it('says so when a tab is empty, while loading, and when a refresh failed', () => {
    expect(draw(parseBoard(sample)!, 'fighters').textContent).toContain('No one here yet');
    expect(draw(null).textContent).toContain('Loading');
    expect(draw(null, 'overall', true).textContent).toContain('Could not load');
    expect(draw(parseBoard(sample)!, 'overall', true).textContent).toContain('showing the last list');
  });

  it('shows names as text, never as markup, and ignores hostile cosmetic keys', () => {
    const nasty = '<img src=x onerror=alert(1)>';
    const r = draw(parseBoard({ ...sample, total: 1, overall: [{ name: nasty, level: 1, xp: 1, explore: 1, combat: 0, color: 'x" onclick="y', badge: '<b>' }] })!);
    expect(r.querySelector('img')).toBeNull();
    expect(r.querySelector('.name')!.textContent).toBe(nasty);
    expect(r.querySelector('.name')!.className).toBe('name');
    expect(r.querySelector('[role=img]')).toBeNull();
  });
});
