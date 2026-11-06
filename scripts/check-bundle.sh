#!/usr/bin/env bash
# Fail if the built JavaScript outgrows its budget (gzipped, as a phone on cellular downloads it).
# Run after a build. Raise BUDGET_KB on purpose, not by accident.
set -euo pipefail
cd "$(dirname "$0")/.."

BUDGET_KB="${BUDGET_KB:-100}"
total=0
for f in dist/assets/*.js; do
	total=$((total + $(gzip -9 -c "$f" | wc -c)))
done
kb=$((total / 1024))
echo "bundle: ${kb} KB gzipped JavaScript (budget ${BUDGET_KB} KB)"
if [ "$kb" -gt "$BUDGET_KB" ]; then
	echo "check-bundle.sh: over budget" >&2
	exit 1
fi
