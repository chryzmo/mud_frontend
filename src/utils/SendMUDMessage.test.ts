import { describe, expect, it, vi } from 'vitest';
import { sendMUDMessage } from './SendMUDMessage';

describe('sendMUDMessage', () => {
  const fakeSocket = () => ({ send: vi.fn() }) as unknown as WebSocket;

  it('sends the command, echoes it, and clears the input', () => {
    const ws = fakeSocket();
    const setMessage = vi.fn();
    const addMessage = vi.fn();

    sendMUDMessage(ws, 'LOOK', setMessage, addMessage);

    expect(ws.send).toHaveBeenCalledWith('LOOK');
    expect(addMessage).toHaveBeenCalledWith({ type: 'plain', text: 'LOOK', bold: true });
    expect(setMessage).toHaveBeenCalledWith('');
  });

  it('ignores blank input', () => {
    const ws = fakeSocket();
    sendMUDMessage(ws, '   ', vi.fn(), vi.fn());
    expect(ws.send).not.toHaveBeenCalled();
  });
});
