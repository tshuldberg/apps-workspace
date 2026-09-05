#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = process.cwd();
const STANDALONE_PATTERN = /^My[A-Z]/;
const SKIP_SEGMENTS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.claude']);

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function printHelp() {
  console.log(`Run immediate quality gates for new or updated functions.

Usage:
  pnpm gate:function --file <source-file> [options]
  pnpm gate:function --dir <package-dir> [options]
  pnpm gate:function --package <workspace-package-name> [options]
  pnpm gate:function --standalone <MyAppName> [options]
  pnpm gate:function --all-standalone [options]

Options:
  --tests <pathA,pathB>  Explicit test paths (comma-separated, repeatable)
  --skip-test            Skip running tests
  --skip-lint            Skip lint
  --skip-typecheck       Skip typecheck
  --help                 Show this message

Runner:
  Auto-detects pnpm when node is available, otherwise falls back to bun.

Examples:
  pnpm gate:function --file modules/books/src/stats/stats.ts --tests modules/books/src/stats/__tests__/stats.test.ts
  pnpm gate:function --dir MyBudget/packages/shared --tests MyBudget/packages/shared/src/engine/__tests__/net-cash.test.ts
  pnpm gate:function --standalone MyBooks
  pnpm gate:function --all-standalone --skip-test
`);
}

