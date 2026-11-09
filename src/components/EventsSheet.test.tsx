import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import EventsSheet from './EventsSheet';

const soon = () => ({ now: [{ title: 'Feast', ends: Date.now() + 30 * 60000 }], next: [{ title: 'Quiz', at: Date.now() + 3 * 3600000 }] });

describe('EventsSheet', () => {
  it('lists what is on now and what is coming', () => {
    render(<EventsSheet schedule={soon()} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: "What's on" })).toBeInTheDocument();
    expect(screen.getByText('On now: Feast')).toBeInTheDocument();
    expect(screen.getByText('Quiz')).toBeInTheDocument();
  });

  it('says so when nothing is scheduled, and closes', () => {
    const onClose = vi.fn();
    render(<EventsSheet schedule={null} onClose={onClose} />);
    expect(screen.getByText('Nothing is scheduled right now.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
