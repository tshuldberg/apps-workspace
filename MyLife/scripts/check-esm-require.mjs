#!/usr/bin/env node
// check-esm-require.mjs
//
// Bans CommonJS require() in the PRODUCTION source of ESM ("type": "module")
// packages under packages/, apps/, and modules/. Those packages run under the
// real Node ESM / tsx runtime when deployed, where `require` is not defined and
// a lazy `require('node:crypto')` throws ReferenceError at first call.
//
// Why this exists: on 2026-08-24 the Meerkat account service shipped a
// `require('node:crypto')` inside account-store.ts. The full Vitest suite passed
// because Vitest's transform injects a CJS `require` shim, so the bug was
// invisible to tests and would have 500'd the account service on first deploy.
// The eslint no-require-imports rule was never enabled in the shared config, so
// the inline `// eslint-disable-next-line @typescript-eslint/no-var-requires`
// comments referenced a rule that did not run. This check closes that gap and,
// unlike a lint rule, cannot be silenced with an inline disable comment.
//
// Scope: production source only (src/, bin/, app/, lib/). Test files run under
// Vitest (shimmed) and are not deployed, so *.test.* and __tests__/ are exempt.
// `createRequire(...)` (the sanctioned ESM escape hatch) and dynamic `import(...)`
// are allowed.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['packages', 'apps', 'modules', 'deploy/self-host'];
const SOURCE_DIRS = ['src', 'bin', 'app', 'lib'];
const SOURCE_EXT = /\.(ts|tsx|mts|mjs)$/;
// A require() CALL not preceded by an identifier char or a dot (so `createRequire`
// and `foo.require` do not match), and not the ESM createRequire helper.
const REQUIRE_CALL = /(^|[^.\w])require\s*\(/;

function isEsmPackage(pkgDir) {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    return pkg.type === 'module';
  } catch {
    return false;
  }
}

function* walkSource(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name === '.next') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === '__tests__') continue;
      yield* walkSource(full);
    } else if (SOURCE_EXT.test(name) && !/\.test\.|\.spec\./.test(name)) {
      yield full;
    }
  }
}

function findPackages() {
  const pkgs = [];
  for (const root of ROOTS) {
    const rootDir = join(REPO_ROOT, root);
    let entries;
    try {
      entries = readdirSync(rootDir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const pkgDir = join(rootDir, name);
      try {
        if (!statSync(pkgDir).isDirectory()) continue;
      } catch {
        continue;
      }
      if (isEsmPackage(pkgDir)) pkgs.push(pkgDir);
    }
  }
  return pkgs;
}

const offenders = [];
for (const pkgDir of findPackages()) {
  for (const sub of SOURCE_DIRS) {
    for (const file of walkSource(join(pkgDir, sub))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        if (/createRequire/.test(line)) return;
        if (REQUIRE_CALL.test(line)) {
          offenders.push(`${file.slice(REPO_ROOT.length + 1)}:${i + 1}: ${trimmed.slice(0, 100)}`);
        }
      });
    }
  }
}

if (offenders.length > 0) {
  console.error('check:esm-require FAILED: require() in ESM ("type":"module") production source.');
  console.error('These packages run under the real Node ESM / tsx runtime where require is undefined');
  console.error('and throws at call time (Vitest shims it, so tests do NOT catch this). Use a top-level');
  console.error('import, or createRequire(import.meta.url) when a CJS-only module is unavoidable.\n');
  for (const o of offenders) console.error(`  ${o}`);
  process.exit(1);
}

console.log('OK   No require() in ESM production source (packages/apps/modules).');
