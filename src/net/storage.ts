// The character's credentials, in localStorage when the browser allows it. Every
// access is wrapped: storage can be missing, full or refused (private browsing,
// some in-app browsers). Then the values live in memory for this page only, and
// `persistent` is false so the UI can say that a reload will lose the character.

const TOKEN = 'mud.token';
const NAME = 'mud.name';
const RECOVERY = 'mud.recovery'; // the code, until the player confirms they saved it

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SessionStore {
  readonly persistent: boolean;
  getToken(): string | null;
  getName(): string | null;
  // A recovery code the player has not yet confirmed saving. It survives a reload so
  // the screen can come back: the server shows the code once.
  getPendingRecovery(): string | null;
  saveSession(token: string, name: string): void;
  saveRecovery(code: string): void;
  acknowledgeRecovery(): void;
  clearToken(): void;
}

// browserStorage returns localStorage, or null if even touching it throws.
export function browserStorage(): KV | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createSessionStore(backing: KV | null = browserStorage()): SessionStore {
  const memory = new Map<string, string>();
  let persistent = backing !== null;

  const read = (key: string): string | null => {
    if (backing) {
      try {
        return backing.getItem(key);
      } catch {
        persistent = false;
      }
    }
    return memory.get(key) ?? null;
  };

  const write = (key: string, value: string) => {
    memory.set(key, value);
    if (!backing) return;
    try {
      backing.setItem(key, value);
      if (backing.getItem(key) !== value) persistent = false; // accepted but not kept
    } catch {
      persistent = false;
    }
  };

  const remove = (key: string) => {
    memory.delete(key);
    if (!backing) return;
    try {
      backing.removeItem(key);
    } catch {
      persistent = false;
    }
  };

  // Probe once, so the UI knows from the start rather than after the first write.
  if (backing) {
    try {
      backing.setItem('mud.probe', '1');
      if (backing.getItem('mud.probe') !== '1') persistent = false;
      backing.removeItem('mud.probe');
    } catch {
      persistent = false;
    }
  }

  return {
    get persistent() {
      return persistent;
    },
    getToken: () => read(TOKEN),
    getName: () => read(NAME),
    getPendingRecovery: () => read(RECOVERY),
    saveSession(token, name) {
      write(TOKEN, token);
      write(NAME, name);
    },
    saveRecovery: (code) => write(RECOVERY, code),
    acknowledgeRecovery: () => remove(RECOVERY),
    clearToken: () => remove(TOKEN), // keep the name: recovery asks for it
  };
}
