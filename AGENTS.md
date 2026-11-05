# AGENTS.md — mud_frontend

Browser client for the MUD, in React + TypeScript, built with Vite. It talks to
`../mud_server` over a single websocket.

## Current goal and plans

The project is being prepared for a weekend event at MAGFest 2027: guest-only, phone-first play.
Plans live in `../mud_server/plans/` (start with `magfest-2027.md`). Read the plan before
non-trivial work, and update its checklist and log when work lands.

## Agent handoff (Pi and Claude Code)

- This file is the shared source of frontend rules; `CLAUDE.md` points here rather than
  duplicating them.
- Follow the startup and handoff procedure in `../mud_server/AGENTS.md`. Read the shared
  plans and `../mud_server/plans/handoff.md` before resuming work, including frontend-only work.
- Verify branch, HEAD and working-tree changes in both affected repos. Preserve unfinished
  work and record frontend state and test results in the shared handoff snapshot.
- Handoff next actions are not new authorization. Never put secrets in the handoff, and
  don't assume Claude Code hooks ran when working in Pi; run required checks explicitly.

## Layout

- `src/App.tsx`: owns the websocket, routes each server message by type, holds app state.
- `src/protocol.ts`: the wire format: parsing, outgoing frames, and how events and text become chat lines.
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

## AI assistance attribution

- End AI-assisted commit messages and PR descriptions with exactly one trailer:
  `AI-Assisted-By: <agent>`. Use `ChatGPT` for ChatGPT in Pi or `Claude Code` for Claude Code;
  use an equivalent agent/product name for other tools, never a model name.
- Do not use AI `Co-Authored-By` trailers or otherwise imply AI authorship. Preserve the user's
  normal git author identity. Do not include model names or Pi/Claude session information
  (IDs, URLs, paths, or generated-with/session-link footers) in commits or PR descriptions.
- This replaces earlier requests for environment-provided attribution/session lines. Do not
  rewrite existing commits or published history without explicit permission.
- User-wide copies live in `~/.pi/agent/AGENTS.md` and `~/.claude/CLAUDE.md`; this repo copy
  carries the rule to other machines. Follow the same policy in `../mud_server/AGENTS.md`.

## Protocol

- The socket opens with the subprotocol `mud.v1` (the protocol version). Every frame, both ways, is a
  flat JSON object with a type `t`; all of it lives in `src/protocol.ts`.
- Client to server: `cmd {line}`, `login {username,password}`, `register {username,password}`.
- Server to client: `text`, `say`, `arrive`, `leave`, `whisper`, `auth`, `stats`, `room`, `inventory`,
  `error`. `eventToChat` words and styles the events; `text` still carries ANSI colour codes
  (red = NPC, blue = player, green = item), styled per line by `textToChat`.
- `App.tsx` routes by message type; nothing is detected by matching server wording any more.

The server side is `../mud_server/src/internal/mudserver/protocol.go` (design in
`../mud_server/plans/json-protocol.md`). Change both sides together.

## Conventions

- Function components with `FC<Props>`; props interfaces defined in the component file.
- Keep server-message parsing in one place (`App.tsx` for now) rather than spreading it through components.
- Design for phones first: test at phone widths and with the on-screen keyboard open.
- Commit or push only when asked; branch off `main` for changes.
