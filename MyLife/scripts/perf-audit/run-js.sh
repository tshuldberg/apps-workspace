#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/perf-audit/run-js.sh <script.mjs> [args...]" >&2
  exit 1
fi

if command -v node >/dev/null 2>&1; then
  exec node "$@"
fi

if command -v bun >/dev/null 2>&1; then
  exec bun "$@"
fi

echo "Error: neither 'node' nor 'bun' is available in PATH." >&2
exit 1
