#!/bin/bash
# EAS Build Preflight Check
# Run before `eas build` to catch issues that waste 5+ min per failed remote build.
# Usage: pnpm eas:preflight

set -e
cd "$(dirname "$0")/.."
MOBILE_DIR="apps/mobile"
FAIL=0

echo "=== EAS Build Preflight ==="
echo ""

# 1. Check for crypto.randomUUID() in mobile code
echo "1/6 Checking for crypto.randomUUID()..."
CRYPTO_HITS=$(grep -r "crypto\.randomUUID" "$MOBILE_DIR/app" "$MOBILE_DIR/components" "$MOBILE_DIR/lib" "$MOBILE_DIR/hooks" 2>/dev/null | grep -v node_modules | grep -v __tests__ || true)
if [ -n "$CRYPTO_HITS" ]; then
  echo "  FAIL: crypto.randomUUID() found (use lib/uuid instead):"
  echo "$CRYPTO_HITS" | head -5
  FAIL=1
else
  echo "  OK"
fi

# 2. Check @mylife/* imports vs declared dependencies
echo "2/6 Checking @mylife/* dependency declarations..."
IMPORTED=$(grep -roh '@mylife/[a-z-]*' "$MOBILE_DIR/app/" "$MOBILE_DIR/components/" "$MOBILE_DIR/lib/" "$MOBILE_DIR/hooks/" 2>/dev/null | sort -u | sed 's/@mylife\///' || true)
DECLARED=$(grep '"@mylife/' "$MOBILE_DIR/package.json" | sed 's/.*"@mylife\///' | sed 's/".*//' | sort -u)

MISSING=""
for pkg in $IMPORTED; do
  if ! echo "$DECLARED" | grep -q "^${pkg}$"; then
    MISSING="$MISSING $pkg"
  fi
done

if [ -n "$MISSING" ]; then
  echo "  FAIL: Imported but not declared in package.json:$MISSING"
  FAIL=1
else
  echo "  OK"
fi

# 3. Check for Node-only imports in mobile code
echo "3/6 Checking for Node-only imports..."
NODE_HITS=$(grep -rn "from 'fs'" "$MOBILE_DIR/app" "$MOBILE_DIR/components" "$MOBILE_DIR/lib" 2>/dev/null | grep -v node_modules | grep -v __tests__ || true)
NODE_HITS="$NODE_HITS$(grep -rn "from 'path'" "$MOBILE_DIR/app" "$MOBILE_DIR/components" "$MOBILE_DIR/lib" 2>/dev/null | grep -v node_modules | grep -v __tests__ || true)"
NODE_HITS="$NODE_HITS$(grep -rn "from 'node:" "$MOBILE_DIR/app" "$MOBILE_DIR/components" "$MOBILE_DIR/lib" 2>/dev/null | grep -v node_modules | grep -v __tests__ || true)"
if [ -n "$NODE_HITS" ]; then
  echo "  FAIL: Node-only imports found:"
  echo "$NODE_HITS" | head -5
  FAIL=1
else
  echo "  OK"
fi

# 4. TypeScript check
echo "4/6 Running typecheck..."
if pnpm --dir "$MOBILE_DIR" typecheck > /dev/null 2>&1; then
  echo "  OK"
else
  echo "  FAIL: TypeScript errors found. Run: pnpm --dir apps/mobile typecheck"
  FAIL=1
fi

# 5. Production bundle test
echo "5/6 Testing production bundle (Metro)..."
cd "$MOBILE_DIR"
if npx expo export --platform ios > /dev/null 2>&1; then
  echo "  OK"
else
  echo "  FAIL: Metro bundle failed. Run: cd apps/mobile && npx expo export --platform ios"
  FAIL=1
fi
cd ../..

# 6. Frozen lockfile check (EAS uses --frozen-lockfile)
echo "6/6 Checking pnpm lockfile sync..."
if pnpm install --frozen-lockfile > /dev/null 2>&1; then
  echo "  OK"
else
  echo "  FAIL: pnpm-lock.yaml is out of sync with package.json files."
  echo "    Run: pnpm install && git add pnpm-lock.yaml && git commit"
  FAIL=1
fi

echo ""
if [ $FAIL -eq 1 ]; then
  echo "=== PREFLIGHT FAILED ==="
  echo "Fix the issues above before running eas build."
  exit 1
else
  echo "=== PREFLIGHT PASSED ==="
  echo "Safe to run: eas build --platform ios --profile production --auto-submit"
fi
