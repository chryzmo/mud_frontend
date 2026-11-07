// The leaderboard page: no React, just a few DOM calls, so it loads fast on a phone and on the projector.
// Everything the server sends is put in with textContent, never as markup.
import { NAME, TAGLINE } from '../brand';
import { badgeGlyph, colorClass } from '../cosmetics';

export interface Entry {
  name: string;
  level: number;
  xp: number;
  explore: number;
  combat: number;
  color?: string;
  badge?: string;
}

export type TabKey = 'overall' | 'explorers' | 'fighters';

export interface Board {
  updated: string;
  total: number;
  overall: Entry[];
  explorers: Entry[];
  fighters: Entry[];
}

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'explorers', label: 'Explorers' },
  { key: 'fighters', label: 'Fighters' },
];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function entries(v: unknown): Entry[] {
  if (!Array.isArray(v)) return [];
  const out: Entry[] = [];
  for (const e of v) {
    if (!isObject(e) || typeof e.name !== 'string' || e.name === '') continue; // one bad entry is skipped
    out.push({
      name: e.name, level: num(e.level) || 1, xp: num(e.xp), explore: num(e.explore), combat: num(e.combat),
      color: typeof e.color === 'string' ? e.color : undefined, badge: typeof e.badge === 'string' ? e.badge : undefined,
    });
  }
  return out;
}

// parseBoard reads the /api/leaderboard JSON; null when it is not a leaderboard at all.
export function parseBoard(raw: unknown): Board | null {
  if (!isObject(raw) || !Array.isArray(raw.overall)) return null;
  return {
    updated: typeof raw.updated === 'string' ? raw.updated : '',
    total: num(raw.total),
    overall: entries(raw.overall), explorers: entries(raw.explorers), fighters: entries(raw.fighters),
  };
}

const el = (tag: string, className?: string, text?: string): HTMLElement => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

// nameCell is a name with the colour and badge the player chose; unknown keys draw a plain name.
export function nameCell(e: Entry): HTMLElement {
  const cell = el('span', ['name', colorClass(e.color)].filter(Boolean).join(' '));
  const glyph = badgeGlyph(e.badge);
  if (glyph) {
    const b = el('span', 'badge', glyph + ' ');
    b.setAttribute('role', 'img');
    b.setAttribute('aria-label', `${e.badge} badge`);
    cell.append(b);
  }
  cell.append(document.createTextNode(e.name));
  return cell;
}

// The number a tab ranks by, and what the row shows beside the level.
const SCORE: Record<TabKey, (e: Entry) => string> = {
  overall: (e) => `${e.xp} XP`,
  explorers: (e) => `${e.explore} exploring`,
  fighters: (e) => `${e.combat} fighting`,
};

export interface View {
  board: Board | null;
  tab: TabKey;
  // Set when the last refresh failed: the table stays, with a note.
  stale: boolean;
}

// renderBoard draws the page into root, replacing what was there.
export function renderBoard(root: HTMLElement, view: View, onTab: (t: TabKey) => void): void {
  root.replaceChildren();
  root.append(el('h1', undefined, NAME + ' leaderboard'));
  root.append(el('p', 'brand-tagline', TAGLINE));

  const tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  for (const t of TABS) {
    const b = el('button', t.key === view.tab ? 'tab active' : 'tab', t.label);
    b.setAttribute('type', 'button');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(t.key === view.tab));
    b.addEventListener('click', () => onTab(t.key));
    tabs.append(b);
  }
  root.append(tabs);

  if (!view.board) {
    root.append(el('p', 'note', view.stale ? 'Could not load the leaderboard. Trying again…' : 'Loading…'));
    return;
  }
  const list = view.board[view.tab];
  if (list.length === 0) {
    root.append(el('p', 'note', 'No one here yet. Go explore!'));
  } else {
    const table = el('ol', 'rows');
    list.forEach((e, i) => {
      const row = el('li', 'row');
      row.append(el('span', 'rank', String(i + 1)), nameCell(e), el('span', 'level', `Level ${e.level}`), el('span', 'score', SCORE[view.tab](e)));
      table.append(row);
    });
    root.append(table);
  }
  const foot = el('p', 'note');
  const who = view.board.total === 1 ? '1 player' : `${view.board.total} players`;
  foot.textContent = view.stale ? `${who} ranked. Could not refresh; showing the last list.` : `${who} ranked. Updates every few seconds.`;
  root.append(foot);
}
