import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

type RawDatabase = {
  pragma(sql: string): unknown;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
  close(): void;
};

const workspaceRequire = createRequire(new URL('../packages/db/package.json', import.meta.url));
const BetterSqlite3 = workspaceRequire('better-sqlite3') as new (
  filename: string,
) => RawDatabase;

type BenchmarkOperation = 'insert' | 'query' | 'update' | 'delete';

interface BenchmarkOptions {
  seedRows: number;
  iterations: number;
  outputPath?: string;
  keepDb: boolean;
}

interface BenchmarkStats {
  operation: BenchmarkOperation;
  iterations: number;
  totalMs: number;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
}

interface BenchmarkResult {
  timestamp: string;
  databasePath: string;
  databaseSizeBytes: number;
  seedRows: number;
  iterations: number;
  environment: {
    platform: string;
    release: string;
    arch: string;
    node: string;
  };
  operations: BenchmarkStats[];
}

const DEFAULT_OPTIONS: BenchmarkOptions = {
  seedRows: 5000,
  iterations: 1000,
  keepDb: false,
};

function round(value: number): number {
  return Number(value.toFixed(3));
}

function parseArgs(argv: string[]): BenchmarkOptions {
  const options: BenchmarkOptions = { ...DEFAULT_OPTIONS };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      continue;
    }

    if (arg === '--seed-rows') {
      options.seedRows = parseIntegerArg(argv[index + 1], '--seed-rows');
      index += 1;
      continue;
    }

    if (arg === '--iterations') {
      options.iterations = parseIntegerArg(argv[index + 1], '--iterations');
      index += 1;
      continue;
    }

    if (arg === '--output') {
      const outputPath = argv[index + 1];
      if (!outputPath) {
        throw new Error('Missing value for --output');
      }
      options.outputPath = path.resolve(outputPath);
      index += 1;
      continue;
    }

    if (arg === '--keep-db') {
      options.keepDb = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseIntegerArg(raw: string | undefined, flag: string): number {
  const parsed = Number(raw);
  if (!raw || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function printHelp(): void {
  console.log(`
Usage:
  node --experimental-strip-types scripts/benchmark-db.ts [options]

Options:
  --seed-rows <n>    Number of existing rows to seed before measuring (default: 5000)
  --iterations <n>   Number of operations to measure per benchmark (default: 1000)
  --output <path>    Write the full JSON result to a file
  --keep-db          Keep the temporary SQLite database instead of deleting it
  --help             Show this help text
`.trim());
}

function createTempDatabasePath(): { directory: string; databasePath: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mylife-db-benchmark-'));
  return {
    directory,
    databasePath: path.join(directory, 'benchmark.sqlite'),
  };
}

function openDatabase(databasePath: string): RawDatabase {
  const db = new BetterSqlite3(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.prepare(`
    CREATE TABLE IF NOT EXISTS perf_benchmark_items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      payload TEXT NOT NULL,
      counter INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  db.prepare(
    'CREATE INDEX IF NOT EXISTS perf_benchmark_items_category_idx ON perf_benchmark_items (category, updated_at DESC)',
  ).run();

  return db;
}

function buildPayload(index: number): string {
  const suffix = String(index).padStart(4, '0');
  return JSON.stringify({
    title: `Benchmark item ${suffix}`,
    tags: [`tag-${index % 10}`, `group-${index % 25}`],
    notes: `SQLite CRUD benchmark payload ${suffix}`.repeat(4),
  });
}

function seedRows(db: RawDatabase, rowCount: number): string[] {
  const insert = db.prepare(`
    INSERT INTO perf_benchmark_items (id, category, payload, counter, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const rowIds: string[] = [];
  const startedAt = new Date('2026-04-04T00:00:00.000Z');

  for (let index = 0; index < rowCount; index += 1) {
    const id = `seed-${index}`;
    const iso = new Date(startedAt.getTime() + index * 1000).toISOString();
    insert.run(id, `seed-${index % 50}`, buildPayload(index), index, iso, iso);
    rowIds.push(id);
  }

  return rowIds;
}

function summarizeDurations(
  operation: BenchmarkOperation,
  durations: number[],
): BenchmarkStats {
  const sorted = [...durations].sort((left, right) => left - right);
  const totalMs = durations.reduce((sum, value) => sum + value, 0);

  return {
    operation,
    iterations: durations.length,
    totalMs: round(totalMs),
    averageMs: round(totalMs / durations.length),
    p50Ms: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    minMs: round(sorted[0] ?? 0),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
  };
}

function percentile(sortedDurations: number[], ratio: number): number {
  if (sortedDurations.length === 0) {
    return 0;
  }

  const index = Math.min(
    sortedDurations.length - 1,
    Math.max(0, Math.ceil(sortedDurations.length * ratio) - 1),
  );
  return sortedDurations[index] ?? 0;
}

function measureOperation(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

function runInsertBenchmark(db: RawDatabase, iterations: number): BenchmarkStats {
  const insert = db.prepare(`
    INSERT INTO perf_benchmark_items (id, category, payload, counter, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const durations: number[] = [];
  const insertedIds: string[] = [];

  for (let index = 0; index < iterations; index += 1) {
    const id = `insert-${index}`;
    insertedIds.push(id);
    const now = new Date(1_700_000_000_000 + index).toISOString();
    durations.push(
      measureOperation(() => {
        insert.run(id, `insert-${index % 50}`, buildPayload(index + 10_000), index, now, now);
      }),
    );
  }

  const cleanupDelete = db.prepare('DELETE FROM perf_benchmark_items WHERE id = ?');
  for (const id of insertedIds) {
    cleanupDelete.run(id);
  }

  return summarizeDurations('insert', durations);
}

function runQueryBenchmark(
  db: RawDatabase,
  seedIds: string[],
  iterations: number,
): BenchmarkStats {
  const query = db.prepare(`
    SELECT id, category, payload, counter, created_at, updated_at
    FROM perf_benchmark_items
    WHERE category = ?
    ORDER BY updated_at DESC
    LIMIT 20
  `);
  const durations: number[] = [];

  for (let index = 0; index < iterations; index += 1) {
    const seedId = seedIds[index % seedIds.length] ?? 'seed-0';
    const category = `seed-${Number(seedId.split('-')[1]) % 50}`;
    durations.push(
      measureOperation(() => {
        query.all(category);
      }),
    );
  }

  return summarizeDurations('query', durations);
}

function runUpdateBenchmark(
  db: RawDatabase,
  seedIds: string[],
  iterations: number,
): BenchmarkStats {
  const update = db.prepare(`
    UPDATE perf_benchmark_items
    SET counter = ?, updated_at = ?, payload = ?
    WHERE id = ?
  `);
  const durations: number[] = [];

  for (let index = 0; index < iterations; index += 1) {
    const id = seedIds[index % seedIds.length] ?? 'seed-0';
    const now = new Date(1_700_100_000_000 + index).toISOString();
    durations.push(
      measureOperation(() => {
        update.run(index, now, buildPayload(index + 20_000), id);
      }),
    );
  }

  return summarizeDurations('update', durations);
}

function runDeleteBenchmark(db: RawDatabase, iterations: number): BenchmarkStats {
  const insert = db.prepare(`
    INSERT INTO perf_benchmark_items (id, category, payload, counter, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const idsToDelete: string[] = [];

  for (let index = 0; index < iterations; index += 1) {
    const id = `delete-${index}`;
    const now = new Date(1_700_200_000_000 + index).toISOString();
    insert.run(id, `delete-${index % 50}`, buildPayload(index + 30_000), index, now, now);
    idsToDelete.push(id);
  }

  const deleteStatement = db.prepare('DELETE FROM perf_benchmark_items WHERE id = ?');
  const durations: number[] = [];

  for (const id of idsToDelete) {
    durations.push(
      measureOperation(() => {
        deleteStatement.run(id);
      }),
    );
  }

  return summarizeDurations('delete', durations);
}

export function runBenchmarks(options: Partial<BenchmarkOptions> = {}): BenchmarkResult {
  const resolvedOptions: BenchmarkOptions = { ...DEFAULT_OPTIONS, ...options };
  const { directory, databasePath } = createTempDatabasePath();
  const db = openDatabase(databasePath);

  try {
    const seedIds = seedRows(db, resolvedOptions.seedRows);

    const operations = [
      runInsertBenchmark(db, resolvedOptions.iterations),
      runQueryBenchmark(db, seedIds, resolvedOptions.iterations),
      runUpdateBenchmark(db, seedIds, resolvedOptions.iterations),
      runDeleteBenchmark(db, resolvedOptions.iterations),
    ];

    return {
      timestamp: new Date().toISOString(),
      databasePath,
      databaseSizeBytes: fs.statSync(databasePath).size,
      seedRows: resolvedOptions.seedRows,
      iterations: resolvedOptions.iterations,
      environment: {
        platform: process.platform,
        release: os.release(),
        arch: process.arch,
        node: process.version,
      },
      operations,
    };
  } finally {
    db.close();

    if (!resolvedOptions.keepDb) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}

function writeOutputIfRequested(result: BenchmarkResult, outputPath?: string): void {
  if (!outputPath) {
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function printSummary(result: BenchmarkResult): void {
  console.log(`MyLife DB benchmark`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Environment: ${result.environment.platform} ${result.environment.release} (${result.environment.arch}), Node ${result.environment.node}`);
  console.log(`Seed rows: ${result.seedRows}`);
  console.log(`Iterations per operation: ${result.iterations}`);
  console.log(`Database size: ${result.databaseSizeBytes} bytes`);
  console.log('');
  console.table(
    result.operations.map((operation) => ({
      operation: operation.operation,
      avgMs: operation.averageMs,
      p50Ms: operation.p50Ms,
      p95Ms: operation.p95Ms,
      maxMs: operation.maxMs,
      totalMs: operation.totalMs,
    })),
  );
}

export function main(argv: string[] = process.argv.slice(2)): void {
  const options = parseArgs(argv);
  const result = runBenchmarks(options);
  writeOutputIfRequested(result, options.outputPath);
  printSummary(result);
}

const invokedPath = process.argv[1];
const isDirectExecution = invokedPath
  ? pathToFileURL(path.resolve(invokedPath)).href === import.meta.url
  : false;

if (isDirectExecution) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Benchmark failed with an unknown error.',
    );
    process.exit(1);
  }
}
