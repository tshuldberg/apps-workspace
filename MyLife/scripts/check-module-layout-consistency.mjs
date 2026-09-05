#!/usr/bin/env node

/**
 * Guard against unified-module-navigation regressions.
 *
 * Every module `_layout.tsx` under `apps/mobile/app/(*)/` is expected to
 * delegate its tab bar + header chrome to one of:
 *   - `ModuleLayoutWrapper` (registered modules)
 *   - the shared nav primitives (`ModuleTabBarBackground`, `getTabBarStyle`,
 *     `getTabBarLabelStyle`) — used by shell meta-routes like `(social)`
 *     that aren't registered modules
 *
 * We flag any module layout that both declares inline `tabBarStyle: {…}` with
 * hardcoded dimensions AND does not import the shared primitives. This catches
 * drift (e.g. a new module copying the old social pattern) without blocking
 * intentional overrides that go through the wrapper's `screenOptions` prop.
 *
 * Run via `pnpm check:module-layouts`. Also wired into `pnpm check:parity`.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MOBILE_APP = path.join(ROOT, 'apps', 'mobile', 'app');
const ALLOWED_PRIMITIVES = new Set([
  'ModuleLayoutWrapper',
  'ModuleTabBarBackground',
  'getTabBarStyle',
]);

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function findModuleLayouts() {
  if (!fs.existsSync(MOBILE_APP)) return [];
  const entries = fs.readdirSync(MOBILE_APP, { withFileTypes: true });
  const layouts = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('(') || !entry.name.endsWith(')')) continue;
    if (entry.name === '(auth)' || entry.name === '(onboarding)') continue;
    const direct = path.join(MOBILE_APP, entry.name, '_layout.tsx');
    const tabsNested = path.join(MOBILE_APP, entry.name, '(tabs)', '_layout.tsx');
    if (fs.existsSync(direct)) layouts.push(direct);
    if (fs.existsSync(tabsNested)) layouts.push(tabsNested);
  }
  return layouts;
}

function violatesUnification(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const hasInlineTabBarStyle = /tabBarStyle:\s*\{[^}]*(?:height|backgroundColor|borderTop)/s.test(source);
  if (!hasInlineTabBarStyle) return null;

  const importsAllowedPrimitive = [...ALLOWED_PRIMITIVES].some((name) =>
    new RegExp(`\\b${name}\\b`).test(source),
  );
  if (importsAllowedPrimitive) return null;

  return 'Declares inline tabBarStyle with hardcoded dimensions without importing a unified-nav primitive.';
}

function main() {
  const layouts = findModuleLayouts();
  if (layouts.length === 0) {
    console.log('No mobile module layouts found.');
    return;
  }

  const violations = [];
  for (const filePath of layouts) {
    const reason = violatesUnification(filePath);
    if (reason) {
      violations.push({
        file: toPosix(path.relative(ROOT, filePath)),
        reason,
      });
    }
  }

  if (violations.length === 0) {
    console.log(`✓ ${layouts.length} mobile module layouts consistent with unified navigation.`);
    return;
  }

  console.error('✗ Module layout consistency check failed:');
  for (const v of violations) {
    console.error(`  - ${v.file}`);
    console.error(`    ${v.reason}`);
    console.error(
      '    Use ModuleLayoutWrapper (registered modules) or import ModuleTabBarBackground + getTabBarStyle (shell meta-routes).',
    );
  }
  process.exit(1);
}

main();
