import { FC, ReactElement, useRef, useState } from 'react';
import { useDialogFocus } from '../useDialogFocus';

interface Props {
  onCommand: (line: string) => void; // sends a GM command (the "GM " prefix is added here)
  onClose: () => void;
  initialName?: string;
  onName?: (name: string) => void; // remember the last name typed
}

// The game master's phone panel: the GM commands as big buttons, so they can be used one-handed.
// Every action sends an ordinary `GM ...` command; the answer arrives in the log, so the panel closes.
const GMPanel: FC<Props> = ({ onCommand, onClose, initialName = '', onName }): ReactElement => {
  const sheet = useRef<HTMLDivElement>(null);
  useDialogFocus(sheet);
  const [name, setName] = useState(initialName);
  const [announce, setAnnounce] = useState('');
  const [room, setRoom] = useState('');
  const [confirmKick, setConfirmKick] = useState(false);
  const who = name.trim();

  const run = (line: string) => {
    onName?.(who);
    onCommand('GM ' + line);
    onClose();
  };
  const ready = who !== '';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet gm-panel" ref={sheet} role="dialog" aria-modal="true" aria-label="Game master" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">Game master</div>

        <div className="gm-row">
          <button type="button" onClick={() => run('WHO')}>Who is here</button>
          <button type="button" onClick={() => run('LOCK')}>Lock joins</button>
          <button type="button" onClick={() => run('UNLOCK')}>Unlock joins</button>
        </div>

        <label className="gm-label" htmlFor="gm-announce">Announce to everyone</label>
        <div className="gm-row">
          <input id="gm-announce" type="text" value={announce} placeholder="The feast begins at nine!" onChange={(e) => setAnnounce(e.target.value)} />
          <button type="button" disabled={announce.trim() === ''} onClick={() => run('ANNOUNCE ' + announce.trim())}>Announce</button>
        </div>

        <label className="gm-label" htmlFor="gm-name">Player</label>
        <input
          id="gm-name" type="text" value={name} placeholder="Name" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          onChange={(e) => { setName(e.target.value); setConfirmKick(false); }}
        />
        <div className="gm-row">
          <button type="button" disabled={!ready} onClick={() => run(`MUTE ${who} 15`)}>Mute 15 min</button>
          <button type="button" disabled={!ready} onClick={() => run(`MUTE ${who} 60`)}>Mute 1 hour</button>
          <button type="button" disabled={!ready} onClick={() => run(`UNMUTE ${who}`)}>Unmute</button>
        </div>
        <div className="gm-row">
          <button type="button" disabled={!ready} onClick={() => run(`SUMMON ${who}`)}>Summon</button>
          <button type="button" disabled={!ready} onClick={() => run(`TELEPORT ${who}`)}>Go to</button>
          {confirmKick ? (
            <button type="button" className="gm-danger" disabled={!ready} onClick={() => run(`KICK ${who} 10`)}>Really kick {who} for 10 min?</button>
          ) : (
            <button type="button" className="gm-danger" disabled={!ready} onClick={() => setConfirmKick(true)}>Kick 10 min</button>
          )}
        </div>

        <label className="gm-label" htmlFor="gm-room">Go to a room</label>
        <div className="gm-row">
          <input id="gm-room" type="text" value={room} placeholder="Start of the room's name" onChange={(e) => setRoom(e.target.value)} />
          <button type="button" disabled={room.trim() === ''} onClick={() => run('TELEPORT ROOM ' + room.trim())}>Go</button>
        </div>

        <button type="button" className="sheet-action sheet-cancel" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default GMPanel;
