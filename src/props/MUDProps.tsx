import { ChatMessage } from "../types";

interface MUDProps {
    ws: WebSocket
    message: string
    setMessage: React.Dispatch<React.SetStateAction<string>>
    inputRef:  React.LegacyRef<HTMLInputElement>
    addMessage: (msg: ChatMessage) => void
}

export default MUDProps;
