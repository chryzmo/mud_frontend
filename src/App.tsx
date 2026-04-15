import React, {useEffect, useRef, useState} from 'react'
import Header from "./components/Header";
import InputBar from './components/InputBar';
import Chatbox from './components/Chatbox';
import * as MUDCONST from "./utils/constants";
import {createChatboxMessage, createInteractiveCombatMessage, createInteractivePlayerMessage, createInteractiveRoomMessage} from './utils/SendMUDMessage'
import {InventoryModal} from './components/InventoryModal';

  /* 
  Set up Websocket connection & functions
  */
  const websocket = new WebSocket(MUDCONST.wsUri);

  // On open, do nothing - console.log() can be added for debugging purposes
  websocket.onopen = () => {

  }

  // On close, do nothing - console.log() can be added for debugging purposes
  websocket.onclose = () => {

  }

let modalText = "";

function App() {
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  // On receiving a message from the server, parse the data and then create an entry in the chat
  websocket.onmessage = (ev) => {
    let message = ev.data;

    /* Parse interactive mesages 
      These may require reading a header from a multiline message
    */
    // TODO:  Move these elsewhere?
    if (message.startsWith("Your inventory")) {
      modalText = message;
      setShowInventoryModal(true);
      return;
    }

    /* Break message into lines and parse for interactive messages */
    let msglines = message.split('\n');

    //msglines.map(function (data : string) {
    for (const line of msglines) {
      // Make combat messages interative
      if (line.startsWith(MUDCONST.MUDCOLOR.ESCAPE_START+MUDCONST.MUDCOLOR.RED)) {
        // Combat NPCs will show as ANSI red
        let sendline = line.replace(MUDCONST.MUDCOLOR.ESCAPE_START+MUDCONST.MUDCOLOR.RED,'').replace(MUDCONST.MUDCOLOR.ESCAPE_END,'');
        let npcname = sendline.split(' ')[0];
        let linetext = sendline.replace(npcname,'');
        createInteractiveCombatMessage(linetext,npcname,setMessage);
      } else if (line.startsWith(MUDCONST.MUDCOLOR.ESCAPE_START+MUDCONST.MUDCOLOR.BLUE)) {
        // PCs will show as ANSI blue
        let sendline = line.replace(MUDCONST.MUDCOLOR.ESCAPE_START+MUDCONST.MUDCOLOR.BLUE,'').replace(MUDCONST.MUDCOLOR.ESCAPE_END,'');
        let playername = sendline.split(' ')[0];
        let linetext = sendline.replace(playername,'');
        createInteractivePlayerMessage(linetext,playername,setMessage);
      } else if (line.startsWith(MUDCONST.MUDCOLOR.ESCAPE_START+MUDCONST.MUDCOLOR.GREEN)) {
        // Room items will show as ANSI green
        let sendline = line.replace(MUDCONST.MUDCOLOR.ESCAPE_START+MUDCONST.MUDCOLOR.GREEN,'').replace(MUDCONST.MUDCOLOR.ESCAPE_END,'');
        let itemname = sendline.split(' ')[0];
        let linetext = sendline.replace(itemname,'');
        createInteractiveRoomMessage(linetext,itemname,setMessage);
      }
      
      else if (line==="") {
        createChatboxMessage("\n",false);
      } else {
        createChatboxMessage(line, false);
      }
  }

    
}

  /* Allow ENTER key to shift focus to messageBox form */
  useEffect(() => {
    function handleKeyDown(e : KeyboardEvent) {
      if (e.key === "Enter" ) {
        e.preventDefault();

        // Set focus on messageBox, if it does not already have focus
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    // Remove listener when when component is cleaned up
    return function cleanup() {
      document.removeEventListener('keydown', handleKeyDown);
    }

    }, []); 

  // Build the mud_frontend UI to show  
  return (
    <>
      <Header title="MUD Client" />
      <div id="container">
        <Chatbox />
        <InputBar 
          ws={websocket}
          message={message}
          setMessage={setMessage}
          inputRef={inputRef} />
        <InventoryModal msgText={modalText} isShown={showInventoryModal} setMessage={setMessage} hide={() => setShowInventoryModal(false)} />
      </div>
    </>
  );
}

export default App