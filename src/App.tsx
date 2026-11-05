import { useCallback, useEffect, useRef, useState } from 'react'
import Header from "./components/Header";
import InputBar from './components/InputBar';
import Chatbox from './components/Chatbox';
import NavButtons from './components/NavButtons';
import StatsBar, { Stats } from './components/StatsBar';
import LoginModal from './components/LoginModal';
import * as MUDCONST from "./utils/constants";
import { InventoryModal } from './components/InventoryModal';
import { ChatMessage } from './types';
import { SUBPROTOCOL, eventToChat, parseServerMessage, sendCommand, textToChat } from './protocol';

const websocket = new WebSocket(MUDCONST.wsUri, SUBPROTOCOL);
websocket.onopen = () => {};
websocket.onclose = () => {};

let modalText = "";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState('');
  // Ref mirrors isLoggedIn so the onmessage closure always reads the current
  // value without waiting for a React re-render.
  const isLoggedInRef = useRef(false);

  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [exits, setExits] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  websocket.onmessage = (ev) => {
    const msg = parseServerMessage(ev.data);
    if (!msg) return;

    // ── Before login: only the auth reply matters ────────────────────────────
    if (!isLoggedInRef.current) {
      if (msg.t === 'auth') {
        if (msg.ok) {
          isLoggedInRef.current = true;
          setIsLoggedIn(true);
          setAuthError('');
        } else {
          setAuthError(msg.message);
        }
      } else if (msg.t === 'error') {
        setAuthError(msg.message);
      }
      return;
    }

    // ── After login ──────────────────────────────────────────────────────────
    switch (msg.t) {
      case 'text':
        textToChat(msg.text).forEach(addMessage);
        break;
      case 'say':
      case 'arrive':
      case 'leave':
      case 'whisper':
        eventToChat(msg).forEach(addMessage);
        break;
      case 'inventory':
        modalText = msg.text;
        setShowInventoryModal(true);
        break;
      case 'stats':
        setStats(msg.stats);
        break;
      case 'room':
        setExits(msg.exits);
        break;
      case 'error':
        addMessage({ type: 'plain', text: msg.message, bold: false });
        break;
    }
  };

  // Navigate via a direction button — echo to chat and send directly.
  const handleNavigate = (dir: string) => {
    addMessage({ type: 'plain', text: '----------------------------', bold: false });
    addMessage({ type: 'plain', text: 'MOVE ' + dir, bold: true });
    sendCommand(websocket, 'MOVE ' + dir);
  };

  // ENTER key focuses the input if it isn't already focused.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && inputRef.current && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isLoggedIn) {
    return (
      <LoginModal
        ws={websocket}
        error={authError}
        onErrorClear={() => setAuthError('')}
      />
    );
  }

  return (
    <>
      <Header title="MUD Client" />
      <div id="container">
        <Chatbox messages={messages} setMessage={setMessage} />
        <div id="bottombar">
          <div id="bottombar-top">
            <NavButtons exits={exits} onNavigate={handleNavigate} />
            <StatsBar stats={stats} />
          </div>
          <InputBar
            ws={websocket}
            message={message}
            setMessage={setMessage}
            inputRef={inputRef}
            addMessage={addMessage}
          />
        </div>
        <InventoryModal
          msgText={modalText}
          isShown={showInventoryModal}
          setMessage={setMessage}
          hide={() => setShowInventoryModal(false)}
        />
      </div>
    </>
  );
}

export default App;
