import { FC, ReactElement, useRef } from 'react';
import { Cosmetics, badgeGlyph } from '../cosmetics';
import { useDialogFocus } from '../useDialogFocus';
import NameTag from './NameTag';

interface Props {
  cosmetics: Cosmetics | null;
  onCommand: (line: string) => void;
  onClose: () => void;
}

// What a player has earned for their name (colours and badges, from quests and bosses): tap one to
// wear it. Everything is an ordinary COSMETIC command; the answer arrives in the log.
const StyleSheet: FC<Props> = ({ cosmetics, onCommand, onClose }): ReactElement => {
  const sheet = useRef<HTMLDivElement>(null);
  useDialogFocus(sheet);
  const owned = cosmetics ?? { colors: [], badges: [] };

  const wear = (key: string) => {
    onCommand('COSMETIC ' + key);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet style-sheet" ref={sheet} role="dialog" aria-modal="true" aria-label="Style" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">Style</div>
        {owned.colors.length + owned.badges.length === 0 ? (
          <div className="sheet-action sheet-empty">You have not earned a colour or badge yet. Quests and bosses give them.</div>
        ) : (
          <>
            <div className="style-label">How your name looks</div>
            <div className="sheet-action sheet-empty"><NameTag name="Your name" color={cosmetics?.color} badge={cosmetics?.badge} /></div>
            {owned.colors.map((c) => (
              <button key={c} type="button" className={'sheet-action' + (c === cosmetics?.color ? ' style-worn' : '')} onClick={() => wear(c)}>
                {c === cosmetics?.color ? `${c} (worn)` : c}
              </button>
            ))}
            {owned.badges.map((b) => (
              <button key={b} type="button" className={'sheet-action' + (b === cosmetics?.badge ? ' style-worn' : '')} onClick={() => wear(b)}>
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

export default StyleSheet;
