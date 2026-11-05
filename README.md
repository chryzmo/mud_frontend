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

The client connects to `/ws` on the host that served the page (`wss://` over HTTPS).
Set `VITE_WS_URL` (for example in `.env.local`) to connect somewhere else.
