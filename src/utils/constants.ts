// Same host as the page by default, so dev (Vite proxy) and production (Caddy)
// both work without configuration.  Set VITE_WS_URL to point elsewhere.
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
export const wsUri = import.meta.env.VITE_WS_URL ?? `${wsProtocol}//${window.location.host}/ws`

export const MUDCOLOR = {
    ESCAPE_START : "\x1b[1;",
    ESCAPE_END : "\x1b[0m",
    RED : "31m",
	GREEN : "32m",
	BLUE : "34m",
    MAGENTA: "35m"
}

export {}
