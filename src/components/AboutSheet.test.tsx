import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AboutSheet from './AboutSheet';
import { ISSUES_URL, REPO_URL } from '../brand';

describe('AboutSheet', () => {
  it('says what ConQuest is and links to the code and to a new issue, in a new tab', () => {
    render(<AboutSheet onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'About ConQuest' });
    expect(dialog).toHaveTextContent('open-source side project');
    const code = screen.getByRole('link', { name: 'View the code on GitHub' });
    expect(code).toHaveAttribute('href', REPO_URL);
    const feedback = screen.getByRole('link', { name: 'Share feedback: open an issue' });
    expect(feedback).toHaveAttribute('href', ISSUES_URL);
    for (const a of [code, feedback]) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
    expect(ISSUES_URL).toBe('https://github.com/chryzmo/mud_server/issues/new');
  });

  it('closes from the Close button and from a tap on the backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<AboutSheet onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(container.querySelector('.sheet-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
