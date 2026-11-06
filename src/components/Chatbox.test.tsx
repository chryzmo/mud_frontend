import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Chatbox from './Chatbox';
import { Entry } from '../game/entries';

const lines = (from: number, to: number): Entry[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i, kind: 'plain', text: `line ${from + i}` }));

// jsdom has no layout, so give the log a size: 1000 px of content in a 200 px window.
function sizeLog(scrollTop: number) {
  const box = document.getElementById('chatbox')!;
  Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 1000 });
  Object.defineProperty(box, 'clientHeight', { configurable: true, value: 200 });
  box.scrollTop = scrollTop;
  fireEvent.scroll(box);
  return box;
}

describe('Chatbox', () => {
  it('follows new lines while the player is at the bottom', () => {
    const { rerender } = render(<Chatbox entries={lines(1, 3)} onSelect={() => {}} />);
    const box = sizeLog(800); // at the bottom
    rerender(<Chatbox entries={lines(1, 4)} onSelect={() => {}} />);
    expect(box.scrollTop).toBe(1000);
    expect(screen.queryByRole('button', { name: /new|Latest/ })).toBeNull();
  });

  it('leaves a reader who scrolled up where they are, and counts what they missed', () => {
    const { rerender } = render(<Chatbox entries={lines(1, 3)} onSelect={() => {}} />);
    const box = sizeLog(100); // scrolled up
    expect(screen.getByRole('button', { name: '↓ Latest' })).toBeInTheDocument();
    rerender(<Chatbox entries={lines(1, 5)} onSelect={() => {}} />);
    expect(box.scrollTop).toBe(100);
    expect(screen.getByRole('button', { name: '↓ 2 new' })).toBeInTheDocument();
  });

  it('jumps to the latest line on tap and hides the button', () => {
    render(<Chatbox entries={lines(1, 3)} onSelect={() => {}} />);
    const box = sizeLog(100);
    fireEvent.click(screen.getByRole('button', { name: '↓ Latest' }));
    expect(box.scrollTop).toBe(1000);
    expect(screen.queryByRole('button', { name: /Latest/ })).toBeNull();
  });

  it('reports what kind of name was tapped', () => {
    const onSelect = vi.fn();
    const entries: Entry[] = [
      { id: 1, kind: 'player', playerName: 'bob', actionText: ' says: "hi"' },
      { id: 2, kind: 'combat', npcName: 'Grak', actionText: ' snarls.' },
      { id: 3, kind: 'item', itemName: 'sword', actionText: ' lies here.' },
    ];
    render(<Chatbox entries={entries} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('bob'));
    fireEvent.click(screen.getByText('Grak'));
    fireEvent.click(screen.getByText('sword'));
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual([
      { kind: 'player', name: 'bob' }, { kind: 'npc', name: 'Grak' }, { kind: 'item', name: 'sword' },
    ]);
  });
});
