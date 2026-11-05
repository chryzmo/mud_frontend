#!/usr/bin/env bash
# Run every frontend check: type check, unit tests, production build.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d node_modules ] || npm ci --silent

npm run --silent typecheck
npx vitest run
npx vite build --logLevel warn
