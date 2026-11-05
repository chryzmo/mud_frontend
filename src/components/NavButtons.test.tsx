import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NavButtons from './NavButtons';

describe('NavButtons', () => {
  it('renders nothing until exits are known', () => {
    const { container } = render(<NavButtons exits={[]} onNavigate={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('enables only the directions the room has', () => {
    render(<NavButtons exits={['N', 'E']} onNavigate={() => {}} />);
    expect(screen.getByRole('button', { name: 'N' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'E' })).toBeEnabled();
    for (const dir of ['S', 'W', 'U', 'D']) {
      expect(screen.getByRole('button', { name: dir })).toBeDisabled();
    }
  });

  it('reports the direction that was tapped', () => {
    const onNavigate = vi.fn();
    render(<NavButtons exits={['S']} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'S' }));
    expect(onNavigate).toHaveBeenCalledWith('S');
  });
});
