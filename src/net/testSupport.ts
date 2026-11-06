// Test helpers for the connection layer: a scripted socket and an in-memory storage.
import type { SocketLike } from './connection';
import type { KV } from './storage';

export class FakeSocket implements SocketLike {
  readyState = 0; // connecting
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closedByClient = false;

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.closedByClient = true;
  }

  // The connection is established.
  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  // A frame from the server.
  deliver(frame: object | string) {
    this.onmessage?.({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) });
  }

  // The connection ends without the client asking: a lost signal, or the server closing it.
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }

  sentFrames(): Record<string, unknown>[] {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
  }
}

export class MemoryKV implements KV {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

// A storage that refuses everything, like some private-browsing modes.
export class ThrowingKV implements KV {
  getItem(): string | null {
    throw new Error('storage unavailable');
  }
  setItem(): void {
    throw new Error('storage unavailable');
  }
  removeItem(): void {
    throw new Error('storage unavailable');
  }
}
