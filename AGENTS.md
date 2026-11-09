# AGENTS.md — mud_frontend

Browser client for the MUD, in React + TypeScript, built with Vite. It talks to
`../mud_server` over a single websocket.

## Current goal and plans

The project is being prepared for a weekend live-play event: guest-only, phone-first play.
Plans live in `../mud_server/plans/` (start with `plans/README.md`, which lists them). Read the plan before
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

- `src/App.tsx`: picks the screen from the connection's phase. `src/session.ts` wires storage, connection, game state and
  the browser signals for the page (`getSession()`); `src/useSession.ts` has the React hooks.
- `src/screens/`: `Landing` (join, recover), `RecoveryCode` (cannot be skipped), `Ended` (idle, replaced, kicked, bad version),
  `Game`, and `StaffLogin` (the hidden `/staff` sign-in for the game master). `src/components/GMPanel.tsx` is the
  GM's phone panel (buttons that send `GM ...` commands).
- `src/net/`: the new connection layer (no React). `frames.ts` parses and builds frames; `connection.ts` is the session
  state machine (join, resume, recover, reconnect, terminal states, frame counting); `backoff.ts`, `storage.ts`.
  `testdata/transcripts.json` is the server's recorded wire behaviour, replayed by `transcripts.test.ts`.
- `src/game/`: the game model (no React): `entries.ts` turns frames into log lines (ANSI colour included, and a whole line in the italic escape `ESC[3m ... ESC[0m` becomes an `italic` entry), `state.ts` is the
  reducer (capped log of 500, room, stats, inventory), `store.ts` joins a connection to it (`send` echoes then sends).
