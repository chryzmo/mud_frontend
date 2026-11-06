import { expect, Page } from '@playwright/test';

// A name no other test (or earlier run) has used. Random letters, because tests run
// in parallel workers: a clock or a counter would repeat across them. Letters only:
// names are checked against a word filter that also reads digits as letters.
export function uniqueName(): string {
  const letters = 'bcdfghjklmnpqrstvwxz';
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return 'Pw' + Array.from(bytes, (b) => letters[b % letters.length]).join('');
}

export const INPUT = 'What would you like to do..?';

// joinAs types a name, taps Play and returns the recovery code the page shows.
export async function joinAs(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Pick a name').fill(name);
  await page.getByRole('button', { name: 'Play' }).click();
  const code = page.getByTestId('recovery-code');
  await expect(code).toBeVisible();
  return (await code.textContent())!.trim();
}

// confirmCode ticks "I have saved my code" and starts playing.
export async function confirmCode(page: Page) {
  await page.getByLabel('I have saved my code').check();
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.getByPlaceholder(INPUT)).toBeVisible();
}

// play joins, confirms the code and waits for the game screen.
export async function play(page: Page, name = uniqueName()): Promise<{ name: string; code: string }> {
  const code = await joinAs(page, name);
  await confirmCode(page);
  return { name, code };
}

export async function say(page: Page, line: string) {
  const box = page.getByPlaceholder(INPUT);
  await box.fill(line);
  await box.press('Enter');
}
