import { useSyncExternalStore } from 'react';
import { GameState } from './game/state';
import { ConnState } from './net/connection';
import { Session } from './session';

export const useConnState = (s: Session): ConnState =>
  useSyncExternalStore(
    (cb) => s.conn.subscribe((e) => { if (e.type === 'state') cb(); }),
    s.conn.getState,
  );

export const useGameState = (s: Session): GameState => useSyncExternalStore(s.game.subscribe, s.game.getState);

export const useRecovery = (s: Session): string | null => useSyncExternalStore(s.recovery.subscribe, s.recovery.get);
