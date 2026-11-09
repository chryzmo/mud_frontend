import { FC, ReactElement, useRef } from 'react';
import { ISSUES_URL, NAME, REPO_URL } from '../brand';
import { useDialogFocus } from '../useDialogFocus';

interface Props {
  onClose: () => void;
}

// What ConQuest is, where the code is, and how to send feedback. The links open in a new tab.
const AboutSheet: FC<Props> = ({ onClose }): ReactElement => {
  const sheet = useRef<HTMLDivElement>(null);
  useDialogFocus(sheet);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet about-sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={`About ${NAME}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">About {NAME}</div>
        <p className="about-text">
          {NAME} is a text adventure made as a fun, open-source side project for MAGFest 2027. The game server is written in Go
          and this client is a small React app; both are open source. The Hall's rooms, puzzles and people are the one part kept
          secret, so you can find them by playing. It is still growing: if something confused you, broke, or delighted you, please
          tell us by opening an issue on GitHub.
        </p>
        <a className="sheet-action about-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">View the code on GitHub</a>
        <a className="sheet-action about-link" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">Share feedback: open an issue</a>
        <button type="button" className="sheet-action" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default AboutSheet;
