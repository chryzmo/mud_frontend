import React, { ReactElement, FC, useRef } from "react";
import { sendMUDMessage } from "../utils/SendMUDMessage";
import MUDProps from "../props/MUDProps";

const InputBar: FC<MUDProps> = ({ ws, message, setMessage, inputRef, addMessage }): ReactElement => {
  const history = useRef<string[]>([]);
  const historyIndex = useRef<number>(-1);
  const draft = useRef<string>("");

  const submit = () => {
    if (message.trim() === "") return;
    history.current = [message, ...history.current];
    historyIndex.current = -1;
    draft.current = "";
    sendMUDMessage(ws, message, setMessage, addMessage);
  };

  const handleInputFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.current.length === 0) return;
      if (historyIndex.current === -1) {
        // Save whatever the player was typing before entering history
        draft.current = message;
      }
      const next = Math.min(historyIndex.current + 1, history.current.length - 1);
      historyIndex.current = next;
      setMessage(history.current[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex.current === -1) return;
      const next = historyIndex.current - 1;
      historyIndex.current = next;
      setMessage(next === -1 ? draft.current : history.current[next]);
    }
  };

  const handleMessageBoxFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div id="inputdiv">
      <form id="inputform" autoComplete="off" onSubmit={handleInputFormSubmit}>
        <input
          name="message"
          id="messageBox"
          type="text"
          value={message}
          ref={inputRef}
          placeholder="What would you like to do..?"
          onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
            historyIndex.current = -1;
            setMessage(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={handleMessageBoxFocus}
        />
        <button id="messageBtn">Send</button>
      </form>
    </div>
  );
};

export default InputBar;
