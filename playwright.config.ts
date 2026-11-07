// End-to-end tests: a real browser against the production build and a real Go
// server with Postgres. `scripts/e2e.sh` is the entry point; see e2e/README in AGENTS.md.
import { defineConfig, devices } from '@playwright/test';

const SERVER_PORT = 18080; // its own port, so a dev server on 8080 is left alone
const PROXY_PORT = 18081; // between the web server and the game server; tests cut connections here
const PROXY_CONTROL_PORT = 18082;
const WEB_PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts', // adds the game master the staff tests sign in as
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  timeout: 30_000, // one test; a hung page fails in half a minute
  globalTimeout: 10 * 60_000, // the whole run (normally a minute or two), so nothing can hang CI
  retries: 0, // a flaky test is a bug to fix, not to retry
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  metadata: { proxyControlPort: PROXY_CONTROL_PORT },
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    // A phone-sized, touch-enabled browser. Chromium here; WebKit is added where it installs.
    { name: 'phone-chromium', use: { ...devices['Pixel 7'] } },
    ...(process.env.E2E_WEBKIT ? [{ name: 'phone-webkit', use: { ...devices['iPhone 14'] } }] : []),
  ],
  webServer: [
    {
      // Seeds the database, builds the Go server and runs it.
      command: `node e2e/server.mjs`,
      port: SERVER_PORT,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { E2E_SERVER_PORT: String(SERVER_PORT) },
    },
    {
      // Lets a test cut one browser's connection (see e2e/proxy.mjs).
      command: `node e2e/proxy.mjs`,
      port: PROXY_PORT,
      reuseExistingServer: false,
      env: { E2E_SERVER_PORT: String(SERVER_PORT), E2E_PROXY_PORT: String(PROXY_PORT), E2E_PROXY_CONTROL_PORT: String(PROXY_CONTROL_PORT) },
    },
    {
      // The production build, served with /ws proxied to that server.
      command: `npm run build && npx vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { MUD_PROXY_TARGET: `ws://127.0.0.1:${PROXY_PORT}` },
    },
  ],
});