- `src/components/`: `Chatbox`, `InputBar`, `NavButtons`, `StatsBar`, `InventoryModal`, `Header`.
- `leaderboard.html` + `src/leaderboard/` is the leaderboard page (a second Vite entry, no React, served at `/leaderboard.html`): `board.ts` parses `/api/leaderboard` and draws it with `textContent` only, `main.ts` refreshes every 10 s. The stats bar shows level and XP from the `stats` frame.
- `src/cosmetics.ts` is the fixed set of name colours and badges a quest or boss can grant (the server's list is in `worldfile/cosmetics.go`); `NameTag` draws a name with them and ignores any key not in the set, and `StyleSheet` (the Style quick action, shown only once a player owns something) picks what to wear. Colours are `--nc-*` tokens in `index.css`, contrast-tested in `theme.test.ts`.
- `src/game/events.ts` reads the server's `events` frame (what is on now and what is next, as Unix milliseconds) and words it; `EventsSheet` lists them with start times in the player's own zone (`AboutSheet`, the last Guide entry, says what ConQuest is and links to the game server's and the web client's repositories and the server's new-issue page, `brand.ts`); it opens from the Guide's Events entry, which shows only while an event is on or coming (there is no event line on the main screen, by the owner's choice; `bannerText` is kept for a future occasional notice).
- `SpellBar` is the three readied spells above the controls (shown once the `spells` frame lists a known spell): one tap sends `CAST <slot>`, a button waits out its spell's cooldown on this device (the server holds the real one) and is dimmed when `stats.mp` is short; an empty slot opens the Spells sheet. `Game.tsx` builds that sheet (Spells quick action), adds "Cast <spell>" to a tapped monster (bolts) or player (mends), a Shop action for people whose `verbs` include `SHOP` (it fills the input with `BUY `), and Use and Read on a pack item.
- `src/utils/constants.ts`: websocket URL (same host, `/ws`; `VITE_WS_URL` overrides) and ANSI color constants.
- `e2e/`: Playwright tests and their server launcher (see End-to-end tests). `*.test.ts(x)` next to the code they test; Vitest + Testing Library, set up in `src/setupTests.ts`.
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
- **Every PR gets a real description.** Say what changed and why, the deploy note (merging deploys while
  `AUTO_DEPLOY` is true; say whether players see a change), what was tested and what was not verified.
  Pass it with `gh pr create --body-file <file>` (or `--body "<text>"`), never `--body -`: `gh` takes that
  as the literal text "-" and the PR is left blank. After creating or editing, check it with
  `gh pr view <n> --json body -q '.body|length'`.
- **Commit through the pre-commit hook.** Run `scripts/install-git-hooks.sh` once per clone. The
  hook (`.githooks/pre-commit`) blocks files that usually hold secrets, secrets in the staged
  changes, merge-conflict markers and files over 1 MB, then runs `scripts/test.sh` (skipped if
  that exact tree already passed). Don't use `git commit --no-verify` unless the user asks. If the
  secret scan flags something safe, mark that line with a `pre-commit: allow-secret` comment.
- Tests do not run automatically at the end of an agent turn. Run `scripts/test.sh` once before committing
  or pushing (the pre-commit hook runs it again unless that exact tree already passed), and during
  development when it makes sense.

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
  flat JSON object with a type `t`; all of it lives in `src/net/frames.ts`.
- Client to server: `cmd {line}`, `join {name}`, `resume {token, received?}`, `recover {name, code}`, and `login {username, password}`
  for the game master only (the `/staff` page; the password stays in memory and a drop signs in again from it).
- Server to client: `hello`, `auth`, `text`, `say`, `arrive`, `leave`, `whisper`, `stats`, `room`, `inventory`,
  `error`. `src/game/entries.ts` words and styles the events; `text` still carries ANSI colour codes
  (red = NPC, blue = player, green = item; magenta `35m` = words a character in the world speaks, cyan `36m` = words you spoke, drawn
  violet and teal; a player's name in a list may be followed by `ESC]look;<colour>;<badge>BEL`, the name colour and badge to draw it with (either may be empty); other players' SAY is a `say` frame whose quoted words are amber), styled per line by `textLines`; a whole line wrapped in `ESC[3m ... ESC[0m` is
  drawn in italics (the server uses it for XP gains).
  Tappable text is marked with more codes: yellow `33m` is scenery in a "You notice: ..." line (a tap sends `EXAMINE <name>`), white `37m`
  is a topic after a character's red name in the same line (`ASK <name> ABOUT <topic>`), and bright magenta `95m` is a character
  named in the "Also here: ..." list (`TALK <name>`). A monster's name in red at the start of a line is tapped whole (the sheet offers Attack).
- The connection routes by frame type; nothing is detected by matching server wording.

The server side is `../mud_server/src/internal/mudserver/protocol.go` (design in
`../mud_server/plans/json-protocol.md`). Change both sides together.

## What a client must do with the protocol

The server's guest sessions are built; **this client does not yet implement most of what follows. The
Phase 3 rebuild must.** The server's README has the message tables; `../mud_server/plans/guest-sessions.md`
has the reasoning.

- **Join by name.** `join {name}`. Names are 3-16 of `A-Z a-z 0-9 _ -` with a letter, unique ignoring case;
  the server is authoritative, so show its `invalid_name` / `name_taken` message. On success the `auth`
  reply has a one-time `token` and `recovery` code: store the token (`localStorage`, in a `try`; storage can
  be unavailable), and show the recovery code once with a way to copy it and a prompt to save it.
- **Count frames.** Count every frame you process except `hello`, `auth` and `error`, by its type `t` and whether or not you understand it (a later phase adds frame types). Never count a replayed
  frame twice: after a resume, set the count to the reply's `base` (absent means 0), then count the
  `replayed` frames that follow.
- **Resume, don't re-join.** On a page load with a stored token, or after a drop, send
  `resume {token, received}`. `auth.gap` means frames were lost or the server restarted: treat the screen
  as stale (a fresh `room` and `stats` follow) and say so. `bad_token` means the character is gone from
  this token: offer recovery or a new name.
- **Reconnect politely.** On an unexpected close, the first retry waits 0-1 s (a single drop is usually a blip; the
  storm tests show a crowd is safe), then exponential backoff (1 s doubling to 10 s) plus 0-5 s of random jitter;
  after a `restarting` error the first retry uses the 0-5 s jitter. Retry within 1 s (jittered) on `online`, and when
  the page becomes visible after more than 10 s hidden replace the socket and resume, since a phone that slept has
  usually lost it without being told. A `rate_limited` error
  with `retry_ms` is the join limit: wait exactly that, with a little jitter, instead of backing off further. Without
  `retry_ms` it is the per-command or SAY limiter: a notice only.
  `restarting` means the server is going down: reconnect with jitter. `at_capacity`: say so and retry.
- **Some closes are not reconnects.** After an `idle` error, stop and show "you were away" with a tap to
  rejoin; a client that reconnects by itself takes its slot straight back. Likewise stop on `replaced` (another tab or
  device took the character; a tap takes it back), `kicked` (a GM sent the character on a break: say so with the
  server's words; a tap asks again and is refused until it is over), `bad_token` (the stored token is dropped, the name kept for
  recovery) and `bad_version` (the page is stale: reload it).
- **Codes arrive in two frame types.** `error` carries `rate_limited`, `idle`, `replaced`, `kicked`, `restarting`,
  `bad_version`; an `auth` with `ok:false` carries `bad_token`, `at_capacity`, `invalid_name`, `name_taken`,
  `bad_recovery`, `recovery_locked`, `kicked` (a resume, recover or login during a GM's break; terminal, the token is
  kept), `joins_locked`, and for staff `bad_password`, `unknown_user`, `name_online`. Handle a code in the frame type it arrives in.
- **Recover.** `recover {name, code}` (any case, dashes optional) returns a *new* token and a *new* recovery
  code: replace both and show the code again. `recovery_locked` carries `retry_ms`; show the wait.
- **Do not trust the client for secrets or limits.** Nothing in the page is authoritative: the server
  rate-limits, validates names and decides who a token belongs to.
- **Do not register.** `register` and `login` are for GM accounts and are going away.

## End-to-end tests (Playwright)

`e2e/*.spec.ts` drive a real browser (a phone-sized Chromium; WebKit too when `E2E_WEBKIT=1`) against the production
build and a real `mud_server` with Postgres. `playwright.config.ts` starts both: `e2e/server.mjs` reseeds the database
from `../mud_server/src/sql`, builds and runs the Go server on :18080, and `vite preview` serves the build on :4173
with `/ws` proxied to it.

```sh
scripts/e2e.sh                 # needs ../mud_server (or MUD_SERVER_DIR), Go, and its Postgres (db.sh up)
scripts/e2e.sh -g "recover"    # extra arguments go to Playwright
npx playwright install chromium   # once per machine
```

- The database is **dropped and reseeded** each run: by default the server's `mud_test`; set `E2E_DATABASE_URL` for
  another. `server.mjs` refuses a database whose name does not end in `_test` or `_e2e`.
- Select by role, label, placeholder or text (as the component tests do), not by CSS, so layout work does not break
  them. Use `uniqueName()` for guests; tests run in parallel and the database is shared.
- `e2e/proxy.mjs` sits between the web server and the game server. Import `test` from `e2e/helpers.ts` (not from
  `@playwright/test`) to get a `net` fixture: `net.cut()` drops this browser's connection, `net.block()` / `net.unblock()`
  make an outage. Each browser context is tagged by a cookie, so one test never cuts another's connection.
- **Content mode:** `scripts/e2e.sh --content` (or `E2E_CONTENT=1`) runs `e2e-content/*.spec.ts` against a server that plays the fixture world
  in `e2e/content-world.mjs` (written fresh each run so event times are relative to now: a walkthrough, a person, scenery, an event on
  now and one coming, one quest that grants a colour with the `unlock` rule effect). Use it for anything the SQL-seeded world cannot show. The fixture
  holds no real world text; the server validates it at start, so a schema change that breaks it fails loudly. CI runs it after the normal run.
- No retries: a flaky e2e test is a bug. CI runs the `e2e` job after `test`, checking out `mud_server` `main`.
- Staff tests sign in as seeded GM accounts (`e2e/global-setup.ts` creates `e2egmone`..`e2egmthree` after the server is up;
  one account per test, since the server allows one session per account and tests run in parallel). Never use `GM LOCK` in
  an e2e test: it would stop other tests joining. These tests need a server with the GM commands (`mud_server` main).
- The compass and stats hide while the input has focus *and* the visible height is under 420px (keyboard up on a
  short screen); on taller screens they stay. Blur the input before using them to be safe.
- Never point these at production. A live smoke test is a manual, owner-authorized step: `scripts/smoke-live.sh https://<site>`
  runs `smoke/live.spec.ts` (one guest: join, play, drop the network, reload) with `playwright.smoke.config.ts`. It is not in CI.

## Look and accessibility

- Colours are tokens at the top of `src/index.css` (`:root`, with a dark set under `prefers-color-scheme: dark`). Use a
  token, never a colour literal. `src/theme.test.ts` checks every text/background pair against WCAG AA (4.5:1) in both
  themes; add new pairs to it.
- The log is a `role="log"` live region; sheets are `role="dialog"` with focus moved in, kept in, and restored
  (`useDialogFocus`). Keyboard focus is always visible; motion is switched off for `prefers-reduced-motion`.
- Log rows are memoised (`chatPerf.rowRenders` lets a test prove one new line renders one row). Keep entries immutable.
- `scripts/check-bundle.sh` (run by `scripts/test.sh`) fails above 100 KB of gzipped JavaScript; raise it on purpose.
- The icons in `public/` are placeholders generated for this project (a "MUD" monogram), not event artwork.

## Wire transcripts

`src/net/testdata/transcripts.json` is generated by the server (`mud_server/src/transcripts_test.go`) and copied here.
Do not edit it. After a protocol change, regenerate it in `mud_server`, run `scripts/check-transcripts.sh --update`
from there, and change the parser and tests in the same pair of PRs; `scripts/check-transcripts.sh` fails if the copies
differ. The replay test drives the real connection through every recorded scenario.

## Conventions

- Function components with `FC<Props>`; props interfaces defined in the component file.
- Keep server-message parsing in `src/net/frames.ts` rather than spreading it through components.
- Design for phones first: test at phone widths and with the on-screen keyboard open.
- Commit or push only when asked; branch off `main` for changes.
