# mud_frontend

Browser client for [mud_server](https://github.com/chryzmo/mud_server), built with React, TypeScript and Vite.

```sh
npm install
npm run dev        # http://localhost:3000; proxies /ws to the server on 127.0.0.1:8080
npm run build      # type check + production build into dist/
npm run preview    # serve the production build locally
npm run typecheck
npm test           # Vitest unit tests (npm run test:watch to watch)
scripts/test.sh    # everything above: type check, tests, build
```

The client connects to `/ws` on the host that served the page (`wss://` over HTTPS), offering the
websocket subprotocol `mud.v1`. Set `VITE_WS_URL` (for example in `.env.local`) to connect somewhere else.
Every frame is a flat JSON object with a type; `src/protocol.ts` parses and builds them, and the
protocol is documented in the server's README. The server is the source of truth for names, limits and
message shapes.

**Status:** this client still logs in or registers with a password. Guest join, resume, reconnect and the
mobile layout are the Phase 3 rebuild; `AGENTS.md` lists what the client must do with the new protocol.

Run `scripts/install-git-hooks.sh` once per clone to enable the pre-commit hook (secret scan, conflict markers, large files, tests).
