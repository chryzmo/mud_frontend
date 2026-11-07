import { FC, ReactElement, useEffect, useState } from 'react';
import { Schedule, bannerText } from '../game/events';

interface Props {
  schedule: Schedule | null;
  onOpen: () => void;
}

// Re-reads the clock every 30 s while there is something to count down.
function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

// One line under the header: the event on now with its time left, or the next one with a countdown.
// Tapping it opens the full list. It draws nothing when no event is on or coming.
const EventBar: FC<Props> = ({ schedule, onOpen }): ReactElement | null => {
  const now = useNow(schedule !== null);
  const text = bannerText(schedule, now);
  if (text === null) return null;
  return (
    <button type="button" className="eventbar" aria-label={`${text}. Open the event list`} onClick={onOpen}>
      {text}
    </button>
  );
};

export default EventBar;
