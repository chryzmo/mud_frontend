import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SpellBar from './SpellBar';
import { SpellInfo } from '../net/frames';

const firebolt: SpellInfo = { key: 'firebolt', name: 'Firebolt', effect: 'bolt', cost: 3, cooldown: 4, desc: 'Fire.' };
const mend: SpellInfo = { key: 'mend', name: 'Mend', effect: 'mend', cost: 4, cooldown: 6, desc: 'Heals.' };

describe('SpellBar', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows nothing until a spell is known', () => {
    const { container } = render(<SpellBar known={[]} ready={['', '', '']} mp={10} onCast={() => {}} onOpen={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('casts the slot that was tapped and opens the sheet from an empty one', () => {
    const onCast = vi.fn();
    const onOpen = vi.fn();
    render(<SpellBar known={[firebolt, mend]} ready={['mend', '', 'firebolt']} mp={10} onCast={onCast} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /Cast Firebolt/ }));
    expect(onCast).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: /Cast Mend/ }));
    expect(onCast).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Slot 2 is empty' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('waits out the cooldown after a cast, counting down, and then works again', () => {
    const onCast = vi.fn();
    render(<SpellBar known={[firebolt]} ready={['firebolt', '', '']} mp={10} onCast={onCast} onOpen={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Cast Firebolt/ }));
    const btn = screen.getByRole('button', { name: /Cast Firebolt.*ready in 4 seconds/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('4s');
    fireEvent.click(btn);
    expect(onCast).toHaveBeenCalledTimes(1); // a disabled button casts nothing

    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole('button', { name: /ready in 2 seconds/ })).toBeDisabled();
    act(() => { vi.advanceTimersByTime(2500); });
    const again = screen.getByRole('button', { name: /Cast Firebolt/ });
    expect(again).toBeEnabled();
    expect(again).toHaveTextContent('3 MP');
  });

  it('says when there is not enough magic but still lets the player try (the server decides)', () => {
    const onCast = vi.fn();
    render(<SpellBar known={[mend]} ready={['mend', '', '']} mp={2} onCast={onCast} onOpen={() => {}} />);
    const btn = screen.getByRole('button', { name: /Cast Mend, 4 magic, not enough magic/ });
    fireEvent.click(btn);
    expect(onCast).toHaveBeenCalledWith(1);
  });
});
