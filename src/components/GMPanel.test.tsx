import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GMPanel from './GMPanel';

describe('GMPanel reports and leaderboard buttons', () => {
  const setup = () => {
    const onCommand = vi.fn();
    const onClose = vi.fn();
    render(<GMPanel onCommand={onCommand} onClose={onClose} />);
    return { onCommand, onClose };
  };

  it('lists and closes reports with one tap each', () => {
    const { onCommand, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Open reports' }));
    expect(onCommand).toHaveBeenLastCalledWith('GM REPORTS');
    fireEvent.click(screen.getByRole('button', { name: 'Close all reports' }));
    expect(onCommand).toHaveBeenLastCalledWith('GM REPORTS CLOSE ALL');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('hides and unhides the typed player on the leaderboard, only once a name is typed', () => {
    const { onCommand } = setup();
    const hide = screen.getByRole('button', { name: 'Hide from leaderboard' });
    expect(hide).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Player'), { target: { value: 'bob' } });
    fireEvent.click(hide);
    expect(onCommand).toHaveBeenLastCalledWith('GM HIDE bob');
    fireEvent.click(screen.getByRole('button', { name: 'Unhide' }));
    expect(onCommand).toHaveBeenLastCalledWith('GM UNHIDE bob');
  });
});
