# AGENTS.md — mud_frontend

Browser client for the MUD, in React + TypeScript (currently Create React App). It talks to
`../mud_server` over a single websocket.

## Current goal and plans

The project is being prepared for a weekend event at MAGFest 2027: guest-only, phone-first play.
Plans live in `../mud_server/plans/` (start with `magfest-2027.md`). Read the plan before
non-trivial work, and update its checklist and log when work lands. The Create React App to Vite
migration is planned for Phase 0, so prefer changes that don't deepen the dependency on
`react-scripts`.

## Layout

- `src/App.tsx`: owns the websocket, parses every server message, holds app state.
- `src/components/`: `LoginModal`, `Chatbox`, `InputBar`, `NavButtons`, `StatsBar`, `InventoryModal`, `Header`.
- `src/types.ts`: the `ChatMessage` union rendered by `Chatbox`.
- `src/utils/constants.ts`: websocket URL and ANSI color constants.
- `src/index.css`: all styling (`src/css/App.css` is empty).

## Build and run

```sh
npm install
npm start        # dev server on :3000; expects the server at ws://127.0.0.1:8080/ws
npm run build
npx tsc --noEmit # type check
```

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
