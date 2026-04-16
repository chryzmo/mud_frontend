import React, { SetStateAction } from "react";
import { ChatMessage } from "../types";

export const sendMUDMessage = (
  ws: WebSocket,
  message: string,
  setMessage: React.Dispatch<SetStateAction<string>>,
  addMessage: (msg: ChatMessage) => void
) => {
  if (message.trim() === "") return;

  addMessage({ type: 'plain', text: '----------------------------', bold: false });
  addMessage({ type: 'plain', text: message, bold: true });

  ws.send(message);
  setMessage("");
};
