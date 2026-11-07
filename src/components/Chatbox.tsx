import { FC, ReactElement, memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Entry } from "../game/entries";
import NameTag from "./NameTag";

export interface Target {
  kind: 'player' | 'npc' | 'item';
  name: string;
}

interface Props {
  entries: Entry[];
  onSelect: (target: Target) => void;
}

// Within this many pixels of the bottom counts as "reading the latest".
const NEAR_BOTTOM_PX = 48;

// How many rows have rendered; the tests use it to check that a new line does not
// re-render the 500 that were already there.
export const chatPerf = { rowRenders: 0 };

// One log line. Memoised: entries never change once added, and `onSelect` is stable,
// so appending a line renders one row, not the whole log.
const Row = memo(function Row({ entry: e, onSelect }: { entry: Entry; onSelect: (t: Target) => void }): ReactElement | null {
  chatPerf.rowRenders++;
  switch (e.kind) {
      case 'plain':
        return <div>{e.text}</div>;
      case 'echo':
        return <div style={{ fontWeight: 'bold' }}>{'> ' + e.text}</div>;
      case 'notice':
        return <div className="noticeText">{e.text}</div>;
      case 'divider':
        return <div className="dividerText">{e.text}</div>;
      case 'spacer':
        return <div>&nbsp;</div>;
      case 'combat':
        return (
          <div className="chatmessageclickable" onClick={() => onSelect({ kind: 'npc', name: e.npcName })}>
            <span className="npcNameSpan">{e.npcName}</span>
            <span className="npcActionText">{e.actionText}</span>
          </div>
        );
      case 'player':
        return (
          <div className="chatmessageclickable" onClick={() => onSelect({ kind: 'player', name: e.playerName })}>
            <NameTag className="playerNameSpan" name={e.playerName} color={e.color} badge={e.badge} />
            <span className="playerActionText">{e.actionText}</span>
          </div>
        );
      case 'item':
        return (
          <div className="chatmessageclickable" onClick={() => onSelect({ kind: 'item', name: e.itemName })}>
            <span className="itemNameSpan">{e.itemName}</span>
            <span className="itemActionText">{e.actionText}</span>
          </div>
        );
      case 'whisper':
        return <div className="whisperText">{e.text}</div>;
      case 'chat':
        return (
          <div className="chatText">
            <span className="chatTag">[Global] </span>
            <NameTag className={e.gm ? 'chatWho chatGM' : 'chatWho'} name={e.who} color={e.color} badge={e.badge} suffix={e.gm ? ' (GM)' : ''} />
            {': ' + e.text}
          </div>
        );
      case 'announce':
        return <div className="announceText">{`[${e.label}] ${e.text}`}</div>;
    }
});

const Chatbox: FC<Props> = ({ entries, onSelect }): ReactElement => {
  const scroller = useRef<HTMLDivElement>(null);
  const latestSelect = useRef(onSelect);
  latestSelect.current = onSelect;
  const select = useCallback((t: Target) => latestSelect.current(t), []);
  const stuck = useRef(true); // follow new lines only while the player is at the bottom
  const seen = useRef(entries.length ? entries[entries.length - 1].id : 0);
  const [unread, setUnread] = useState(0);
  const [showJump, setShowJump] = useState(false);

  const toBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    stuck.current = true;
    setUnread(0);
    setShowJump(false);
  };

  useLayoutEffect(() => {
    const latest = entries.length ? entries[entries.length - 1].id : 0;
    const added = entries.filter((e) => e.id > seen.current).length;
    seen.current = latest;
    if (stuck.current) toBottom();
    else if (added > 0) setUnread((n) => n + added);
  }, [entries]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    setShowJump(!stuck.current);
    if (stuck.current) setUnread(0);
  };

  return (
    <div id="chatdiv">
      <div id="chatbox" ref={scroller} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions" aria-label="Game log" tabIndex={0}>
        {entries.map((e) => (
          <Row key={e.id} entry={e} onSelect={select} />
        ))}
      </div>
      {showJump && (
        <button type="button" className="jump" onClick={toBottom}>
          {unread > 0 ? `↓ ${unread} new` : '↓ Latest'}
        </button>
      )}
    </div>
  );
};

export default Chatbox;
