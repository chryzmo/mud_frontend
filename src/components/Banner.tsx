import { FC, ReactElement, useEffect } from 'react';

interface Props {
  id: number; // a new announcement restarts the timer
  label: string;
  text: string;
  onDismiss: () => void;
}

// How long an announcement stays over the log if nobody dismisses it; it is in the log either way.
export const BANNER_MS = 20000;

// A GM or event announcement, shown above the log so it is not missed while reading room text.
const Banner: FC<Props> = ({ id, label, text, onDismiss }): ReactElement => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, BANNER_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);
  return (
    <div className="banner" role="region" aria-label="Announcement" aria-live="polite">
      <div className="banner-text"><strong>{label}:</strong> {text}</div>
      <button type="button" className="banner-close" aria-label="Dismiss announcement" onClick={onDismiss}>×</button>
    </div>
  );
};

export default Banner;
