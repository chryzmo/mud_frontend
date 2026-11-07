import { FC, FormEvent, ReactElement, useRef, useState } from 'react';
import { Cosmetics, badgeGlyph } from '../cosmetics';
import { useDialogFocus } from '../useDialogFocus';
import NameTag from './NameTag';

interface Props {
  cosmetics: Cosmetics | null;
  onCommand: (line: string) => void;
  onClose: () => void;
}

// Sticker codes and what they unlocked: type a code to redeem it, tap a colour or badge to wear it.
// Everything is an ordinary command (REDEEM, COSMETIC); the answer arrives in the log.
const StickerSheet: FC<Props> = ({ cosmetics, onCommand, onClose }): ReactElement => {
  const sheet = useRef<HTMLDivElement>(null);
  useDialogFocus(sheet);
  const [code, setCode] = useState('');
  const owned = cosmetics ?? { colors: [], badges: [] };

  const redeem = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim() === '') return;
    onCommand('REDEEM ' + code.trim());
    onClose();
  };
  const wear = (key: string) => {
    onCommand('COSMETIC ' + key);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sticker-sheet" ref={sheet} role="dialog" aria-modal="true" aria-label="Stickers" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">Stickers</div>
        <form onSubmit={redeem}>
          <label className="sticker-label" htmlFor="sticker-code">Code from a sticker</label>
          <div className="sticker-row">
            <input
              id="sticker-code" type="text" value={code} placeholder="ABCD-2345" autoCapitalize="characters"
              autoCorrect="off" autoComplete="off" spellCheck={false} onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" disabled={code.trim() === ''}>Redeem</button>
          </div>
        </form>
        {owned.colors.length + owned.badges.length > 0 && (
          <>
            <div className="sticker-label">How your name looks</div>
            <div className="sheet-action sheet-empty"><NameTag name="Your name" color={cosmetics?.color} badge={cosmetics?.badge} /></div>
            {owned.colors.map((c) => (
              <button key={c} type="button" className={'sheet-action' + (c === cosmetics?.color ? ' sticker-worn' : '')} onClick={() => wear(c)}>
                {c === cosmetics?.color ? `${c} (worn)` : c}
              </button>
            ))}
            {owned.badges.map((b) => (
              <button key={b} type="button" className={'sheet-action' + (b === cosmetics?.badge ? ' sticker-worn' : '')} onClick={() => wear(b)}>
                {badgeGlyph(b)} {b === cosmetics?.badge ? `${b} (worn)` : b}
              </button>
            ))}
            <button type="button" className="sheet-action" onClick={() => wear('OFF')}>Take both off</button>
          </>
        )}
        <button type="button" className="sheet-action sheet-cancel" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default StickerSheet;
