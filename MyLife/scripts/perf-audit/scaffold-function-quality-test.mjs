#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function parseArgs(argv) {
  const args = {
    file: '',
    fnName: '',
    output: '',
    expected: 'linear',
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--file') {
      args.file = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (token === '--function') {
      args.fnName = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (token === '--output') {
      args.output = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (token === '--expected') {
      args.expected = argv[i + 1] ?? 'linear';
      i += 1;
      continue;
    }
    if (token === '--force') {
      args.force = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Scaffold a function-quality Vitest file.

Usage:
  pnpm scaffold:function-test --file <source-file> --function <name> [options]

Options:
  --output <path>      Explicit output path for the generated test file
  --expected <class>   Expected slope: constant | linear | nlogn | quadratic (default: linear)
  --force              Overwrite output file if it already exists
  --help               Show this message

Examples:
  pnpm scaffold:function-test --file modules/books/src/stats/stats.ts --function calculateReadingStats
  pnpm scaffold:function-test --file MyBudget/packages/shared/src/engine/net-cash.ts --function calculateRunningBalance --expected nlogn
`);
}

function getDefaultOutputPath(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(dir, '__tests__', `${base}.function-gate.test.ts`);
}

function normalizeImport(fromFile, toFile, withExtension = false) {
  let relative = toPosix(path.relative(path.dirname(fromFile), toFile));
  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }
  if (!withExtension) {
    relative = relative.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
  }
  return relative;
}

function scaffoldContent({
  functionName,
  sourceImportPath,
  helperImportPath,
  expectedComplexity,
}) {
  return `import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '${helperImportPath}';
import { ${functionName} } from '${sourceImportPath}';

describe('${functionName} function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    // TODO: Replace examples with real contract expectations for ${functionName}.
    expect(${functionName}([] as unknown as never)).toBeDefined();
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: '${functionName} fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 500);
        return Array.from({ length: size }, () => randomInt(rng, -1000, 1000));
      },
      assertCase: async (input) => {
        const result = ${functionName}(input as unknown as never);
        // TODO: Replace invariant with one that must always hold for ${functionName}.
        expect(result).toBeDefined();
      },
    });
  });

  it('stays within ${expectedComplexity} complexity slope budget', async () => {
    await assertComplexitySlope({
      label: '${functionName}',
      sizes: [250, 500, 1000],
      expected: '${expectedComplexity}',
      setup: (size) => Array.from({ length: size }, (_, index) => index),
      run: async (input) => {
        ${functionName}(input as unknown as never);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: '${functionName}',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => Array.from({ length: 1000 }, (_, index) => index),
      run: async (input) => {
        ${functionName}(input as unknown as never);
      },
    });
  });
});
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file || !args.fnName) {
    printHelp();
    process.exit(1);
  }

  const sourcePath = path.resolve(ROOT, args.file);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file does not exist: ${args.file}`);
  }

  const outputPath = path.resolve(ROOT, args.output || getDefaultOutputPath(args.file));
  if (fs.existsSync(outputPath) && !args.force) {
    throw new Error(`Output already exists: ${toPosix(path.relative(ROOT, outputPath))}. Use --force to overwrite.`);
  }

  const helperPath = path.join(ROOT, 'test', 'vitest', 'function-quality.ts');
  if (!fs.existsSync(helperPath)) {
    throw new Error('Missing shared helper: test/vitest/function-quality.ts');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const content = scaffoldContent({
    functionName: args.fnName,
    sourceImportPath: normalizeImport(outputPath, sourcePath),
    helperImportPath: normalizeImport(outputPath, helperPath),
    expectedComplexity: args.expected,
  });

  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`Created ${toPosix(path.relative(ROOT, outputPath))}`);
}

main();
