import { FC, ReactElement, useRef } from 'react';
import { CLIENT_REPO_URL, ISSUES_URL, NAME, REPO_URL } from '../brand';
import { useDialogFocus } from '../useDialogFocus';

interface Props {
  onClose: () => void;
}

// What ConQuest is, where the code is (the server and the client), and how to send feedback. The links open in a new tab.
const AboutSheet: FC<Props> = ({ onClose }): ReactElement => {
  const sheet = useRef<HTMLDivElement>(null);
  useDialogFocus(sheet);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet about-sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={`About ${NAME}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">About {NAME}</div>
        <p className="about-text">
          {NAME} is a text adventure made as a fun, open-source side project. The game server is written in Go
          and this client is a small React app; both are open source. It is still growing: if something confused you, broke, or
          delighted you, please tell us by opening an issue on GitHub.
        </p>
        <p className="about-text about-signoff">Enjoy exploring!</p>
        <a className="sheet-action about-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">Game server on GitHub</a>
        <a className="sheet-action about-link" href={CLIENT_REPO_URL} target="_blank" rel="noopener noreferrer">Web client on GitHub</a>
        <a className="sheet-action about-link" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">Share feedback: open an issue</a>
        <button type="button" className="sheet-action" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default AboutSheet;
