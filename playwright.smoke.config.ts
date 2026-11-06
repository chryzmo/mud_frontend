// A live smoke test of the deployed site: ONE guest, a handful of actions. It starts
// no servers; it needs SMOKE_URL (https). Run it with scripts/smoke-live.sh, by hand,
// with the owner's go-ahead. Never part of CI.
import { defineConfig, devices } from '@playwright/test';

const url = process.env.SMOKE_URL;
if (!url || !/^https:\/\//.test(url)) throw new Error('SMOKE_URL must be set to the https:// address of the site');

export default defineConfig({
  testDir: 'smoke',
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 90_000,
  use: { baseURL: url, trace: 'retain-on-failure' },
  projects: [{ name: 'phone-chromium', use: { ...devices['Pixel 7'] } }],
});
