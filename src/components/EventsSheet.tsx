import { FC, ReactElement, useRef } from 'react';
import { Schedule, countdown, current, startLabel } from '../game/events';
import { useDialogFocus } from '../useDialogFocus';

interface Props {
  schedule: Schedule | null;
  onClose: () => void;
}

// What is on now and what is coming, with start times in the player's own time zone.
const EventsSheet: FC<Props> = ({ schedule, onClose }): ReactElement => {
  const sheet = useRef<HTMLDivElement>(null);
  useDialogFocus(sheet);
  const now = Date.now();
  const c = schedule ? current(schedule, now) : { now: [], next: [] };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet events-sheet" ref={sheet} role="dialog" aria-modal="true" aria-label="What's on" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">What's on</div>
        {c.now.length === 0 && c.next.length === 0 && <div className="sheet-action sheet-empty">Nothing is scheduled right now.</div>}
        {c.now.map((e) => (
          <div key={'now-' + e.title} className="sheet-action sheet-empty">
            <strong>On now: {e.title}</strong>
            <div className="events-when">Ends in {countdown(e.ends - now)}</div>
          </div>
        ))}
        {c.next.map((e) => (
          <div key={'next-' + e.title + e.at} className="sheet-action sheet-empty">
            <strong>{e.title}</strong>
            <div className="events-when">{startLabel(e.at)}, in {countdown(e.at - now)}</div>
          </div>
        ))}
        <button type="button" className="sheet-action" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default EventsSheet;
