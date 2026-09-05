#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.swift', '.m', '.mm', '.h']);
const SKIP_SEGMENTS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage']);
const ROOT_SCOPE_TOP_LEVEL = new Set(['apps', 'modules', 'packages']);

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function printHelp() {
  console.log(`Run function quality gate for changed files only.

Usage:
  pnpm gate:function:changed [options]

Options:
  --base <git-ref>      Compare against ref (default: HEAD)
  --staged              Only staged changes
  --skip-test           Skip tests
  --skip-lint           Skip lint
  --skip-typecheck      Skip typecheck
  --help                Show this message

Examples:
  pnpm gate:function:changed
  pnpm gate:function:changed --base origin/main
  pnpm gate:function:changed --staged
`);
}

function parseArgs(argv) {
  const args = {
    base: 'HEAD',
    staged: false,
    skipTest: false,
    skipLint: false,
    skipTypecheck: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--base') {
      args.base = argv[i + 1] ?? 'HEAD';
      i += 1;
      continue;
    }
    if (token === '--staged') {
      args.staged = true;
      continue;
    }
    if (token === '--skip-test') {
      args.skipTest = true;
      continue;
    }
    if (token === '--skip-lint') {
      args.skipLint = true;
      continue;
    }
    if (token === '--skip-typecheck') {
      args.skipTypecheck = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function commandExists(command) {
  try {
    // Use 'where' on Windows, 'command -v' elsewhere
    const check = process.platform === 'win32' ? `where ${command}` : `command -v ${command}`;
    execSync(check, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function detectJsRunner() {
  if (commandExists('node')) {
    return 'node';
  }
  if (commandExists('bun')) {
    return 'bun';
  }
  throw new Error('No JavaScript runtime found. Install node or bun.');
}

function runCommand(command, args, cwd = ROOT) {
  const printable = [command, ...args]
    .map((part) => (/[\s]/.test(part) ? `"${part}"` : part))
    .join(' ');
  console.log(`\n$ ${printable}`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function changedFiles(args) {
  const diffArgs = args.staged
    ? ['diff', '--name-only', '--diff-filter=ACMRT', '--cached']
    : ['diff', '--name-only', '--diff-filter=ACMRT', args.base];

  const raw = execSync(['git', ...diffArgs].join(' '), {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(toPosix);
}

function isSkippable(relPath) {
  const segments = relPath.split('/');
  return segments.some((segment) => SKIP_SEGMENTS.has(segment));
}

function isSourceFile(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

function isPlaywrightE2eFile(relPath) {
  const segments = relPath.split('/');
  return segments.includes('e2e') && /\.(test|spec)\.[^.]+$/.test(path.basename(relPath));
}

function isTestFile(relPath) {
  if (isPlaywrightE2eFile(relPath)) {
    return false;
  }
  const base = path.basename(relPath);
  return /\.(test|spec)\.[^.]+$/.test(base) || relPath.includes('__tests__/');
}

function isInCodeScope(relPath) {
  const [top] = relPath.split('/');
  if (!top) {
    return false;
  }
  if (ROOT_SCOPE_TOP_LEVEL.has(top)) {
    return true;
  }
  if (/^My[A-Z]/.test(top)) {
    return true;
  }
  return false;
}

function hasPackageJson(dirPath) {
  return fs.existsSync(path.join(dirPath, 'package.json'));
}

function findNearestPackageDir(absPath) {
  let cursor = path.dirname(absPath);
  while (cursor !== path.dirname(cursor)) {
    if (hasPackageJson(cursor)) {
      return cursor;
    }
    cursor = path.dirname(cursor);
  }
  return null;
}

function resolveDefaultTests(packageDir, sourceRelPath) {
  const sourceAbs = path.resolve(ROOT, sourceRelPath);
  const ext = path.extname(sourceAbs);
  const base = path.basename(sourceAbs, ext);
  const parent = path.dirname(sourceAbs);

  const candidates = [
    path.join(parent, '__tests__', `${base}.test.ts`),
    path.join(parent, '__tests__', `${base}.test.tsx`),
    path.join(parent, '__tests__', `${base}.spec.ts`),
    path.join(parent, '__tests__', `${base}.spec.tsx`),
    path.join(parent, '__tests__', `${base}.function-gate.test.ts`),
    path.join(parent, `${base}.test.ts`),
    path.join(parent, `${base}.test.tsx`),
    path.join(parent, `${base}.spec.ts`),
    path.join(parent, `${base}.spec.tsx`),
  ];

  return candidates
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => toPosix(path.relative(packageDir, candidate)));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const runtime = detectJsRunner();
  const gateScript = path.join(ROOT, 'scripts', 'perf-audit', 'run-function-quality-gate.mjs');

  const files = changedFiles(args)
    .filter((file) => !isSkippable(file))
    .filter(isInCodeScope)
    .filter(isSourceFile)
    .filter((file) => fs.existsSync(path.join(ROOT, file)));

  if (files.length === 0) {
    console.log('No changed source files detected for function quality gate.');
    return;
  }

  const byPackage = new Map();
  for (const relPath of files) {
    const abs = path.join(ROOT, relPath);
    const packageDir = findNearestPackageDir(abs);
    if (!packageDir) {
      continue;
    }
    const packageKey = toPosix(path.relative(ROOT, packageDir));
    if (!byPackage.has(packageKey)) {
      byPackage.set(packageKey, {
        packageDir,
        files: [],
        tests: new Set(),
      });
    }
    const bucket = byPackage.get(packageKey);
    bucket.files.push(relPath);
    if (isTestFile(relPath)) {
      bucket.tests.add(toPosix(path.relative(packageDir, path.resolve(ROOT, relPath))));
    } else {
      for (const testPath of resolveDefaultTests(packageDir, relPath)) {
        bucket.tests.add(testPath);
      }
    }
  }

  if (byPackage.size === 0) {
    console.log('No package targets were resolved for changed source files.');
    return;
  }

  const sharedFlags = [];
  if (args.skipLint) {
    sharedFlags.push('--skip-lint');
  }
  if (args.skipTypecheck) {
    sharedFlags.push('--skip-typecheck');
  }
  if (args.skipTest) {
    sharedFlags.push('--skip-test');
  }

  let sharedPackageChanged = false;
  for (const [packageKey, bucket] of [...byPackage.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`\nChanged files in ${packageKey}:`);
    for (const file of bucket.files.sort((a, b) => a.localeCompare(b))) {
      console.log(`- ${file}`);
    }

    const invocation = [gateScript, '--dir', bucket.packageDir, ...sharedFlags];
    const tests = [...bucket.tests];
    if (!args.skipTest && tests.length > 0) {
      invocation.push('--tests', tests.join(','));
    }

    runCommand(runtime, invocation, ROOT);

    if (packageKey.startsWith('packages/')) {
      sharedPackageChanged = true;
    }
  }

  // Shared-package fan-out: if a file in `packages/*` changed, also typecheck
  // the app consumers (mobile + web) so breaking type/schema changes can't
  // slip through the per-package gate. Skipped when --skip-typecheck is set.
  if (sharedPackageChanged && !args.skipTypecheck) {
    console.log('\n▶ Shared package change detected — running consumer typechecks');
    const consumerFilters = ['@mylife/mobile', '@mylife/web'];
    for (const filter of consumerFilters) {
      try {
        runCommand('pnpm', ['--filter', filter, 'typecheck'], ROOT);
      } catch (err) {
        console.error(
          `\nConsumer typecheck failed for ${filter}. A change in a shared package broke this app.`,
        );
        throw err;
      }
    }
  }
}

main();
