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

const websocket = new WebSocket(MUDCONST.wsUri);
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
    const raw: string = ev.data;

    // ── Pre-login: route server messages to the auth modal ──────────────────
    if (!isLoggedInRef.current) {
      if (raw.startsWith("Welcome back,") || raw.startsWith("Account created!")) {
        isLoggedInRef.current = true;
        setIsLoggedIn(true);
        setAuthError('');
      } else {
        const clean = raw.trim();
        if (clean) setAuthError(clean);
      }
      return;
    }

    // ── Post-login: normal message handling ──────────────────────────────────
    if (raw.startsWith("Your inventory")) {
      modalText = raw;
      setShowInventoryModal(true);
      return;
    }

    for (const line of raw.split('\n')) {
      if (line.startsWith(MUDCONST.MUDCOLOR.ESCAPE_START + MUDCONST.MUDCOLOR.RED)) {
        const stripped = line
          .replace(MUDCONST.MUDCOLOR.ESCAPE_START + MUDCONST.MUDCOLOR.RED, '')
          .replace(MUDCONST.MUDCOLOR.ESCAPE_END, '');
        const npcName = stripped.split(' ')[0];
        addMessage({ type: 'combat', npcName, actionText: stripped.slice(npcName.length) });

      } else if (line.startsWith(MUDCONST.MUDCOLOR.ESCAPE_START + MUDCONST.MUDCOLOR.BLUE)) {
        const stripped = line
          .replace(MUDCONST.MUDCOLOR.ESCAPE_START + MUDCONST.MUDCOLOR.BLUE, '')
          .replace(MUDCONST.MUDCOLOR.ESCAPE_END, '');
        const playerName = stripped.split(' ')[0];
        addMessage({ type: 'player', playerName, actionText: stripped.slice(playerName.length) });

      } else if (line.startsWith(MUDCONST.MUDCOLOR.ESCAPE_START + MUDCONST.MUDCOLOR.GREEN)) {
        const stripped = line
          .replace(MUDCONST.MUDCOLOR.ESCAPE_START + MUDCONST.MUDCOLOR.GREEN, '')
          .replace(MUDCONST.MUDCOLOR.ESCAPE_END, '');
        const itemName = stripped.split(' ')[0];
        addMessage({ type: 'item', itemName, actionText: stripped.slice(itemName.length) });

      } else if (line.startsWith('STATUPDATE:')) {
        // Intercepted by the frontend — update stats bar, never shown in chat.
        const kv: Record<string, number> = {};
        line.slice('STATUPDATE:'.length).split(',').forEach(pair => {
          const [k, v] = pair.split('=');
          kv[k] = parseInt(v, 10);
        });
        setStats({
          hp: kv.hp, maxhp: kv.maxhp,
          mp: kv.mp, maxmp: kv.maxmp,
          atk: kv.atk, atkbonus: kv.atkbonus,
          def: kv.def, defbonus: kv.defbonus,
        });

      } else if (line === '') {
        addMessage({ type: 'spacer' });

      } else {
        // Parse exits line: "Exits: [N] [S] [E]"
        const exitMatch = line.match(/^Exits: (.+)$/);
        if (exitMatch) {
          const dirs = [...exitMatch[1].matchAll(/\[([A-Z]+)\]/g)].map(m => m[1]);
          setExits(dirs);
        }
        addMessage({ type: 'plain', text: line, bold: false });
      }
    }
  };

  // Navigate via a direction button — echo to chat and send directly.
  const handleNavigate = (dir: string) => {
    addMessage({ type: 'plain', text: '----------------------------', bold: false });
    addMessage({ type: 'plain', text: 'MOVE ' + dir, bold: true });
    websocket.send('MOVE ' + dir);
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
