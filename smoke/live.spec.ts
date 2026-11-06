import { expect, test } from '@playwright/test';
import { INPUT, confirmCode, joinAs, say, uniqueName } from '../e2e/helpers';

// One guest on the live site. It leaves one character behind (the post-event purge or the
// Phase 4 admin tools remove it); it does nothing a player could not do.
test('the live site: join, play, drop the connection, resume, reload', async ({ page, context }) => {
  const errors: string[] = [];
  const sockets: string[] = [];
  // Only our own page counts: Cloudflare injects an analytics beacon from another host, which
  // can be blocked by a network or an ad blocker and logs an error that is not ours.
  const ours = (url: string) => url === '' || new URL(url).host === new URL(page.url() === 'about:blank' ? 'https://x' : page.url()).host;
  page.on('console', (m) => m.type() === 'error' && ours(m.location().url) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('websocket', (ws) => sockets.push(ws.url()));

  const started = Date.now();
  const name = uniqueName();
  console.log(`guest name: ${name}`); // so the post-event purge can find it
  const code = await joinAs(page, name);
  expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){2,}$/);
  await confirmCode(page);
  await expect(page.getByText(/You are in/).first()).toBeVisible();
  console.log(`in the game ${((Date.now() - started) / 1000).toFixed(1)} s after loading the page`);

  // The connection must be secure: this is what the real path through Cloudflare serves.
  // (SMOKE_WS_SCHEME exists only so this spec can be tried against the local stack.)
  expect(sockets.length).toBeGreaterThan(0);
  expect(sockets.every((u) => u.startsWith(process.env.SMOKE_WS_SCHEME ?? 'wss://'))).toBe(true);

  await say(page, 'SAY smoke test');
  await expect(page.getByText('You say: "smoke test"')).toBeVisible();

  await page.getByPlaceholder(INPUT).blur();
  await page.locator('#navdiv button:not([disabled])').first().click();
  await page.getByRole('button', { name: 'Look' }).click();
  await expect(page.getByText('> LOOK')).toBeVisible();
  await page.getByRole('button', { name: 'Items' }).click();
  await expect(page.getByRole('dialog', { name: 'Your inventory' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  // The network drops and returns: the page reconnects by itself and the character stays.
  await context.setOffline(true);
  await expect(page.getByRole('status')).toContainText(/offline/i);
  await context.setOffline(false);
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 40_000 });
  await say(page, 'SAY back after the drop');
  await expect(page.getByText('You say: "back after the drop"')).toBeVisible();

  // A reload resumes the same character.
  await page.reload();
  await expect(page.getByPlaceholder(INPUT)).toBeVisible();
  await expect(page.getByText(/Some messages may have been missed/)).toBeVisible();
  await say(page, 'SAY after the reload');
  await expect(page.getByText('You say: "after the reload"')).toBeVisible();

  expect(errors, 'console errors').toEqual([]);
});
