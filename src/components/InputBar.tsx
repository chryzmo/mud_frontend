import React, { ReactElement, FC } from "react";
import {sendMUDMessage} from "../utils/SendMUDMessage"
import MUDProps from "../props/MUDProps"
 
const InputBar: FC<MUDProps> = ({ws, message, setMessage, inputRef}): ReactElement => {
    const handleInputFormSubmit = (e : React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        sendMUDMessage(ws, message, setMessage);
    }

    const handleMessageBoxEnterKey = (e : React.KeyboardEvent<HTMLInputElement>) => {
        //e.preventDefault();
        if (e.key === 'Enter' && document.activeElement === document.getElementById("messageBox")) {
            sendMUDMessage(ws, message, setMessage);
        }   
    }

    const handleMessageBoxFocus = (e : React.FocusEvent<HTMLInputElement>) => {
       e.target.select();
    }

    return (
    <div id="inputdiv">
    <form id="inputform" autoComplete="off" onSubmit={(e) => handleInputFormSubmit(e)} >
        <input name="message" id="messageBox" type="text" value={message} ref={inputRef}
        placeholder="What would you like to do..?"
        onInput={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
        onKeyDown={(e) => handleMessageBoxEnterKey(e)}
        onFocus={(e) => handleMessageBoxFocus(e)} />
        <button id="messageBtn">Send</button>
    </form>
    </div>
    )
};
 
export default InputBar;