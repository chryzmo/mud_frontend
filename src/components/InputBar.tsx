import React, { ReactElement, FC, useRef } from "react";

interface Props {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  inputRef: React.RefObject<HTMLInputElement>;
  onSend: (line: string) => void;
  onFocusChange?: (focused: boolean) => void;
}

const InputBar: FC<Props> = ({ message, setMessage, inputRef, onSend, onFocusChange }): ReactElement => {
  const history = useRef<string[]>([]);
  const historyIndex = useRef<number>(-1);
  const draft = useRef<string>("");

  const submit = () => {
    if (message.trim() === "") return;
    history.current = [message, ...history.current];
    historyIndex.current = -1;
    draft.current = "";
    onSend(message);
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
          aria-label="Command"
          onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
            historyIndex.current = -1;
            setMessage(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            handleMessageBoxFocus(e);
            onFocusChange?.(true);
          }}
          onBlur={() => onFocusChange?.(false)}
          enterKeyHint="send"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button id="messageBtn" onPointerDown={(e) => e.preventDefault()}>Send</button>
      </form>
    </div>
  );
};

export default InputBar;
