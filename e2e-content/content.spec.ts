import { expect, test } from '@playwright/test';
import { INPUT, play, say } from '../e2e/helpers';

// The client against a world with content: the fixture in e2e/content-world.mjs.

test('a new guest is welcomed and walked through the first steps', async ({ page }) => {
  await play(page);
  await expect(page.getByText('The Gatewarden bows. Welcome, traveller.')).toBeVisible();
  await expect(page.getByText("Warden's tip: tap Look.")).toBeVisible();

  await page.getByRole('button', { name: 'Look' }).click();
  await expect(page.getByText("Warden's tip: take an exit.")).toBeVisible();

  await page.getByPlaceholder(INPUT).blur();
  await page.locator('#navdiv button:not([disabled])').first().click();
  await expect(page.locator('#header')).toHaveText('The Yard');
  await expect(page.getByText("Warden's tip: examine the lamp.")).toBeVisible();
});

test('the walkthrough can be skipped', async ({ page }) => {
  await play(page);
  await say(page, 'TOUR SKIP');
  await expect(page.getByText('Walkthrough ended.')).toBeVisible();
});

test('scenery and people answer to EXAMINE and TALK', async ({ page }) => {
  await play(page);
  await say(page, 'EXAMINE lamp');
  await expect(page.getByText('A brass lamp hangs from a hook, unlit.')).toBeVisible();
  await say(page, 'TALK');
  await expect(page.getByText('Well met. Mind the step.')).toBeVisible();
});

test('the banner shows what is on now, and the list shows what is coming', async ({ page }) => {
  await play(page);
  const bar = page.getByRole('button', { name: /On now: Lantern Walk/ });
  await expect(bar).toBeVisible();
  await bar.click();
  const sheet = page.getByRole('dialog', { name: "What's on" });
  await expect(sheet.getByText('On now: Lantern Walk')).toBeVisible();
  await expect(sheet.getByText('Grand Feast')).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toHaveCount(0);
});

test('a quest earns a cosmetic, the Style sheet appears, and others see the name wear it', async ({ browser }) => {
  const watcher = await (await browser.newContext()).newPage();
  await play(watcher);

  const page = await (await browser.newContext()).newPage();
  await play(page);
  await expect(page.getByRole('button', { name: 'Style' })).toHaveCount(0); // nothing earned yet
  await say(page, 'READ plaque');
  await expect(page.getByText('Your name now shows in gold.')).toBeVisible();

  await page.getByRole('button', { name: 'Style' }).click();
  await expect(page.getByRole('dialog', { name: 'Style' }).getByRole('button', { name: 'gold (worn)' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await say(page, 'SAY shiny');
  await expect(watcher.getByText('shiny')).toBeVisible();
  await expect(watcher.locator('.nc-gold').first()).toBeVisible(); // the colour from the quest, on the speaker's name
});
