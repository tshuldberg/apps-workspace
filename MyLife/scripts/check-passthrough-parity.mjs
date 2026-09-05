#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const passthroughStandalones = ['MyBooks', 'MyBudget', 'MyHabits'];

let failures = 0;
let warnings = 0;

function ok(message) {
  console.log(`OK   ${message}`);
}

function warn(message) {
  console.warn(`WARN ${message}`);
  warnings += 1;
}

function fail(message) {
  console.error(`FAIL ${message}`);
  failures += 1;
}

function readText(path) {
  const full = resolve(root, path);
  if (!existsSync(full)) {
    fail(`${path} is missing`);
    return '';
  }
  return readFileSync(full, 'utf8');
}

function listTsxFiles(dirPath) {
  const fullDir = resolve(root, dirPath);
  if (!existsSync(fullDir)) return [];

  const out = [];
  function walk(current) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '__tests__', '.next', '.expo', '.turbo', 'dist'].includes(entry.name)) {
          continue;
        }
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.tsx')) continue;
      if (entry.name.endsWith('.test.tsx')) continue;
      if (['_layout.tsx', 'layout.tsx', '+not-found.tsx'].includes(entry.name)) continue;
      out.push(relative(resolve(root), full).replace(/\\/g, '/'));
    }
  }

  walk(fullDir);
  return out.sort();
}

if (!passthroughStandalones.some((dir) => existsSync(resolve(root, dir)))) {
  console.log('check-passthrough-parity: skipped (passthrough standalone apps not present in repo)');
  process.exit(0);
}

function checkWorkoutsWebAdapter() {
  // Workouts uses hub-native adapter mode (not passthrough).
  // Hub pages are powered by @mylife/workouts SQLite layer, not standalone re-exports.
  const hubDir = 'apps/web/app/workouts';
  const hubFiles = listTsxFiles(hubDir).filter((path) => !path.endsWith('/actions.tsx'));
  if (hubFiles.length === 0) {
    fail('workouts hub web adapter has no page files');
  } else {
    ok(`workouts web adapter mode: ${hubFiles.length} hub-native pages`);
  }
}

function checkHabitsWebPassthrough() {
  const wrappers = [
    {
      hub: 'apps/web/app/habits/page.tsx',
      expected: "export { default } from '@myhabits-web/app/habits/page';",
      standalone: 'MyHabits/apps/web/app/habits/page.tsx',
    },
  ];

  const expectedHubFiles = wrappers.map((item) => item.hub).sort();
  const actualHubFiles = listTsxFiles('apps/web/app/habits');

  if (actualHubFiles.join('|') !== expectedHubFiles.join('|')) {
    fail(
      `habits wrapper inventory mismatch:\nexpected=${expectedHubFiles.join(', ')}\nactual=${actualHubFiles.join(', ')}`,
    );
  } else {
    ok('habits web wrapper inventory matched expected passthrough routes');
  }

  for (const wrapper of wrappers) {
    const hubSource = readText(wrapper.hub).trim();
    if (hubSource !== wrapper.expected) {
      fail(`${wrapper.hub} must be thin passthrough wrapper`);
    } else {
      ok(`${wrapper.hub} is thin passthrough wrapper`);
    }

    if (!existsSync(resolve(root, wrapper.standalone))) {
      fail(`${wrapper.standalone} is missing`);
    } else {
      ok(`${wrapper.hub} target exists (${wrapper.standalone})`);
    }
  }
}

