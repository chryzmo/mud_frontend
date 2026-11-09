import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import QuickActions from './QuickActions';

describe('QuickActions', () => {
  it('tells assistive tech which buttons open a dialog', () => {
    const noop = vi.fn();
    render(<QuickActions onCommand={noop} onHere={noop} onGuide={noop} onChat={noop} onStyle={noop} onSpells={noop} />);
    for (const name of ['Here', 'Guide', 'Chat', 'Spells', 'Style']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-haspopup', 'dialog');
    }
  });

  it('leaves the plain command buttons alone and sends their command', () => {
    const onCommand = vi.fn();
    render(<QuickActions onCommand={onCommand} />);
    const look = screen.getByRole('button', { name: 'Look' });
    expect(look).not.toHaveAttribute('aria-haspopup');
    fireEvent.click(look);
    expect(onCommand).toHaveBeenCalledWith('LOOK');
    expect(screen.queryByRole('button', { name: 'Here' })).toBeNull();
  });
});
