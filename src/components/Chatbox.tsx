import { FC, ReactElement, useEffect, useRef } from "react";
import { ChatMessage } from "../types";

interface Props {
  messages: ChatMessage[];
  setMessage: React.Dispatch<React.SetStateAction<string>>;
}

const Chatbox: FC<Props> = ({ messages, setMessage }): ReactElement => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div id="chatdiv">
      <div id="chatbox">
        {messages.map((msg, i) => {
          switch (msg.type) {
            case 'plain':
              return (
                <div key={i} style={msg.bold ? { fontWeight: 'bold' } : {}}>
                  {msg.bold ? '> ' + msg.text : msg.text}
                </div>
              );
            case 'spacer':
              return <div key={i}>&nbsp;</div>;
            case 'combat':
              return (
                <div key={i} className="chatmessageclickable" onClick={() => setMessage('ATTACK ' + msg.npcName)}>
                  <span className="npcNameSpan">{msg.npcName}</span>
                  <span className="npcActionText">{msg.actionText}</span>
                </div>
              );
            case 'player':
              return (
                <div key={i} className="chatmessageclickable" onClick={() => setMessage('WHISPER ' + msg.playerName + ' ')}>
                  <span className="playerNameSpan">{msg.playerName}</span>
                  <span className="playerActionText">{msg.actionText}</span>
                </div>
              );
            case 'item':
              return (
                <div key={i} className="chatmessageclickable" onClick={() => setMessage('GET ' + msg.itemName)}>
                  <span className="itemNameSpan">{msg.itemName}</span>
                  <span className="itemActionText">{msg.actionText}</span>
                </div>
              );
            case 'whisper':
              return <div key={i} className="whisperText">{msg.text}</div>;
            default:
              return null;
          }
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default Chatbox;
