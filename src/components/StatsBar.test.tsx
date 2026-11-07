import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsBar from './StatsBar';

describe('StatsBar', () => {
  it('shows current and max HP and MP', () => {
    render(<StatsBar stats={{ hp: 12, maxhp: 20, mp: 3, maxmp: 10, atk: 5, atkbonus: 0, def: 10, defbonus: 0 }} />);
    expect(screen.getByText('12 / 20')).toBeInTheDocument();
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
  });

  it('highlights stats boosted by equipment', () => {
    render(<StatsBar stats={{ hp: 20, maxhp: 20, mp: 10, maxmp: 10, atk: 10, atkbonus: 5, def: 10, defbonus: 0 }} />);
    expect(screen.getByText('10', { selector: '.stat-boosted' })).toBeInTheDocument();
  });

  it('shows level and XP toward the next level, or just XP at the top', () => {
    const base = { hp: 20, maxhp: 20, mp: 10, maxmp: 10, atk: 5, atkbonus: 0, def: 10, defbonus: 0 };
    const { rerender } = render(<StatsBar stats={{ ...base, level: 2, xp: 25, next: 60 }} />);
    expect(screen.getByLabelText('Your stats')).toHaveTextContent('LV2 · 25/60 XP');
    rerender(<StatsBar stats={{ ...base, level: 10, xp: 1200, next: 0 }} />);
    expect(screen.getByLabelText('Your stats')).toHaveTextContent('LV10 · 1200 XP');
  });

  it('shows no level row for a server that does not send one', () => {
    render(<StatsBar stats={{ hp: 20, maxhp: 20, mp: 10, maxmp: 10, atk: 5, atkbonus: 0, def: 10, defbonus: 0 }} />);
    expect(screen.queryByText('LV')).toBeNull();
  });
});
