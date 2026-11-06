import { FC, ReactElement, useLayoutEffect, useRef, useState } from "react";
import { Entry } from "../game/entries";

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

const Chatbox: FC<Props> = ({ entries, onSelect }): ReactElement => {
  const scroller = useRef<HTMLDivElement>(null);
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
      <div id="chatbox" ref={scroller} onScroll={onScroll}>
        {entries.map((e) => {
          switch (e.kind) {
            case 'plain':
              return <div key={e.id}>{e.text}</div>;
            case 'echo':
              return <div key={e.id} style={{ fontWeight: 'bold' }}>{'> ' + e.text}</div>;
            case 'notice':
              return <div key={e.id} className="noticeText">{e.text}</div>;
            case 'divider':
              return <div key={e.id} className="dividerText">{e.text}</div>;
            case 'spacer':
              return <div key={e.id}>&nbsp;</div>;
            case 'combat':
              return (
                <div key={e.id} className="chatmessageclickable" onClick={() => onSelect({ kind: 'npc', name: e.npcName })}>
                  <span className="npcNameSpan">{e.npcName}</span>
                  <span className="npcActionText">{e.actionText}</span>
                </div>
              );
            case 'player':
              return (
                <div key={e.id} className="chatmessageclickable" onClick={() => onSelect({ kind: 'player', name: e.playerName })}>
                  <span className="playerNameSpan">{e.playerName}</span>
                  <span className="playerActionText">{e.actionText}</span>
                </div>
              );
            case 'item':
              return (
                <div key={e.id} className="chatmessageclickable" onClick={() => onSelect({ kind: 'item', name: e.itemName })}>
                  <span className="itemNameSpan">{e.itemName}</span>
                  <span className="itemActionText">{e.actionText}</span>
                </div>
              );
            case 'whisper':
              return <div key={e.id} className="whisperText">{e.text}</div>;
          }
        })}
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