function checkBooksWebPassthrough() {
  const wrappers = [
    {
      hub: 'apps/web/app/books/page.tsx',
      expected: "export { default } from '@mybooks-web/app/books/page';",
      standalone: 'MyBooks/apps/web/app/books/page.tsx',
    },
    {
      hub: 'apps/web/app/books/search/page.tsx',
      expected: "export { default } from '@mybooks-web/app/books/search/page';",
      standalone: 'MyBooks/apps/web/app/books/search/page.tsx',
    },
    {
      hub: 'apps/web/app/books/import/page.tsx',
      expected: "export { default } from '@mybooks-web/app/books/import/page';",
      standalone: 'MyBooks/apps/web/app/books/import/page.tsx',
    },
    {
      hub: 'apps/web/app/books/stats/page.tsx',
      expected: "export { default } from '@mybooks-web/app/books/stats/page';",
      standalone: 'MyBooks/apps/web/app/books/stats/page.tsx',
    },
    {
      hub: 'apps/web/app/books/reader/page.tsx',
      expected: "export { default } from '@mybooks-web/app/books/reader/page';",
      standalone: 'MyBooks/apps/web/app/books/reader/page.tsx',
    },
    {
      hub: 'apps/web/app/books/reader/[id]/page.tsx',
      expected: "export { default } from '@mybooks-web/app/books/reader/[id]/page';",
      standalone: 'MyBooks/apps/web/app/books/reader/[id]/page.tsx',
    },
    {
      hub: 'apps/web/app/books/[id]/page.tsx',
      expected: "export { default } from '@mybooks-web/app/books/[id]/page';",
      standalone: 'MyBooks/apps/web/app/books/[id]/page.tsx',
    },
  ];

  const expectedHubFiles = wrappers.map((item) => item.hub).sort();
  const actualHubFiles = listTsxFiles('apps/web/app/books')
    .filter((path) => !path.includes('/__tests__/'))
    .sort();

  if (actualHubFiles.join('|') !== expectedHubFiles.join('|')) {
    fail(
      `books wrapper inventory mismatch:\nexpected=${expectedHubFiles.join(', ')}\nactual=${actualHubFiles.join(', ')}`,
    );
  } else {
    ok('books web wrapper inventory matched expected passthrough routes');
  }

  for (const wrapper of wrappers) {
    const hubSource = readText(wrapper.hub).trim();
    if (hubSource !== wrapper.expected) {
      fail(`${wrapper.hub} must be thin passthrough wrapper`);
    } else {
      ok(`${wrapper.hub} is thin passthrough wrapper`);
    }

    if (!existsSync(resolve(root, wrapper.standalone))) {
      fail(`${wrapper.standalone} is missing`);
    } else {
      ok(`${wrapper.hub} target exists (${wrapper.standalone})`);
    }
  }

  const layoutHub = 'apps/web/app/books/layout.tsx';
  const layoutStandalone = 'MyBooks/apps/web/app/books/layout.tsx';
  const layoutExpected = "export { default } from '@mybooks-web/app/books/layout';";
  const layoutSource = readText(layoutHub).trim();
  if (layoutSource !== layoutExpected) {
    fail(`${layoutHub} must be thin passthrough wrapper`);
  } else {
    ok(`${layoutHub} is thin passthrough wrapper`);
  }

  if (!existsSync(resolve(root, layoutStandalone))) {
    fail(`${layoutStandalone} is missing`);
  } else {
    ok(`${layoutHub} target exists (${layoutStandalone})`);
  }
}

function checkBudgetWebPassthrough() {
  const wrappers = [
    {
      hub: 'apps/web/app/budget/page.tsx',
      expected: "export { default } from '@mybudget-web/app/page';",
      standalone: 'MyBudget/apps/web/app/page.tsx',
    },
  ];

  const expectedHubFiles = wrappers.map((item) => item.hub).sort();
  const actualHubFiles = listTsxFiles('apps/web/app/budget').sort();

  if (actualHubFiles.join('|') !== expectedHubFiles.join('|')) {
    fail(
      `budget wrapper inventory mismatch:\nexpected=${expectedHubFiles.join(', ')}\nactual=${actualHubFiles.join(', ')}`,
    );
  } else {
    ok('budget web wrapper inventory matched expected passthrough routes');
  }

  for (const wrapper of wrappers) {
    const hubSource = readText(wrapper.hub).trim();
    if (hubSource !== wrapper.expected) {
      fail(`${wrapper.hub} must be thin passthrough wrapper`);
    } else {
      ok(`${wrapper.hub} is thin passthrough wrapper`);
    }

    if (!existsSync(resolve(root, wrapper.standalone))) {
      fail(`${wrapper.standalone} is missing`);
    } else {
      ok(`${wrapper.hub} target exists (${wrapper.standalone})`);
    }
  }
}

