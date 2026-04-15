interface MUDProps {
    ws: WebSocket
    message: string
    setMessage: React.Dispatch<React.SetStateAction<string>>
    inputRef:  React.LegacyRef<HTMLInputElement>
}

export default MUDProps;