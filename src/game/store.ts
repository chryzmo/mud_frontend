// Joins a connection to the game state: connection events go through the reducer,
// and a screen subscribes to the result. No React here; a hook wraps it.
import { Connection } from '../net/connection';
import { GameAction, GameState, initialGameState, reduce } from './state';

export interface GameStore {
  getState(): GameState;
  subscribe(listener: () => void): () => void;
  // Send a command line the player typed or tapped, echoing it into the log.
  send(line: string): void;
  dispatch(action: GameAction): void;
  dispose(): void;
}

export function createGameStore(conn: Connection): GameStore {
  let state = initialGameState();
  const listeners = new Set<() => void>();

  const dispatch = (action: GameAction) => {
    const next = reduce(state, action);
    if (next === state) return;
    state = next;
    listeners.forEach((l) => l());
  };

  const off = conn.subscribe((e) => {
    switch (e.type) {
      case 'welcome':
        dispatch({ type: 'welcome', resumed: e.resumed, gap: e.gap });
        break;
      case 'frame':
        dispatch({ type: 'frame', frame: e.frame });
        break;
      case 'notice':
        dispatch({ type: 'notice', message: e.message });
        break;
    }
  });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    send(line) {
      const trimmed = line.trim();
      if (trimmed === '') return;
      dispatch({ type: 'echo', line: trimmed });
      conn.sendCommand(trimmed);
    },
    dispatch,
    dispose() {
      off();
      listeners.clear();
    },
  };
}
