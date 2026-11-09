import { FC, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ActionSheet, { SheetAction } from '../components/ActionSheet';
import Banner from '../components/Banner';
import GMPanel from '../components/GMPanel';
import Chatbox, { Target } from '../components/Chatbox';
import Header from '../components/Header';
import InputBar from '../components/InputBar';
import { InventoryModal } from '../components/InventoryModal';
import NavButtons from '../components/NavButtons';
import QuickActions from '../components/QuickActions';
import SpellBar from '../components/SpellBar';
import StyleSheet from '../components/StyleSheet';
import EventsSheet from '../components/EventsSheet';
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

// Whether the player has hidden global chat is a per-device convenience; the game works without storage.
const HIDE_KEY = 'mud.hideGlobal';
function readHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}
function writeHidden(hidden: boolean) {
  try {
    window.localStorage.setItem(HIDE_KEY, hidden ? '1' : '0');
  } catch {
    // not saved; it still applies until the page is reloaded
  }
}

// The social verbs the server knows (mud_server social.go), in the order the sheet lists them.
export const SOCIALS = ['WAVE', 'BOW', 'CHEER', 'DANCE', 'HUG', 'SHRUG', 'NOD', 'LAUGH', 'CLAP', 'SALUTE', 'HIGHFIVE', 'FACEPALM'];

// "/g hello" is GLOBAL hello and "/me waves" is EMOTE waves; everything else goes out as typed.
export const shortForm = (line: string): string => line.replace(/^\/g\s+/i, 'GLOBAL ').replace(/^\/me\s+/i, 'EMOTE ');

