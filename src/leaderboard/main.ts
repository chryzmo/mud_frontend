import '../index.css';
import './leaderboard.css';
import { Board, TabKey, parseBoard, renderBoard } from './board';

const REFRESH_MS = 10_000;
const root = document.getElementById('board')!;
const view: { board: Board | null; tab: TabKey; stale: boolean } = { board: null, tab: 'overall', stale: false };

const draw = () =>
  renderBoard(root, view, (tab) => {
    view.tab = tab;
    draw();
  });

async function refresh() {
  try {
    const res = await fetch('/api/leaderboard', { cache: 'no-cache' });
    const board = res.ok ? parseBoard(await res.json()) : null;
    if (!board) throw new Error('bad leaderboard');
    view.board = board;
    view.stale = false;
  } catch {
    view.stale = true; // keep showing the last list
  }
  draw();
}

draw();
void refresh();
setInterval(() => {
  if (!document.hidden) void refresh();
}, REFRESH_MS);
