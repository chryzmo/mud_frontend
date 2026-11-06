import { FC, ReactElement, useEffect, useRef } from "react";
import { Entry } from "../game/entries";

interface Props {
  entries: Entry[];
  setMessage: React.Dispatch<React.SetStateAction<string>>;
}

const Chatbox: FC<Props> = ({ entries, setMessage }): ReactElement => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div id="chatdiv">
      <div id="chatbox">
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
                <div key={e.id} className="chatmessageclickable" onClick={() => setMessage('ATTACK ' + e.npcName)}>
                  <span className="npcNameSpan">{e.npcName}</span>
                  <span className="npcActionText">{e.actionText}</span>
                </div>
              );
            case 'player':
              return (
                <div key={e.id} className="chatmessageclickable" onClick={() => setMessage('WHISPER ' + e.playerName + ' ')}>
                  <span className="playerNameSpan">{e.playerName}</span>
                  <span className="playerActionText">{e.actionText}</span>
                </div>
              );
            case 'item':
              return (
                <div key={e.id} className="chatmessageclickable" onClick={() => setMessage('GET ' + e.itemName)}>
                  <span className="itemNameSpan">{e.itemName}</span>
                  <span className="itemActionText">{e.actionText}</span>
                </div>
              );
            case 'whisper':
              return <div key={e.id} className="whisperText">{e.text}</div>;
          }
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default Chatbox;
