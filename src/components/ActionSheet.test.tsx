import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import ActionSheet from './ActionSheet';

function Host({ run }: { run: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <input aria-label="Command" />
      <button onClick={() => setOpen(true)}>Open</button>
      {open && <ActionSheet title="bob" actions={[{ label: 'Whisper', run }]} onClose={() => setOpen(false)} />}
    </>
  );
}

describe('ActionSheet', () => {
  it('is a modal dialog with focus inside, and gives focus back when it closes', () => {
    render(<Host run={() => {}} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole('dialog', { name: 'bob' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Whisper' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('keeps Tab inside the sheet', () => {
    render(<Host run={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    cancel.focus();
    fireEvent.keyDown(document, { key: 'Tab' }); // from the last button: wrap to the first
    expect(screen.getByRole('button', { name: 'Whisper' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); // and back from the first
    expect(cancel).toHaveFocus();
  });

  it('closes, then runs the chosen action', () => {
    const run = vi.fn();
    render(<Host run={run} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Whisper' }));
    expect(run).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
