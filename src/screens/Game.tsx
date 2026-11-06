import { FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import ActionSheet, { SheetAction } from '../components/ActionSheet';
import Chatbox, { Target } from '../components/Chatbox';
import Header from '../components/Header';
import InputBar from '../components/InputBar';
import { InventoryModal } from '../components/InventoryModal';
import NavButtons from '../components/NavButtons';
import QuickActions from '../components/QuickActions';
import StatsBar from '../components/StatsBar';
import { ConnState } from '../net/connection';
import { Session } from '../session';
import { useGameState } from '../useSession';

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

interface Sheet {
  title: string;
  actions: SheetAction[];
}

const Game: FC<Props> = ({ session, conn }): ReactElement => {
  const game = session.game;
  const state = useGameState(session);
  const [message, setMessage] = useState('');
  const [typing, setTyping] = useState(false); // the keyboard is up: give the log the room
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const status = statusText(conn);

  const send = useCallback((line: string) => game.send(line), [game]);
  const fill = (text: string) => {
    setMessage(text);
    inputRef.current?.focus();
  };

  // A tapped name opens the things you can do with it. Whispering needs words, so it
  // fills the input; the rest go straight out.
  const choose = (t: Target) => {
    const actions: SheetAction[] =
      t.kind === 'player' ? [{ label: 'Whisper', run: () => fill(`WHISPER ${t.name} `) }]
      : t.kind === 'npc' ? [{ label: 'Attack', run: () => send(`ATTACK ${t.name}`) }]
      : [{ label: 'Pick up', run: () => send(`GET ${t.name}`) }];
    setSheet({ title: t.name, actions });
  };

  const chooseItem = (name: string) => {
    game.dispatch({ type: 'closeInventory' });
    setSheet({
      title: name,
      actions: [
        { label: 'Equip', run: () => send(`EQUIP ${name}`) },
        { label: 'Drop', run: () => send(`DROP ${name}`) },
      ],
    });
  };

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
    <div id="game" className={typing ? 'typing' : ''}>
      <Header title={state.room ? state.room.name : 'MUD Client'} />
      {status && <div className="statusline" role="status">{status}</div>}
      <Chatbox entries={state.log} onSelect={choose} />
      <div id="bottombar">
        <StatsBar stats={state.stats} />
        <div id="controls">
          <NavButtons exits={state.room?.exits ?? []} onNavigate={(dir) => send('MOVE ' + dir)} />
          <QuickActions onCommand={send} />
        </div>
        <InputBar
          message={message}
          setMessage={setMessage}
          inputRef={inputRef}
          onFocusChange={setTyping}
          onSend={(line) => {
            send(line);
            setMessage('');
          }}
        />
      </div>
      <InventoryModal
        msgText={state.inventory ?? ''}
        isShown={state.inventory !== null}
        onItem={chooseItem}
        hide={() => game.dispatch({ type: 'closeInventory' })}
      />
      {sheet && <ActionSheet title={sheet.title} actions={sheet.actions} onClose={() => setSheet(null)} />}
    </div>
  );
};

export default Game;
