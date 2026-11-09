import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AboutSheet from './AboutSheet';
import { CLIENT_REPO_URL, ISSUES_URL, REPO_URL } from '../brand';

describe('AboutSheet', () => {
  it('says what ConQuest is and links to both repositories and to a new issue, in a new tab', () => {
    render(<AboutSheet onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'About ConQuest' });
    expect(dialog).toHaveTextContent('open-source side project');
    expect(dialog).toHaveTextContent('Enjoy exploring!');
    expect(dialog).not.toHaveTextContent(/secret|AI\b/i); // nothing hints that there is something hidden, or mentions AI
    const server = screen.getByRole('link', { name: 'Game server on GitHub' });
    expect(server).toHaveAttribute('href', REPO_URL);
    const client = screen.getByRole('link', { name: 'Web client on GitHub' });
    expect(client).toHaveAttribute('href', CLIENT_REPO_URL);
    const feedback = screen.getByRole('link', { name: 'Share feedback: open an issue' });
    expect(feedback).toHaveAttribute('href', ISSUES_URL);
    for (const a of [server, client, feedback]) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
    expect(REPO_URL).toBe('https://github.com/chryzmo/mud_server');
    expect(CLIENT_REPO_URL).toBe('https://github.com/chryzmo/mud_frontend');
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
