#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$ROOT_DIR"

run() {
  echo "==> $*"
  "$@"
}

run pnpm --filter @mylife/web typecheck
run pnpm --filter @mylife/web test -- app/books/__tests__/social-contract-parity.test.ts
run pnpm --filter @mylife/mobile typecheck
run pnpm --filter @mylife/entitlements test
run pnpm --filter @mylife/db test

if [ "$#" -gt 0 ]; then
  for module in "$@"; do
    if [ -f "modules/$module/package.json" ]; then
      run pnpm --filter "@mylife/$module" run --if-present typecheck
      run pnpm --filter "@mylife/$module" run --if-present test
    else
      echo "Skipping unknown module: $module"
    fi
  done
fi

echo "Regression suite completed."
