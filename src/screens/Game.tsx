import { FC, ReactElement, useEffect, useRef, useState } from 'react';
import Chatbox from '../components/Chatbox';
import Header from '../components/Header';
import InputBar from '../components/InputBar';
import { InventoryModal } from '../components/InventoryModal';
import NavButtons from '../components/NavButtons';
import StatsBar from '../components/StatsBar';
import { GameStore } from '../game/store';
import { ConnState } from '../net/connection';
import { useGameState } from '../useSession';
import { Session } from '../session';

interface Props {
  session: Session;
  conn: ConnState;
}

// The line above the log when the game is not live, or empty.
export function statusText(conn: ConnState): string {
  if (conn.offline) return 'You are offline. Waiting for the network…';
  if (conn.phase === 'resuming') return 'Reconnecting…';
  if (conn.phase === 'reconnecting') {
    if (conn.waitReason === 'server_restarting') return 'The game is restarting. Reconnecting…';
    if (conn.waitReason === 'at_capacity') return 'The game is full. Trying again…';
    return 'Connection lost. Reconnecting…';
  }
  return '';
}

const Game: FC<Props> = ({ session, conn }): ReactElement => {
  const game: GameStore = session.game;
  const state = useGameState(session);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const status = statusText(conn);

  // ENTER focuses the input if it isn't already focused.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && inputRef.current && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <Header title={state.room ? state.room.name : 'MUD Client'} />
      {status && <div className="statusline" role="status">{status}</div>}
      <div id="container">
        <Chatbox entries={state.log} setMessage={setMessage} />
        <div id="bottombar">
          <div id="bottombar-top">
            <NavButtons exits={state.room?.exits ?? []} onNavigate={(dir) => game.send('MOVE ' + dir)} />
            <StatsBar stats={state.stats} />
          </div>
          <InputBar
            message={message}
            setMessage={setMessage}
            inputRef={inputRef}
            onSend={(line) => {
              game.send(line);
              setMessage('');
            }}
          />
        </div>
        <InventoryModal
          msgText={state.inventory ?? ''}
          isShown={state.inventory !== null}
          setMessage={setMessage}
          hide={() => game.dispatch({ type: 'closeInventory' })}
        />
      </div>
    </>
  );
};

export default Game;
