#!/usr/bin/env bash
# Run the end-to-end tests (Playwright) against a real server and Postgres.
#
#   scripts/e2e.sh                 all tests
#   scripts/e2e.sh -g "recover"    only tests matching a pattern (extra args go to Playwright)
#   scripts/e2e.sh --content       the content-mode tests (e2e-content/): the server plays a fixture
#                                  world with people, scenery, a walkthrough, events and a sticker
#
# Needs: ../mud_server (or MUD_SERVER_DIR) with Go installed, and the server repo's local
# Postgres (`scripts/db.sh up` there). The database is DROPPED AND RESEEDED each run:
# by default the server's test database, mud_test; set E2E_DATABASE_URL for another
# (its name must end in _test or _e2e). One-time browser install: npx playwright install chromium
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" = "--content" ]; then
	export E2E_CONTENT=1
	shift
fi

[ -d node_modules ] || npm ci --silent
export MUD_SERVER_DIR="${MUD_SERVER_DIR:-$PWD/../mud_server}"

if [ -z "${E2E_DATABASE_URL:-}" ] && [ -x "$MUD_SERVER_DIR/scripts/db.sh" ]; then
	"$MUD_SERVER_DIR/scripts/db.sh" up || echo "e2e.sh: could not start the local database; is one already running?" >&2
fi

exec npx playwright test "$@"