function parseArgs(argv) {
  const args = {
    file: '',
    dir: '',
    packageName: '',
    standalone: '',
    allStandalone: false,
    tests: [],
    skipTest: false,
    skipLint: false,
    skipTypecheck: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--file') {
      args.file = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (token === '--dir') {
      args.dir = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (token === '--package') {
      args.packageName = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (token === '--standalone') {
      args.standalone = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (token === '--all-standalone') {
      args.allStandalone = true;
      continue;
    }
    if (token === '--tests') {
      const raw = argv[i + 1] ?? '';
      i += 1;
      if (raw) {
        args.tests.push(
          ...raw
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
        );
      }
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

  args.tests = [...new Set(args.tests.map((entry) => toPosix(entry)))];
  return args;
}

function commandToString(parts) {
  return parts.map((part) => (/\s/.test(part) ? `"${part}"` : part)).join(' ');
}

function runCommand(parts, cwd = ROOT) {
  console.log(`\n$ ${commandToString(parts)}`);
  const [command, ...args] = parts;
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function commandExists(command) {
  try {
    const check = process.platform === 'win32' ? `where ${command}` : `command -v ${command}`;
    execSync(check, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function detectRunner() {
  if (commandExists('pnpm') && commandExists('node')) {
    return 'pnpm';
  }
  if (commandExists('bun')) {
    return 'bun';
  }
  throw new Error('No supported runner found. Require either (node + pnpm) or bun.');
}

function hasPackageJson(dirPath) {
  return fs.existsSync(path.join(dirPath, 'package.json'));
}

function readPackageJson(dirPath) {
  const pkgPath = path.join(dirPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`No package.json found in ${toPosix(path.relative(ROOT, dirPath))}`);
  }
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function findNearestPackageDir(filePath) {
  let cursor = path.dirname(filePath);
  while (cursor !== path.dirname(cursor)) {
    if (hasPackageJson(cursor)) {
      return cursor;
    }
    cursor = path.dirname(cursor);
  }
  return null;
}

function isSkippablePath(absPath) {
  const rel = toPosix(path.relative(ROOT, absPath));
  const segments = rel.split('/');
  return segments.some((segment) => SKIP_SEGMENTS.has(segment));
}

function walkPackageJsonFiles(startDir, output) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(startDir, entry.name);
    if (isSkippablePath(abs)) {
      continue;
    }
    if (entry.isDirectory()) {
      walkPackageJsonFiles(abs, output);
      continue;
    }
    if (entry.isFile() && entry.name === 'package.json') {
      output.push(abs);
    }
  }
}

function collectAllPackageJsonPaths() {
  const roots = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => ['apps', 'modules', 'packages'].includes(name) || STANDALONE_PATTERN.test(name));

  const output = [];
  for (const rootDir of roots) {
    walkPackageJsonFiles(path.join(ROOT, rootDir), output);
  }
  return output;
}

function resolvePackageDirFromName(packageName) {
  const packageJsonPaths = collectAllPackageJsonPaths();
  const matches = [];
  for (const pkgPath of packageJsonPaths) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.name === packageName) {
      matches.push(path.dirname(pkgPath));
    }
  }
  if (!matches.length) {
    throw new Error(`Package not found: ${packageName}`);
  }
  if (matches.length > 1) {
    throw new Error(`Package name is not unique: ${packageName}`);
  }
  return matches[0];
}

function resolveDefaultTests(packageDir, sourceFile) {
  const ext = path.extname(sourceFile);
  const base = path.basename(sourceFile, ext);
  const parent = path.dirname(sourceFile);
  const candidates = [
    path.join(parent, '__tests__', `${base}.test.ts`),
    path.join(parent, '__tests__', `${base}.spec.ts`),
    path.join(parent, '__tests__', `${base}.function-gate.test.ts`),
    path.join(parent, `${base}.test.ts`),
    path.join(parent, `${base}.spec.ts`),
  ];

  const absCandidates = candidates.map((candidate) => path.resolve(ROOT, candidate));
  return absCandidates
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => toPosix(path.relative(packageDir, candidate)));
}

function runPackageScript(runner, packageDir, scriptName) {
  if (runner === 'pnpm') {
    runCommand(['pnpm', '--dir', toPosix(packageDir), 'run', scriptName]);
    return;
  }
  runCommand(['bun', 'run', scriptName], packageDir);
}

function runVitestPaths(runner, packageDir, tests) {
  // Invoke vitest directly (not via `pnpm run test --`). The `--` separator
  // confuses vitest's arg parser: vitest treats everything after `--` as
  // positional file patterns, so `--pool-options.X=Y` and targeted test paths
  // get reinterpreted as filename filters. When those filters don't match
  // anything, vitest silently falls back to running the WHOLE suite — the
  // opposite of what the gate intends. This caused the pre-commit hook to
  // run all ~50 mobile test files (and then hang) when a single file changed.
  // Restored from d274641f1 (2026-03-25). See docs/sessions/2026-04-19-modernization-audit.md.
  // --maxWorkers is accepted by both vitest 3 (most packages) and vitest 4
  // (apps/mobile); the old --pool-options.threads.maxThreads flag was
  // removed in vitest 4's pool rework and crashes its CLI with a CACError.
  const threadLimit = [process.env.FUNCTION_GATE_MAX_WORKERS === '1' ? '--maxWorkers=1' : '--maxWorkers=2'];
  if (runner === 'pnpm') {
    runCommand(['pnpm', '--dir', toPosix(packageDir), 'exec', 'vitest', 'run', ...threadLimit, ...tests]);
    return;
  }
  runCommand(['bun', 'x', 'vitest', 'run', ...threadLimit, ...tests], packageDir);
}

function runGateInPackage(packageDir, options) {
  const pkg = readPackageJson(packageDir);
  const scripts = pkg.scripts ?? {};
  const packageLabel = `${pkg.name ?? '(unnamed)'} @ ${toPosix(path.relative(ROOT, packageDir))}`;
  console.log(`\n=== Function Quality Gate: ${packageLabel} ===`);
  const runner = detectRunner();
  console.log(`Runner: ${runner}`);

  if (!options.skipLint) {
    if (scripts.lint) {
      runPackageScript(runner, packageDir, 'lint');
    } else {
      console.log('Skipping lint (no lint script).');
    }
  }

  if (!options.skipTypecheck) {
    if (scripts.typecheck) {
      runPackageScript(runner, packageDir, 'typecheck');
    } else {
      console.log('Skipping typecheck (no typecheck script).');
    }
  }

  if (!options.skipTest) {
    const hasVitest = typeof scripts.test === 'string' && scripts.test.includes('vitest');
    if (options.tests.length > 0 && hasVitest) {
      runVitestPaths(runner, packageDir, options.tests);
    } else if (options.tests.length > 0 && !hasVitest) {
      console.log('Test paths were provided, but package does not use Vitest test script. Running package test script instead.');
      if (scripts.test) {
        runPackageScript(runner, packageDir, 'test');
      } else if (scripts['test:unit']) {
        runPackageScript(runner, packageDir, 'test:unit');
      } else {
        console.log('Skipping tests (no test script).');
      }
    } else {
      if (hasVitest) {
        runVitestPaths(runner, packageDir, []);
      } else if (scripts.test) {
        runPackageScript(runner, packageDir, 'test');
      } else if (scripts['test:unit']) {
        runPackageScript(runner, packageDir, 'test:unit');
      } else {
        console.log('Skipping tests (no test script).');
      }
    }
  }
}

function standaloneDirs() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && STANDALONE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function runStandaloneRoot(appName, options) {
  const dirPath = path.join(ROOT, appName);
  if (!hasPackageJson(dirPath)) {
    console.log(`Skipping ${appName} (no root package.json).`);
    return;
  }
  runGateInPackage(dirPath, options);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.allStandalone) {
    for (const appName of standaloneDirs()) {
      runStandaloneRoot(appName, {
        tests: [],
        skipLint: args.skipLint,
        skipTypecheck: args.skipTypecheck,
        skipTest: args.skipTest,
      });
    }
    return;
  }

  if (args.standalone) {
    runStandaloneRoot(args.standalone, {
      tests: [],
      skipLint: args.skipLint,
      skipTypecheck: args.skipTypecheck,
      skipTest: args.skipTest,
    });
    return;
  }

  let packageDir = '';
  let inferredTests = args.tests;

  if (args.dir) {
    packageDir = path.resolve(ROOT, args.dir);
  } else if (args.packageName) {
    packageDir = resolvePackageDirFromName(args.packageName);
  } else if (args.file) {
    const absoluteFile = path.resolve(ROOT, args.file);
    if (!fs.existsSync(absoluteFile)) {
      throw new Error(`Source file does not exist: ${args.file}`);
    }
    const nearest = findNearestPackageDir(absoluteFile);
    if (!nearest) {
      throw new Error(`Could not resolve package.json for file: ${args.file}`);
    }
    packageDir = nearest;
    if (inferredTests.length === 0) {
      inferredTests = resolveDefaultTests(packageDir, args.file);
    }
  } else {
    printHelp();
    process.exit(1);
  }

  if (!hasPackageJson(packageDir)) {
    throw new Error(`No package.json in target directory: ${toPosix(path.relative(ROOT, packageDir))}`);
  }

  runGateInPackage(packageDir, {
    tests: inferredTests,
    skipLint: args.skipLint,
    skipTypecheck: args.skipTypecheck,
    skipTest: args.skipTest,
  });
}

main();
