#!/usr/bin/env bash
# Live smoke test: one guest on the deployed site (scripts/smoke-live.sh https://example.org).
# Only with the owner's go-ahead. It creates one real character. Never run it in CI.
set -euo pipefail
cd "$(dirname "$0")/.."

url="${1:-}"
case "$url" in
	https://*) ;;
	*) echo "usage: scripts/smoke-live.sh https://<site>   (https only)" >&2; exit 2 ;;
esac

[ -d node_modules ] || npm ci --silent
SMOKE_URL="$url" exec npx playwright test -c playwright.smoke.config.ts
