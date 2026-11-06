import { FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import ActionSheet, { SheetAction } from '../components/ActionSheet';
import GMPanel from '../components/GMPanel';
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
  const [gmOpen, setGmOpen] = useState(false);
  const gmName = useRef('');
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
    <div id="game" className={cramped ? 'cramped' : ''}>
      <Header
        title={state.room ? state.room.name : 'ConQuest'}
        action={conn.staff ? <button type="button" className="gm-open" onClick={() => setGmOpen(true)}>GM</button> : undefined}
      />
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
      {gmOpen && <GMPanel initialName={gmName.current} onName={(n) => { gmName.current = n; }} onCommand={send} onClose={() => setGmOpen(false)} />}
      {sheet && <ActionSheet title={sheet.title} actions={sheet.actions} onClose={() => setSheet(null)} />}
    </div>
  );
};

export default Game;
