import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Chatbox from './components/Chatbox';
import NameTag from './components/NameTag';
import StyleSheet from './components/StyleSheet';
import { badgeGlyph, BADGES, colorClass, COLORS } from './cosmetics';
import { frameLines } from './game/entries';
import { initialGameState, reduce } from './game/state';
import { parseFrame } from './net/frames';

// Cosmetics (mud_server#68, #83): fixed keys on the frames that name a player, and a `cosmetics` frame.

describe('cosmetic frames', () => {
  it('reads color and badge on the frames that name a player, and leaves them out when absent', () => {
    expect(parseFrame('{"t":"say","who":"a","text":"hi","color":"gold","badge":"star"}')).toEqual({ t: 'say', who: 'a', text: 'hi', color: 'gold', badge: 'star' });
    expect(parseFrame('{"t":"chat","who":"a","text":"hi","ch":"global","color":"rose"}')).toMatchObject({ t: 'chat', color: 'rose', badge: undefined });
    expect(parseFrame('{"t":"arrive","who":"a","badge":"bell"}')).toMatchObject({ badge: 'bell' });
    expect(parseFrame('{"t":"leave","who":"a","to":"N","color":"azure"}')).toMatchObject({ color: 'azure', to: 'N' });
    expect(parseFrame('{"t":"say","who":"a","text":"hi"}')).toMatchObject({ color: undefined, badge: undefined });
  });

  it('parses the cosmetics frame, tolerating missing lists', () => {
    expect(parseFrame('{"t":"cosmetics","colors":["gold"],"badges":[],"color":"gold"}')).toEqual({ t: 'cosmetics', colors: ['gold'], badges: [], color: 'gold', badge: undefined });
    expect(parseFrame('{"t":"cosmetics"}')).toMatchObject({ t: 'cosmetics', colors: [], badges: [] });
  });

  it('carries them into the log lines', () => {
    expect(frameLines({ t: 'say', who: 'a', text: 'hi', color: 'gold', badge: 'star' })[0]).toMatchObject({ kind: 'player', color: 'gold', badge: 'star' });
    expect(frameLines({ t: 'arrive', who: 'a', color: 'gold' })[0]).toMatchObject({ color: 'gold' });
    expect(frameLines({ t: 'chat', who: 'a', text: 'x', gm: false, badge: 'key' })[0]).toMatchObject({ kind: 'chat', badge: 'key' });
  });

  it('keeps what the player owns in the game state, and a fresh character starts without any', () => {
    let s = reduce(initialGameState(), { type: 'frame', frame: { t: 'cosmetics', colors: ['gold'], badges: ['star'], color: 'gold', badge: 'star' } });
    expect(s.cosmetics).toEqual({ colors: ['gold'], badges: ['star'], color: 'gold', badge: 'star' });
    s = reduce(s, { type: 'welcome', resumed: true, gap: false });
    expect(s.cosmetics).not.toBeNull();
    s = reduce(s, { type: 'welcome', resumed: false, gap: false });
    expect(s.cosmetics).toBeNull();
  });
});

describe('the fixed palette', () => {
  it('draws only keys it knows', () => {
    for (const c of COLORS) expect(colorClass(c)).toBe(`nc-${c}`);
    for (const b of BADGES) expect(badgeGlyph(b)).toBeTruthy();
    for (const bad of ['red', 'gold; background:url(x)', '', undefined, '__proto__', 'constructor']) {
      expect(colorClass(bad)).toBeUndefined();
      expect(badgeGlyph(bad)).toBeUndefined();
    }
  });

  it('renders a name with its colour and badge, and a plain name for an unknown key', () => {
    const { container, rerender } = render(<NameTag name="Ann" color="gold" badge="star" />);
    expect(container.querySelector('.nc-gold')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'star badge' })).toHaveTextContent('★');
    rerender(<NameTag name="Ann" color="evil" badge="evil" />);
    expect(container.querySelector('[class]')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(container).toHaveTextContent('Ann');
  });

  it('shows cosmetics on log lines and global chat', () => {
    const { container } = render(
      <Chatbox
        onSelect={() => {}}
        entries={[
          { id: 1, kind: 'player', playerName: 'Ann', actionText: ' says: "hi"', color: 'crimson', badge: 'crown' },
          { id: 2, kind: 'chat', who: 'Bob', text: 'hello', gm: false, color: 'azure' },
        ]}
      />,
    );
    expect(container.querySelector('.playerNameSpan.nc-crimson')).toHaveTextContent('Ann');
    expect(container.querySelector('.chatWho.nc-azure')).toHaveTextContent('Bob');
  });
});

describe('StyleSheet', () => {
  const setup = (cosmetics: Parameters<typeof StyleSheet>[0]['cosmetics']) => {
    const onCommand = vi.fn();
    const onClose = vi.fn();
    render(<StyleSheet cosmetics={cosmetics} onCommand={onCommand} onClose={onClose} />);
    return { onCommand, onClose };
  };

  it('says how to earn one before any is owned, and has no code box', () => {
    setup(null);
    expect(screen.getByText(/Quests and bosses give them/)).toBeInTheDocument();
    expect(screen.queryByText('Take both off')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Redeem' })).toBeNull();
  });

  it('lists what is owned, marks what is worn, and sends COSMETIC for a tap', () => {
    const { onCommand } = setup({ colors: ['gold', 'rose'], badges: ['star'], color: 'gold' });
    expect(screen.getByRole('button', { name: 'gold (worn)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'rose' }));
    expect(onCommand).toHaveBeenLastCalledWith('COSMETIC rose');
    fireEvent.click(screen.getByRole('button', { name: /star/ }));
    expect(onCommand).toHaveBeenLastCalledWith('COSMETIC star');
    fireEvent.click(screen.getByRole('button', { name: 'Take both off' }));
    expect(onCommand).toHaveBeenLastCalledWith('COSMETIC OFF');
  });
});

describe('QuickActions', () => {
  it('shows a Style button only when it can open something', async () => {
    const { default: QuickActions } = await import('./components/QuickActions');
    const open = vi.fn();
    const { rerender } = render(<QuickActions onCommand={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Style' })).toBeNull();
    rerender(<QuickActions onCommand={() => {}} onStyle={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Style' }));
    expect(open).toHaveBeenCalled();
  });
});
