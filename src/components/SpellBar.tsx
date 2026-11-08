import { FC, ReactElement, useEffect, useState } from 'react';
import { SpellInfo } from '../net/frames';

interface Props {
  known: SpellInfo[];
  ready: string[]; // the spell key in each of the three slots, empty when free
  mp: number | undefined;
  onCast: (slot: number) => void; // slot 1 to 3
  onOpen: () => void; // the Spells sheet: an empty slot opens it to fill the bar
}

const SLOTS = 3;

// The three readied spells, one tap each. A button waits out its spell's cooldown (counted on this
// device from the tap, a courtesy: the server holds the real cooldown) and is dimmed when the
// player lacks the magic for it. Tapping an empty slot opens the Spells sheet.
const SpellBar: FC<Props> = ({ known, ready, mp, onCast, onOpen }): ReactElement | null => {
  const [until, setUntil] = useState<Record<string, number>>({});
  const [, tick] = useState(0);
  const cooling = Object.values(until).some((t) => t > Date.now());
  useEffect(() => {
    if (!cooling) return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [cooling]);

  if (known.length === 0) return null;
  const byKey = new Map(known.map((s) => [s.key, s]));
  return (
    <div className="spellbar" role="group" aria-label="Spells">
      {Array.from({ length: SLOTS }, (_, i) => {
        const spell = byKey.get(ready[i] ?? '');
        if (!spell) {
          return (
            <button key={i} type="button" className="spell-btn spell-empty" onClick={onOpen} aria-label={`Slot ${i + 1} is empty`}>
              +
            </button>
          );
        }
        const wait = Math.max(0, Math.ceil(((until[spell.key] ?? 0) - Date.now()) / 1000));
        const tooDear = mp !== undefined && mp < spell.cost;
        return (
          <button
            key={i}
            type="button"
            className={'spell-btn' + (wait > 0 ? ' spell-cooling' : '') + (tooDear ? ' spell-dear' : '')}
            disabled={wait > 0}
            aria-label={`Cast ${spell.name}, ${spell.cost} magic${tooDear ? ', not enough magic' : ''}${wait > 0 ? `, ready in ${wait} seconds` : ''}`}
            onClick={() => {
              setUntil((u) => ({ ...u, [spell.key]: Date.now() + spell.cooldown * 1000 }));
              onCast(i + 1);
            }}
          >
            <span className="spell-name">{spell.name}</span>
            <span className="spell-cost">{wait > 0 ? `${wait}s` : `${spell.cost} MP`}</span>
          </button>
        );
      })}
    </div>
  );
};

export default SpellBar;
