import { afterEach, describe, expect, it, vi } from 'vitest';

describe('wsUri', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults to /ws on the page host', async () => {
    const { wsUri } = await import('./constants');
    expect(wsUri).toBe(`ws://${window.location.host}/ws`);
  });

  it('can be overridden with VITE_WS_URL', async () => {
    vi.stubEnv('VITE_WS_URL', 'wss://mud.example/ws');
    const { wsUri } = await import('./constants');
    expect(wsUri).toBe('wss://mud.example/ws');
  });
});
