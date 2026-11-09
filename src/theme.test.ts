import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Reads the colour tokens from index.css and checks every text/background pair
// against WCAG AA (4.5:1 for text), in the light and the dark theme.
const css = readFileSync('src/index.css', 'utf8') // vitest runs from the repo root;

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)')));
const dark = { ...light, ...tokens(css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf('* { box-sizing'))) };

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [text token, background token]
const PAIRS: [string, string][] = [
  ['ink', 'bg'], ['ink', 'panel'], ['ink', 'card'], ['muted', 'bg'], ['muted', 'panel'], ['muted', 'card'],
  ['accent-ink', 'accent'], ['accent', 'card'],
  ['danger', 'danger-bg'], ['note-ink', 'note-bg'], ['warn-ink', 'warn-bg'],
  ['npc', 'panel'], ['player', 'panel'], ['item', 'panel'], ['whisper', 'panel'], ['global', 'panel'], ['warn-ink', 'panel'],
  ...['gold', 'crimson', 'azure', 'emerald', 'violet', 'amber', 'rose', 'silver'].map((c): [string, string] => [`nc-${c}`, 'panel']),
  ...['speech-me', 'speech-other', 'speech-npc'].map((c): [string, string] => [c, 'panel']),
  ['hp', 'bg'], ['mp', 'bg'], ['boost', 'bg'],
];

describe.each([['light', light], ['dark', dark]] as const)('%s theme colours', (_name, t) => {
  it.each(PAIRS)('%s on %s is readable', (fg, bg) => {
    expect(t[fg], `--${fg}`).toBeDefined();
    expect(t[bg], `--${bg}`).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
