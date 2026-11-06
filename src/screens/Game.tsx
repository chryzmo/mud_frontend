import { FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import ActionSheet, { SheetAction } from '../components/ActionSheet';
import Chatbox, { Target } from '../components/Chatbox';
import Header from '../components/Header';
import InputBar from '../components/InputBar';
import { InventoryModal } from '../components/InventoryModal';
import NavButtons from '../components/NavButtons';
import QuickActions from '../components/QuickActions';
import StatusLine from '../components/StatusLine';
import StatsBar from '../components/StatsBar';
import { ConnState } from '../net/connection';
import { Session } from '../session';
import { useGameState } from '../useSession';
import { useVisibleHeight } from '../useViewport';

interface Props {
  session: Session;
  conn: ConnState;
}

// Below this visible height (keyboard up, or a phone on its side) the log needs the room.
export const CRAMPED_BELOW_PX = 420;

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
  // The compass and stats make way only when the keyboard leaves too little room for the log.
  const visibleHeight = useVisibleHeight();
  const cramped = typing && visibleHeight < CRAMPED_BELOW_PX;

  const send = useCallback((line: string) => game.send(line), [game]);
  const fill = (text: string) => {
    setMessage(text);
    inputRef.current?.focus();
  };

  // A tapped name opens the things you can do with it. Whispering needs words, so it
  // fills the input; the rest go straight out.
  const choose = (t: Target) => {
    const examine: SheetAction = { label: 'Examine', run: () => send(`EXAMINE ${t.name}`) };
    const actions: SheetAction[] =
      t.kind === 'player' ? [{ label: 'Whisper', run: () => fill(`WHISPER ${t.name} `) }, examine]
      : t.kind === 'npc' ? [{ label: 'Attack', run: () => send(`ATTACK ${t.name}`) }, examine]
      : [{ label: 'Pick up', run: () => send(`GET ${t.name}`) }, examine];
    setSheet({ title: t.name, actions });
  };

  const chooseItem = (name: string) => {
    game.dispatch({ type: 'closeInventory' });
    setSheet({
      title: name,
      actions: [
        { label: 'Examine', run: () => send(`EXAMINE MY ${name}`) },
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
    <div id="game" className={cramped ? 'cramped' : ''}>
      <Header title={state.room ? state.room.name : 'MUD Client'} />
      <StatusLine conn={conn} onRetry={session.conn.retryNow} />
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