function checkWebHostWiring() {
  const tsconfig = JSON.parse(readText('apps/web/tsconfig.json'));
  const nextConfig = readText('apps/web/next.config.ts');

  const booksAlias = tsconfig.compilerOptions?.paths?.['@mybooks-web/*'];
  if (!Array.isArray(booksAlias) || !booksAlias.includes('../../MyBooks/apps/web/*')) {
    fail('apps/web/tsconfig.json missing @mybooks-web/* alias');
  } else {
    ok('apps/web/tsconfig.json includes @mybooks-web/* alias');
  }

  const booksSharedAlias = tsconfig.compilerOptions?.paths?.['@mybooks/shared'];
  if (!Array.isArray(booksSharedAlias) || !booksSharedAlias.includes('../../MyBooks/packages/shared/src/index.ts')) {
    fail('apps/web/tsconfig.json missing @mybooks/shared alias');
  } else {
    ok('apps/web/tsconfig.json includes @mybooks/shared alias');
  }

  const budgetAlias = tsconfig.compilerOptions?.paths?.['@mybudget-web/*'];
  if (!Array.isArray(budgetAlias) || !budgetAlias.includes('../../MyBudget/apps/web/*')) {
    fail('apps/web/tsconfig.json missing @mybudget-web/* alias');
  } else {
    ok('apps/web/tsconfig.json includes @mybudget-web/* alias');
  }

  const budgetSharedAlias = tsconfig.compilerOptions?.paths?.['@mybudget/shared'];
  if (
    !Array.isArray(budgetSharedAlias) ||
    !budgetSharedAlias.includes('../../MyBudget/packages/shared/src/index.ts')
  ) {
    fail('apps/web/tsconfig.json missing @mybudget/shared alias');
  } else {
    ok('apps/web/tsconfig.json includes @mybudget/shared alias');
  }

  const budgetUiAlias = tsconfig.compilerOptions?.paths?.['@mybudget/ui'];
  if (
    !Array.isArray(budgetUiAlias) ||
    !budgetUiAlias.includes('../../MyBudget/packages/ui/src/index.ts')
  ) {
    fail('apps/web/tsconfig.json missing @mybudget/ui alias');
  } else {
    ok('apps/web/tsconfig.json includes @mybudget/ui alias');
  }

  const habitsWebAlias = tsconfig.compilerOptions?.paths?.['@myhabits-web/*'];
  if (!Array.isArray(habitsWebAlias) || !habitsWebAlias.includes('../../MyHabits/apps/web/*')) {
    fail('apps/web/tsconfig.json missing @myhabits-web/* alias');
  } else {
    ok('apps/web/tsconfig.json includes @myhabits-web/* alias');
  }

  if (!nextConfig.includes('externalDir: true')) {
    fail('apps/web/next.config.ts missing experimental.externalDir=true');
  } else {
    ok('apps/web/next.config.ts enables externalDir');
  }

  if (!nextConfig.includes("'@mybooks/shared'")) {
    fail("apps/web/next.config.ts missing '@mybooks/shared' transpilation");
  } else {
    ok("apps/web/next.config.ts transpiles '@mybooks/shared'");
  }

  if (!nextConfig.includes("'@mybooks/ui'")) {
    fail("apps/web/next.config.ts missing '@mybooks/ui' transpilation");
  } else {
    ok("apps/web/next.config.ts transpiles '@mybooks/ui'");
  }

  if (!nextConfig.includes("'@mybudget/shared'")) {
    fail("apps/web/next.config.ts missing '@mybudget/shared' transpilation");
  } else {
    ok("apps/web/next.config.ts transpiles '@mybudget/shared'");
  }

  if (!nextConfig.includes("'@mybudget/ui'")) {
    fail("apps/web/next.config.ts missing '@mybudget/ui' transpilation");
  } else {
    ok("apps/web/next.config.ts transpiles '@mybudget/ui'");
  }

  for (const file of ['apps/web/postcss.config.js', 'apps/web/tailwind.config.ts']) {
    if (!existsSync(resolve(root, file))) {
      fail(`${file} is missing`);
    } else {
      ok(`${file} present`);
    }
  }
}

function reportPendingModulePassthrough() {
  const pendingWeb = [
    'fast',
    'recipes',
    'surf',
    'workouts',
    'car',
    'words',
    'homes',
  ];
  const pendingMobile = [
    'books',
    'budget',
    'fast',
    'habits',
    'recipes',
    'surf',
    'workouts',
    'car',
    'words',
    'homes',
  ];

  warn(`web passthrough pending modules: ${pendingWeb.join(', ')}`);
  warn(`mobile passthrough pending modules: ${pendingMobile.join(', ')}`);
}

console.log('Checking standalone passthrough parity...\n');

checkBooksWebPassthrough();
checkBudgetWebPassthrough();
checkWorkoutsWebAdapter();
checkHabitsWebPassthrough();
checkWebHostWiring();
reportPendingModulePassthrough();

if (failures > 0) {
  console.error(`\ncheck-passthrough-parity: ${failures} failure(s), ${warnings} warning(s)`);
  process.exit(1);
}

console.log(`\ncheck-passthrough-parity: passed with ${warnings} warning(s)`);
