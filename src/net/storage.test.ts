import { afterEach, describe, expect, it } from 'vitest';
import { browserStorage, createSessionStore } from './storage';
import { MemoryKV, ThrowingKV } from './testSupport';

describe('createSessionStore', () => {
  it('keeps the token and name in the backing storage', () => {
    const kv = new MemoryKV();
    const store = createSessionStore(kv);
    expect(store.persistent).toBe(true);
    expect(store.getToken()).toBeNull();
    store.saveSession('tok', 'Alice');
    expect(createSessionStore(kv).getToken()).toBe('tok'); // a reloaded page sees it
    expect(createSessionStore(kv).getName()).toBe('Alice');
  });

  it('keeps an unconfirmed recovery code across a reload until it is acknowledged', () => {
    const kv = new MemoryKV();
    createSessionStore(kv).saveRecovery('ABCD-EFGH-JKLM');
    const reloaded = createSessionStore(kv);
    expect(reloaded.getPendingRecovery()).toBe('ABCD-EFGH-JKLM');
    reloaded.acknowledgeRecovery();
    expect(createSessionStore(kv).getPendingRecovery()).toBeNull();
  });

  it('forgets the token but keeps the name, which recovery asks for', () => {
    const store = createSessionStore(new MemoryKV());
    store.saveSession('tok', 'Alice');
    store.clearToken();
    expect(store.getToken()).toBeNull();
    expect(store.getName()).toBe('Alice');
  });

  it('falls back to memory when storage refuses everything, and says so', () => {
    const store = createSessionStore(new ThrowingKV());
    expect(store.persistent).toBe(false);
    store.saveSession('tok', 'Alice');
    store.saveRecovery('CODE');
    expect(store.getToken()).toBe('tok');
    expect(store.getName()).toBe('Alice');
    expect(store.getPendingRecovery()).toBe('CODE');
    store.acknowledgeRecovery();
    store.clearToken();
    expect(store.getToken()).toBeNull();
  });

  it('notices storage that accepts a write and does not keep it', () => {
    const forgetful = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const store = createSessionStore(forgetful);
    expect(store.persistent).toBe(false);
    store.saveSession('tok', 'Alice');
    expect(store.getToken()).toBeNull(); // reads come from the backing store while it works
  });

  it('works with no storage at all', () => {
    const store = createSessionStore(null);
    expect(store.persistent).toBe(false);
    store.saveSession('tok', 'Alice');
    expect(store.getToken()).toBe('tok');
  });
});

describe('browserStorage', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
  afterEach(() => Object.defineProperty(window, 'localStorage', original));

  it('returns null when merely touching localStorage throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    expect(browserStorage()).toBeNull();
  });

  it('returns localStorage when it works', () => {
    expect(browserStorage()).toBe(window.localStorage);
  });
});
