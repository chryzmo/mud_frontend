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

test('the Guide lists what is on now and what is coming, with no event line on the main screen', async ({ page }) => {
  await play(page);
  await expect(page.getByRole('button', { name: 'Guide' })).toBeVisible();
  await expect(page.getByRole('button', { name: /On now: Lantern Walk/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Guide' }).click();
  await page.getByRole('button', { name: 'Events' }).click();
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

test('a learned spell appears on the bar and can be taken off and put back from the Spells sheet', async ({ page }) => {
  await play(page);
  await expect(page.getByRole('group', { name: 'Spells' })).toHaveCount(0); // nothing learned yet
  await say(page, 'LIGHT lamp');
  await expect(page.getByText(/You learn/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Spells' }).getByRole('button', { name: /Cast Glow/ })).toBeVisible();
  await expect(page.getByRole('log')).not.toContainText('[1;32m'); // colour inside a line is drawn, not shown as the raw escape

  await page.getByRole('button', { name: 'Spells', exact: true }).click();
  await page.getByRole('button', { name: /Glow · 1 MP · slot 1/ }).click();
  await page.getByRole('button', { name: 'Take off the bar' }).click();
  await expect(page.getByRole('button', { name: 'Slot 1 is empty' })).toBeVisible();

  await page.getByRole('button', { name: 'Slot 1 is empty' }).click(); // an empty slot opens the sheet
  await page.getByRole('button', { name: /^Glow · 1 MP$/ }).click();
  await page.getByRole('button', { name: 'Put in slot 1' }).click();
  await expect(page.getByRole('group', { name: 'Spells' }).getByRole('button', { name: /Cast Glow/ })).toBeVisible();
});
