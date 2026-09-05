#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$ROOT_DIR"

run() {
  echo "==> $*"
  "$@"
}

reset_e2e_runtime() {
  pkill -f 'next dev --port 3115' 2>/dev/null || true
  pkill -f '@playwright/test/cli.js test' 2>/dev/null || true
  pkill -f 'chromium_headless_shell-1208' 2>/dev/null || true

  if command -v lsof >/dev/null 2>&1; then
    for _ in 1 2 3 4 5; do
      PORT_PIDS="$(lsof -ti tcp:3115 2>/dev/null || true)"
      if [ -z "$PORT_PIDS" ]; then
        break
      fi
      kill -9 $PORT_PIDS 2>/dev/null || true
      sleep 1
    done
  fi

  sleep 2
}

run_web_e2e_spec() {
  spec="$1"
  reset_e2e_runtime
  run pnpm -C apps/web exec playwright test "$spec" --workers=1 --reporter=line
  reset_e2e_runtime
}

run pnpm --filter @mylife/db test
run pnpm --filter @mylife/budget test
run pnpm --filter @mylife/entitlements test
run pnpm --filter @mylife/web test
run pnpm --filter @mylife/mobile test

# Run web E2E specs independently. This avoids intermittent dev-server drops
# observed during long single-process Playwright runs.
run_web_e2e_spec e2e/api-auth-and-pipeline.spec.ts
run_web_e2e_spec e2e/books-user-flows.spec.ts
run_web_e2e_spec e2e/budget-user-flows.spec.ts
run_web_e2e_spec e2e/hub-and-settings.spec.ts
run_web_e2e_spec e2e/local-module-crud.spec.ts

echo "Full behavior suite completed."
