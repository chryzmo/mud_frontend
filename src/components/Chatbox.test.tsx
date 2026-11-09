import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Chatbox, { chatPerf } from './Chatbox';
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

  it('renders only the new line when one arrives, not the whole log', () => {
    const all = lines(1, 502); // the same objects each time, as the reducer keeps them
    const { rerender } = render(<Chatbox entries={all.slice(0, 500)} onSelect={() => {}} />);
    chatPerf.rowRenders = 0;
    rerender(<Chatbox entries={all.slice(1, 501)} onSelect={() => {}} />); // the log is capped: one in, one out
    expect(chatPerf.rowRenders).toBe(1);
    // A parent that passes a new callback on every render must not defeat that.
    chatPerf.rowRenders = 0;
    rerender(<Chatbox entries={all.slice(2, 502)} onSelect={() => {}} />);
    expect(chatPerf.rowRenders).toBe(1);
  });

  it('is a labelled log that screen readers announce additions to', () => {
    render(<Chatbox entries={lines(1, 2)} onSelect={() => {}} />);
    const log = screen.getByRole('log', { name: 'Game log' });
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-relevant', 'additions');
  });
  it('makes names in the log reachable and usable from the keyboard', () => {
    const onSelect = vi.fn();
    const entries: Entry[] = [
      { id: 1, kind: 'player', playerName: 'Bob', actionText: ' waves.' },
      { id: 2, kind: 'combat', npcName: 'Rat', actionText: ' bites you.' },
      { id: 3, kind: 'item', itemName: 'Lamp', actionText: ' is here.' },
    ] as Entry[];
    render(<Chatbox entries={entries} onSelect={onSelect} />);
    const bob = screen.getByRole('button', { name: /Bob/ });
    expect(bob).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(bob, { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('button', { name: /Rat/ }), { key: ' ' });
    fireEvent.click(screen.getByRole('button', { name: /Lamp/ }));
    fireEvent.keyDown(bob, { key: 'a' }); // other keys do nothing
    expect(onSelect.mock.calls).toEqual([
      [{ kind: 'player', name: 'Bob' }],
      [{ kind: 'npc', name: 'Rat' }],
      [{ kind: 'item', name: 'Lamp' }],
    ]);
  });

  it('draws an italic entry in italics', () => {
    render(<Chatbox entries={[{ id: 1, kind: 'italic', text: '(+6 combat XP)' }]} onSelect={() => {}} />);
    expect(screen.getByText('(+6 combat XP)')).toHaveClass('italicText');
  });

  it('draws the quoted words of a SAY, and of your own and a character\'s speech, in their own colours', () => {
    const entries: Entry[] = [
      { id: 1, kind: 'player', playerName: 'bob', actionText: ' says: ', speech: '"hi"' },
      { id: 2, kind: 'mixed', parts: [{ text: 'You say: ' }, { text: '"yo"', tone: 'speechme' }] },
      { id: 3, kind: 'mixed', parts: [{ text: '"Welcome."', tone: 'speechnpc' }] },
    ];
    render(<Chatbox entries={entries} onSelect={() => {}} />);
    expect(screen.getByText('"hi"')).toHaveClass('speech-other');
    expect(screen.getByText('"yo"')).toHaveClass('speech-me');
    expect(screen.getByText('"Welcome."')).toHaveClass('speech-npc');
  });

  it('lets scenery named in a line be tapped or pressed, to examine it', () => {
    const onSelect = vi.fn();
    const entries: Entry[] = [
      { id: 1, kind: 'mixed', parts: [{ text: 'You notice: ' }, { text: 'long counter', tone: 'feature' }, { text: '.' }] },
    ];
    render(<Chatbox entries={entries} onSelect={onSelect} />);
    const link = screen.getByRole('button', { name: 'long counter' });
    expect(link).toHaveClass('feature-link');
    fireEvent.click(link);
    fireEvent.keyDown(link, { key: 'Enter' });
    expect(onSelect.mock.calls).toEqual([[{ kind: 'feature', name: 'long counter' }], [{ kind: 'feature', name: 'long counter' }]]);
  });
});