const Game: FC<Props> = ({ session, conn }): ReactElement => {
  const game = session.game;
  const state = useGameState(session);
  const [message, setMessage] = useState('');
  const [typing, setTyping] = useState(false); // the keyboard is up: give the log the room
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [gmOpen, setGmOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const ownsStyle = (state.cosmetics?.colors.length ?? 0) + (state.cosmetics?.badges.length ?? 0) > 0;
  const known = state.spells?.known ?? [];
  const ready = state.spells?.ready ?? [];
  const [eventsOpen, setEventsOpen] = useState(false);
  const [hideGlobal, setHideGlobal] = useState(readHidden);
  const gmName = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  // The compass and stats make way only when the keyboard leaves too little room for the log.
  const visibleHeight = useVisibleHeight();
  const cramped = typing && visibleHeight < CRAMPED_BELOW_PX;

  // "/g hello" is the short form of GLOBAL; everything else goes out as typed.
  const send = useCallback((line: string) => game.send(shortForm(line)), [game]);
  const dismissBanner = useCallback(() => game.dispatch({ type: 'dismissBanner' }), [game]);
  const visible = useMemo(() => (hideGlobal ? state.log.filter((e) => e.kind !== 'chat') : state.log), [state.log, hideGlobal]);
  const fill = (text: string) => {
    setMessage(text);
    inputRef.current?.focus();
  };

  // A tapped name opens the things you can do with it. Whispering needs words, so it
  // fills the input; the rest go straight out.
  // The readied spells of one kind, as "Cast <spell>" buttons aimed at a tapped name.
  const castAt = (effect: string, name: string): SheetAction[] =>
    ready.flatMap((key, i) => {
      const spell = known.find((s) => s.key === key);
      return spell && spell.effect === effect ? [{ label: `Cast ${spell.name}`, run: () => send(`CAST ${i + 1} ${name}`) }] : [];
    });
  const choose = (t: Target) => {
    const examine: SheetAction = { label: 'Examine', run: () => send(`EXAMINE ${t.name}`) };
    const actions: SheetAction[] =
      t.kind === 'player' ? [
          ...castAt('mend', t.name),
          { label: 'Whisper', run: () => fill(`WHISPER ${t.name} `) },
          { label: 'Wave', run: () => send(`WAVE ${t.name}`) },
          examine,
          { label: 'Ignore', run: () => send(`IGNORE ${t.name}`) },
          { label: 'Report', run: () => fill(`REPORT ${t.name} `) },
        ]
      : t.kind === 'npc' ? [{ label: 'Attack', run: () => send(`ATTACK ${t.name}`) }, ...castAt('bolt', t.name), examine]
      : [{ label: 'Pick up', run: () => send(`GET ${t.name}`) }, examine];
    setSheet({ title: t.name, actions });
  };

  // The room frame lists what is here; each entry opens what can be done with it. The verbs a
  // thing offers come from the server (its rules), so this needs no puzzle knowledge.
  const showHere = () => {
    const room = state.room;
    if (!room) return;
    const examine = (name: string): SheetAction => ({ label: 'Examine', run: () => send(`EXAMINE ${name}`) });
    const open = (title: string, actions: SheetAction[]) => () => setSheet({ title, actions });
    const entries: SheetAction[] = [
      ...room.people.map((p) => ({
        label: p.name,
        run: open(p.name, [
          { label: 'Talk', run: () => send(`TALK ${p.name}`) },
          // A shopkeeper: show the wares, then get the input ready for BUY.
          ...(p.verbs.includes('SHOP') ? [{ label: 'Shop', run: () => { send(`SHOP ${p.name}`); fill('BUY '); } }] : []),
          examine(p.name),
        ]),
      })),
      ...room.things.map((t) => ({
        label: t.name,
        run: open(t.name, [examine(t.name), ...t.verbs.map((v) => ({ label: v.charAt(0) + v.slice(1).toLowerCase(), run: () => send(`${v} ${t.name}`) }))]),
      })),
      ...room.items.map((i) => ({
        label: i.qty > 1 ? `${i.name} x${i.qty}` : i.name,
        run: open(i.name, [{ label: 'Pick up', run: () => send(`GET ${i.name}`) }, examine(i.name)]),
      })),
    ];
    setSheet({ title: 'Here', actions: entries });
  };
  // Orientation: what you have learned, a hint if you are stuck, where you have been, what you can type, and
  // what is on (only while the server has an event to show).
  const somethingOn = !!state.events && (state.events.now.length > 0 || state.events.next.length > 0);
  const showGuide = () =>
    setSheet({
      title: 'Guide',
      actions: [
        { label: 'Journal', run: () => send('JOURNAL') },
        { label: 'Hint', run: () => send('HINT') },
        { label: 'Map', run: () => send('MAP') },
        { label: 'Commands', run: () => send('HELP') },
        ...(somethingOn ? [{ label: 'Events', run: () => setEventsOpen(true) }] : []),
      ],
    });
  // Ready-made socials: tap one to do it (aim it with WAVE <name> from the input, or from a name's sheet).
  const showSocials = () =>
    setSheet({ title: 'Socials', actions: SOCIALS.map((v) => ({ label: v.charAt(0) + v.slice(1).toLowerCase(), run: () => send(v) })) });
  // Global chat: talk to everyone, or hide it when it buries the room text.
  const showChat = () =>
    setSheet({
      title: 'Talk',
      actions: [
        { label: 'Say to everyone', run: () => fill('GLOBAL ') },
        { label: 'Emote…', run: () => fill('EMOTE ') },
        { label: 'Socials', run: showSocials },
        { label: 'Who is here', run: () => send('WHO') },
        {
          label: hideGlobal ? 'Show global chat' : 'Hide global chat',
          run: () => {
            writeHidden(!hideGlobal);
            setHideGlobal(!hideGlobal);
          },
        },
      ],
    });
  // What you know: tap a spell for what to do with it (fill a slot, cast it, take it off the bar).
  const showSpells = () =>
    setSheet({
      title: 'Spells',
      actions: known.map((sp) => {
        const slot = ready.indexOf(sp.key) + 1;
        return {
          label: `${sp.name} · ${sp.cost} MP${slot > 0 ? ` · slot ${slot}` : ''}`,
          run: () =>
            setSheet({
              title: `${sp.name}: ${sp.desc}`,
              actions: [
                ...(slot > 0 ? [{ label: 'Cast', run: () => send(`CAST ${slot}`) }, { label: 'Take off the bar', run: () => send(`UNREADY ${slot}`) }] : []),
                ...[1, 2, 3].filter((n) => n !== slot).map((n) => ({ label: `Put in slot ${n}`, run: () => send(`READY ${sp.key} ${n}`) })),
              ],
            }),
        };
      }),
    });
  const somethingHere = !!state.room && state.room.people.length + state.room.things.length + state.room.items.length > 0;

  const chooseItem = (name: string) => {
    game.dispatch({ type: 'closeInventory' });
    setSheet({
      title: name,
      actions: [
        { label: 'Examine', run: () => send(`EXAMINE MY ${name}`) },
        { label: 'Equip', run: () => send(`EQUIP ${name}`) },
        { label: 'Use', run: () => send(`USE ${name}`) },
        { label: 'Read', run: () => send(`READ ${name}`) },
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
      {state.banner && <Banner id={state.banner.id} label={state.banner.label} text={state.banner.text} onDismiss={dismissBanner} />}
      <Chatbox entries={visible} onSelect={choose} />
      <div id="bottombar">
        <StatsBar stats={state.stats} />
        {known.length > 0 && (
          <SpellBar known={known} ready={ready} mp={state.stats?.mp} onCast={(slot) => send(`CAST ${slot}`)} onOpen={showSpells} />
        )}
        <div id="controls">
          <NavButtons exits={state.room?.exits ?? []} onNavigate={(dir) => send('MOVE ' + dir)} />
          <QuickActions onCommand={send} onHere={somethingHere ? showHere : undefined} onGuide={showGuide} onChat={showChat} onStyle={ownsStyle ? () => setStyleOpen(true) : undefined} onSpells={known.length > 0 ? showSpells : undefined} />
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
      {styleOpen && <StyleSheet cosmetics={state.cosmetics} onCommand={send} onClose={() => setStyleOpen(false)} />}
      {eventsOpen && <EventsSheet schedule={state.events} onClose={() => setEventsOpen(false)} />}
      {sheet && <ActionSheet title={sheet.title} actions={sheet.actions} onClose={() => setSheet(null)} />}
    </div>
  );
};

export default Game;
