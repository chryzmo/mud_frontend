import { expect, test } from '@playwright/test';
import { INPUT, confirmCode, joinAs, play, say, uniqueName } from './helpers';

test('a new guest joins, saves the recovery code and is in the world', async ({ page }) => {
  const name = uniqueName();
  const code = await joinAs(page, name);
  expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){2,}$/);

  // The code cannot be skipped: Start stays disabled until it is confirmed.
  await expect(page.getByRole('button', { name: 'Start playing' })).toBeDisabled();
  await confirmCode(page);

  await expect(page.getByText(/You are in/).first()).toBeVisible(); // the first look
  await expect(page.getByText(/HP/).first()).toBeVisible(); // stats arrived
  await expect(page.getByRole('button', { name: 'Look' })).toBeVisible();
});

test('the recovery code comes back after a reload until it is confirmed', async ({ page }) => {
  const code = await joinAs(page, uniqueName());
  await page.reload();
  await expect(page.getByTestId('recovery-code')).toHaveText(code);
  await confirmCode(page);
  await page.reload();
  await expect(page.getByTestId('recovery-code')).toHaveCount(0); // confirmed: not shown again
  await expect(page.getByPlaceholder(INPUT)).toBeVisible();
});

test('talking and moving work', async ({ page }) => {
  await play(page);
  await say(page, 'SAY hello there');
  await expect(page.getByText('You say: "hello there"')).toBeVisible();

  // The compass hides while the keyboard is up (the input has focus), so put the keyboard away first.
  await page.getByPlaceholder(INPUT).blur();
  const exits = page.locator('#navdiv button:not([disabled])');
  await expect(exits.first()).toBeVisible();
  const before = await page.locator('#header').textContent();
  await exits.first().click();
  await expect(page.locator('#header')).not.toHaveText(before!); // the room changed
});

test('a reload resumes the same character with a gap notice', async ({ page }) => {
  const { name } = await play(page);
  await say(page, 'SAY before the reload');
  await page.reload();
  await expect(page.getByText(/Some messages may have been missed/)).toBeVisible();
  await expect(page.getByPlaceholder(INPUT)).toBeVisible();
  await say(page, 'SAY after');
  await expect(page.getByText('You say: "after"')).toBeVisible();
  expect(name).toBeTruthy();
});

test('a name that is taken is refused, and another can be tried', async ({ browser }) => {
  const name = uniqueName();
  const first = await browser.newContext();
  await play(await first.newPage(), name);

  const second = await browser.newContext();
  const page = await second.newPage();
  await page.goto('/');
  await page.getByLabel('Pick a name').fill(name);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  await page.getByLabel('Pick a name').fill(uniqueName());
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('recovery-code')).toBeVisible();
  await first.close();
  await second.close();
});

test('the same character opened in a second tab takes over, and the first tab says so', async ({ context }) => {
  const one = await context.newPage();
  await play(one);
  const two = await context.newPage(); // same storage: same character
  await two.goto('/');
  await expect(two.getByPlaceholder(INPUT)).toBeVisible();
  await expect(one.getByText('Opened somewhere else')).toBeVisible();

  await one.getByRole('button', { name: 'Play here instead' }).click();
  await expect(one.getByPlaceholder(INPUT)).toBeVisible();
  await expect(two.getByText('Opened somewhere else')).toBeVisible(); // and the tabs take turns, not fight
});

test('a lost browser is recovered with the name and code, and the code changes', async ({ browser }) => {
  const original = await browser.newContext();
  const { name, code } = await play(await original.newPage());
  await original.close();

  const fresh = await browser.newContext(); // no storage: a new phone
  const page = await fresh.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'I have a recovery code' }).click();
  await page.getByLabel('Character name').fill(name);
  await page.getByLabel('Recovery code').fill(code);
  await page.getByRole('button', { name: 'Recover' }).click();

  const newCode = await page.getByTestId('recovery-code').textContent();
  expect(newCode!.trim()).not.toBe(code); // rotated on every recovery
  await confirmCode(page);
  await fresh.close();
});

test('a wrong recovery code is refused', async ({ browser }) => {
  const original = await browser.newContext();
  const { name } = await play(await original.newPage());
  await original.close();

  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'I have a recovery code' }).click();
  await page.getByLabel('Character name').fill(name);
  await page.getByLabel('Recovery code').fill('AAAA-AAAA-AAAA');
  await page.getByRole('button', { name: 'Recover' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await fresh.close();
});

test.describe('on a phone', () => {
  test('the page never scrolls sideways and the controls fit the screen', async ({ page }) => {
    await play(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const vp = page.viewportSize()!;
    for (const name of ['Look', 'Items', 'Stats', 'Guide', 'Chat']) {
      const box = (await page.getByRole('button', { name }).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
      expect(box.height).toBeGreaterThanOrEqual(44); // a thumb-sized target
    }
    const input = (await page.getByPlaceholder(INPUT).boundingBox())!;
    expect(input.y + input.height).toBeLessThanOrEqual(vp.height);
  });

  test('a tapped quick action reaches the server and its answer shows', async ({ page }) => {
    await play(page);
    await page.getByRole('button', { name: 'Stats' }).click();
    await expect(page.getByText('> STATS')).toBeVisible();
  });
});

test('pressing Enter sends a command once', async ({ page }) => {
  const sent: string[] = [];
  page.on('websocket', (ws) => ws.on('framesent', (f) => sent.push(String(f.payload))));
  await play(page);
  const before = sent.filter((p) => p.includes('SAY once only')).length;
  await say(page, 'SAY once only');
  await expect(page.getByText('You say: "once only"')).toBeVisible();
  expect(sent.filter((p) => p.includes('SAY once only')).length - before).toBe(1);
});
