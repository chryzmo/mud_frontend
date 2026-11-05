# AGENTS.md — mud_frontend

Browser client for the MUD, in React + TypeScript, built with Vite. It talks to
`../mud_server` over a single websocket.

## Current goal and plans

The project is being prepared for a weekend event at MAGFest 2027: guest-only, phone-first play.
Plans live in `../mud_server/plans/` (start with `magfest-2027.md`). Read the plan before
non-trivial work, and update its checklist and log when work lands.

## Layout

- `src/App.tsx`: owns the websocket, parses every server message, holds app state.
- `src/components/`: `LoginModal`, `Chatbox`, `InputBar`, `NavButtons`, `StatsBar`, `InventoryModal`, `Header`.
- `src/types.ts`: the `ChatMessage` union rendered by `Chatbox`.
- `src/utils/constants.ts`: websocket URL (same host, `/ws`; `VITE_WS_URL` overrides) and ANSI color constants.
- `*.test.ts(x)` next to the code they test; Vitest + Testing Library, set up in `src/setupTests.ts`.
- `src/index.css`: all styling (`src/css/App.css` is empty).

## Build and run

```sh
npm install
npm run dev        # dev server on :3000; proxies /ws to the Go server on 127.0.0.1:8080
npm test           # Vitest
npm run typecheck
scripts/test.sh    # type check + tests + production build
```

## Tests and commits (required)

- **New features ship with tests.** Every new feature or behavior change includes tests that cover
  it, in the same PR. A bug fix includes a test that fails without the fix. If something can't
  reasonably be tested automatically, say why in the PR description.
- **The local suite must pass before you open or update a PR.** Run `scripts/test.sh` and make
  sure it passes, then report it in the PR's testing section. Don't open a PR with failing or
  skipped checks; if a failure isn't caused by your change, raise it with the user first.
- **Commit through the pre-commit hook.** Run `scripts/install-git-hooks.sh` once per clone. The
  hook (`.githooks/pre-commit`) blocks files that usually hold secrets, secrets in the staged
  changes, merge-conflict markers and files over 1 MB, then runs `scripts/test.sh` (skipped if
  that exact tree already passed). Don't use `git commit --no-verify` unless the user asks. If the
  secret scan flags something safe, mark that line with a `pre-commit: allow-secret` comment.
- In Claude Code, `.claude/settings.json` adds a Stop hook (`scripts/agent-stop-hook.sh`) that runs
  `scripts/test.sh` when a turn changed the repo and sends failures back to you. Other agents:
  run it yourself before finishing.

## Protocol, as it stands

- The client sends raw command lines (`MOVE N`, `SAY hi`, `/LOGIN name pass`).
- The server sends plain text with ANSI colors. `App.tsx` classifies each line by its leading color
  code (red = NPC, blue = player, green = item) and intercepts `STATUPDATE:` and `Exits:` lines.
- Login is detected by matching server text ("Welcome back," / "Account created!").

Any change to message wording or colors in `../mud_server` can break parsing here, and vice versa.
Change both sides together. The plan replaces this with a typed JSON protocol.

## Conventions

- Function components with `FC<Props>`; props interfaces defined in the component file.
- Keep server-message parsing in one place (`App.tsx` for now) rather than spreading it through components.
- Design for phones first: test at phone widths and with the on-screen keyboard open.
- Commit or push only when asked; branch off `main` for changes.
