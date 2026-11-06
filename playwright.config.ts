// End-to-end tests: a real browser against the production build and a real Go
// server with Postgres. `scripts/e2e.sh` is the entry point; see e2e/README in AGENTS.md.
import { defineConfig, devices } from '@playwright/test';

const SERVER_PORT = 18080; // its own port, so a dev server on 8080 is left alone
const WEB_PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // a flaky test is a bug to fix, not to retry
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
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
      // The production build, served with /ws proxied to that server.
      command: `npm run build && npx vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { MUD_PROXY_TARGET: `ws://127.0.0.1:${SERVER_PORT}` },
    },
  ],
});
