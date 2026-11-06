// Wires the pieces for one page: storage, the connection, the game state and the
// browser's visibility and network signals. App takes a Session so tests can build
// one over a scripted socket.
import { createGameStore, GameStore } from './game/store';
import { attachBrowserSignals, Connection, createConnection, SocketLike } from './net/connection';
import { browserStorage, createSessionStore, KV, SessionStore } from './net/storage';
import { wsUri } from './utils/constants';

export interface Session {
  conn: Connection;
  game: GameStore;
  store: SessionStore;
  // The recovery code the player has not yet confirmed saving, or null.
  recovery: { get(): string | null; subscribe(listener: () => void): () => void; acknowledge(): void };
  dispose(): void;
}

export interface SessionOptions {
  url?: string;
  backing?: KV | null;
  createSocket?: (url: string, protocol: string) => SocketLike;
  signals?: boolean; // attach visibility and network listeners (default true)
}

export function createSession(opts: SessionOptions = {}): Session {
  const store = createSessionStore(opts.backing === undefined ? browserStorage() : opts.backing);
  const conn = createConnection({ url: opts.url ?? wsUri, store, createSocket: opts.createSocket });
  const game = createGameStore(conn);

  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((l) => l());
  const offWelcome = conn.subscribe((e) => {
    if (e.type === 'welcome' && e.recovery) changed();
  });
  const detach = opts.signals === false ? () => {} : attachBrowserSignals(conn);

  return {
    conn, game, store,
    recovery: {
      get: () => store.getPendingRecovery(),
      subscribe(listener) {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
      acknowledge() {
        conn.acknowledgeRecovery();
        changed();
      },
    },
    dispose() {
      offWelcome();
      detach();
      game.dispose();
      conn.dispose();
    },
  };
}

let current: Session | null = null;

// getSession is the page's one session, created and started on first use.
export function getSession(): Session {
  if (!current) {
    current = createSession();
    current.conn.start();
  }
  return current;
}
