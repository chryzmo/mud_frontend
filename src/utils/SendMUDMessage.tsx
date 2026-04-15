import React, { SetStateAction } from "react";

export const sendMUDMessage = (ws: WebSocket, message: string, setMessage: React.Dispatch<SetStateAction<string>>) => {
    //e.preventDefault()
    // if user hasn't entered anything in to send, do nothing
    if (message.trim() === "") {
      return
    }
    // Echo player's message to them
    createChatboxMessage("----------------------------", false);
    createChatboxMessage(message, true)

    // Send a websocket message to the server
    ws.send(message);

    // Reset message input box
    setMessage("")
}

export const createChatboxMessage = (server_msg: string, sentbyplayer: boolean) => {
  let chatbox = document.querySelector('#chatbox');
  let message = document.createElement('div');
  message.innerText = "";

  if (sentbyplayer) {
    message.style.fontWeight='bold'
    message.innerText = '> '+server_msg;
  } else {
    message.innerText = server_msg;
  }

  chatbox?.append(message);
  chatbox?.querySelector('div:last-of-type')?.scrollIntoView()
}

export const createInteractiveCombatMessage = (action_text: string, npcName: string, setMessage: React.Dispatch<React.SetStateAction<string>>) => {
  let chatbox = document.querySelector('#chatbox');
  let message = document.createElement('div');
  let stylednpc = document.createElement('span');
  

  stylednpc.innerText = npcName;
  stylednpc.className = 'npcNameSpan'
  message.append(stylednpc);

  if (action_text !== "" ) {
    let npcactiontext = document.createElement('span');
    npcactiontext.innerText = action_text;
    npcactiontext.className = 'npcActionText'
    message.append(npcactiontext);
  }

  const handleClick = (target : string, setMessage: React.Dispatch<React.SetStateAction<string>>) => () => {
    setMessage("ATTACK " + target)
  };

  message.onclick = handleClick(npcName,setMessage);
  message.className = "chatmessageclickable";

  chatbox?.append(message);
  chatbox?.querySelector('div:last-of-type')?.scrollIntoView()
}

export const createInteractivePlayerMessage = (action_text: string, targetName: string, setMessage: React.Dispatch<React.SetStateAction<string>>) => {
  let chatbox = document.querySelector('#chatbox');
  let message = document.createElement('div');
  let styledplayername = document.createElement('span');
  
  styledplayername.innerText = targetName;
  styledplayername.className = 'playerNameSpan';
  message.append(styledplayername);

  if (action_text !== "") {
    let actiontextspan = document.createElement('span');
    actiontextspan.innerText = action_text;
    actiontextspan.className = 'playerActionText'
    message.append(actiontextspan);
  }


  const handleClick = (target : string, setMessage: React.Dispatch<React.SetStateAction<string>>) => () => {
    setMessage("WHISPER " + target + " ");
  };

  message.onclick = handleClick(targetName,setMessage);
  message.className = "chatmessageclickable";

  chatbox?.append(message);
  chatbox?.querySelector('div:last-of-type')?.scrollIntoView()
}

export const createInteractiveRoomMessage = (action_text: string, targetName: string, setMessage: React.Dispatch<React.SetStateAction<string>>) => {
  let chatbox = document.querySelector('#chatbox');
  let message = document.createElement('div');
  let styleditemname = document.createElement('span');

  styleditemname.innerText = targetName;
  styleditemname.className = 'itemNameSpan';
  message.append(styleditemname);

  const handleClick = (target : string, setMessage: React.Dispatch<React.SetStateAction<string>>) => () => {
    setMessage("GET " + target);
  };

  if (action_text !== "") {
    let actiontextspan = document.createElement('span');
    actiontextspan.innerText = action_text;
    actiontextspan.className = 'itemActionText'
    message.append(actiontextspan);
  }

  message.onclick = handleClick(targetName,setMessage);
  message.className = "chatmessageclickable";

  chatbox?.append(message);
  chatbox?.querySelector('div:last-of-type')?.scrollIntoView()
}
