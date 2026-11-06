import { expect } from '@playwright/test';
import { INPUT, play, say, test } from './helpers';

// Players come back within a few seconds on a good network, longer after an outage
// (backoff up to 10 s plus jitter), so these waits are generous on purpose.
const BACK = { timeout: 40_000 };
const status = (page: import('@playwright/test').Page) => page.getByRole('status');

test('a dropped connection comes back by itself and keeps the character', async ({ page, net, browser }) => {
  await play(page);
  await say(page, 'SAY before the drop');
  await expect(page.getByText('You say: "before the drop"')).toBeVisible();

  const other = await browser.newContext();
  const bob = await other.newPage();
  await play(bob);

  await net.cut();
  await expect(page.getByPlaceholder(INPUT)).toBeVisible(); // the game stays on screen throughout
  // Bob speaks after the cut; Alice sees it once her page is back (live or replayed).
  await say(bob, 'SAY are you there');
  await expect(page.getByText('are you there')).toBeVisible(BACK);
  await expect(status(page)).toHaveCount(0);
  await expect(page.getByText(/Some messages may have been missed/)).toHaveCount(0); // a resume, not a fresh start
  await expect(page.getByText('You say: "before the drop"')).toBeVisible(); // the log is still there

  await say(page, 'SAY yes I am');
  await expect(bob.getByText('yes I am')).toBeVisible();
  await other.close();
});

test('during an outage the page says so, and after it the missed lines are replayed', async ({ page, net, browser }) => {
  await play(page);

  // A second player in the same start room, on their own network.
  const other = await browser.newContext();
  const bob = await other.newPage();
  await play(bob);

  await net.block();
  await expect(status(page)).toContainText(/Reconnecting|Connection lost/, BACK);
  await say(bob, 'SAY did you miss this');
  await expect(bob.getByText('You say: "did you miss this"')).toBeVisible();

  await net.unblock();
  await expect(status(page)).toHaveCount(0, BACK);
  await expect(page.getByText('did you miss this')).toBeVisible(); // replayed from the server's ring
  await expect(page.getByText(/Some messages may have been missed/)).toHaveCount(0);
  await other.close();
});

test('going offline shows it, and coming back online reconnects', async ({ page, context }) => {
  await play(page);
  await context.setOffline(true);
  await expect(status(page)).toContainText(/offline/i);
  await context.setOffline(false);
  await expect(status(page)).toHaveCount(0, BACK);
  await say(page, 'SAY back online');
  await expect(page.getByText('You say: "back online"')).toBeVisible();
});

test('a reload during an outage lands back in the game once the network returns', async ({ page, net }) => {
  await play(page);
  await net.block();
  await page.reload();
  await expect(status(page)).toContainText(/Reconnecting|Connection lost/, BACK);
  await net.unblock();
  await expect(status(page)).toHaveCount(0, BACK);
  await expect(page.getByPlaceholder(INPUT)).toBeVisible();
  await say(page, 'SAY recovered');
  await expect(page.getByText('You say: "recovered"')).toBeVisible();
});
