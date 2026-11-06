import { expect, Page } from '@playwright/test';
import { GM_NAMES, GM_PASSWORD } from './global-setup';
import { INPUT, play, say, test, uniqueName } from './helpers';

// The game master signs in at /staff and runs the room from the phone panel. Tests share one
// server, so nothing here uses LOCK (it would stop other tests joining) and every target is
// this test's own guest.

async function signInAsGM(page: Page, account: string) {
  await page.goto('/staff');
  await page.getByLabel('Name').fill(account);
  await page.getByLabel('Password').fill(GM_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByPlaceholder(INPUT)).toBeVisible();
}

async function panel(page: Page) {
  await page.getByPlaceholder(INPUT).blur();
  await page.getByRole('button', { name: 'GM', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Game master' })).toBeVisible();
}

test('a wrong staff password is refused', async ({ page }) => {
  await page.goto('/staff');
  await page.getByLabel('Name').fill(GM_NAMES[2]);
  await page.getByLabel('Password').fill('not the password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect password');
});

test('a guest never sees the GM button, and /staff does not resume their character', async ({ page }) => {
  await play(page);
  await expect(page.getByRole('button', { name: 'GM', exact: true })).toHaveCount(0);
  await page.goto('/staff'); // same browser storage: the guest token is there
  await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible();
});

test('the GM announces, mutes and kicks from the panel', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();
  await signInAsGM(gm, GM_NAMES[0]);

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  const { name } = await play(guest, uniqueName());

  // Announce: reaches the guest.
  await panel(gm);
  await gm.getByLabel('Announce to everyone').fill('The feast begins at nine!');
  await gm.getByRole('button', { name: 'Announce' }).click();
  await expect(guest.getByText('[GM] The feast begins at nine!')).toBeVisible();

  // Mute: the guest cannot speak, but is still told why.
  await panel(gm);
  await gm.getByLabel('Player').fill(name);
  await gm.getByRole('button', { name: 'Mute 15 min' }).click();
  await expect(guest.getByText(/A GM has muted you for 15 minutes/)).toBeVisible();
  await say(guest, 'SAY can anyone hear me');
  await expect(guest.getByText(/You are muted for another/)).toBeVisible();

  // Unmute, then kick: the guest lands on the break screen and stays there.
  await panel(gm);
  await gm.getByRole('button', { name: 'Unmute' }).click();
  await expect(guest.getByText('A GM has lifted your mute.')).toBeVisible();
  await panel(gm);
  await gm.getByRole('button', { name: 'Kick 10 min' }).click();
  await gm.getByRole('button', { name: `Really kick ${name} for 10 min?` }).click();
  await expect(guest.getByRole('heading', { name: 'Taking a break' })).toBeVisible();
  await expect(guest.getByRole('status')).toContainText('10 minutes');
  await guest.getByRole('button', { name: 'Try again' }).click();
  await expect(guest.getByRole('status')).toContainText('try again in about');

  // A reload during the break is refused the same way (the token is kept, the server remembers).
  await guest.reload();
  await expect(guest.getByRole('heading', { name: 'Taking a break' })).toBeVisible();

  await gmContext.close();
  await guestContext.close();
});

test('the GM keeps their place through a dropped connection', async ({ page, net }) => {
  await signInAsGM(page, GM_NAMES[1]);
  await say(page, 'SAY before the drop');
  await expect(page.getByText('You say: "before the drop"')).toBeVisible();
  await net.cut();
  // The page signs in again by itself, from memory, and the log is still there.
  await expect(page.getByText(/Some messages may have been missed/)).toBeVisible({ timeout: 40_000 });
  await say(page, 'SAY after the drop');
  await expect(page.getByText('You say: "after the drop"')).toBeVisible();
  await expect(page.getByText('You say: "before the drop"')).toBeVisible();
});
