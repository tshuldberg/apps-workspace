import { performance } from 'node:perf_hooks';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

type MaybePromise<T> = T | Promise<T>;
type ExpectedComplexity = 'constant' | 'linear' | 'nlogn' | 'quadratic';
type SeededRng = () => number;

interface ComplexitySlopeOptions<TInput> {
  label: string;
  sizes: number[];
  setup: (size: number) => TInput;
  run: (input: TInput) => MaybePromise<unknown>;
  warmupRuns?: number;
  sampleRuns?: number;
  attempts?: number;
  maxRatios?: number[];
  expected?: ExpectedComplexity;
}

interface MemoryBudgetOptions<TInput> {
  label: string;
  setup: () => TInput;
  run: (input: TInput) => MaybePromise<unknown>;
  repeats?: number;
  maxHeapDeltaBytes: number;
}

interface DeterministicFuzzOptions<TCase> {
  label: string;
  iterations: number;
  seed?: number;
  makeCase: (rng: SeededRng, index: number) => TCase;
  assertCase: (input: TCase, index: number) => MaybePromise<void>;
}

const DEFAULT_RATIO_BY_EXPECTED: Record<ExpectedComplexity, number[]> = {
  constant: [1.8, 1.8],
  linear: [2.8, 2.8],
  nlogn: [3.6, 3.6],
  quadratic: [6.0, 6.0],
};

// Raised from 0.1: sub-millisecond wall-clock slope on shared CI runners is
// scheduler/GC noise, not algorithmic growth. A genuinely superlinear function
// still exceeds this floor at the largest tested size and is caught.
const TIMING_NOISE_FLOOR_MS = 1;

function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

async function runTimed<TInput>(
  run: (input: TInput) => MaybePromise<unknown>,
  input: TInput,
): Promise<number> {
  const start = performance.now();
  await run(input);
  return performance.now() - start;
}

function assertSizesAscending(sizes: number[]): void {
  if (sizes.length < 3) {
    throw new Error('Complexity slope test requires at least 3 sizes.');
  }

  for (let index = 1; index < sizes.length; index += 1) {
    if (sizes[index]! <= sizes[index - 1]!) {
      throw new Error(
        `Sizes must be strictly increasing. Invalid pair: ${sizes[index - 1]} -> ${sizes[index]}`,
      );
    }
  }
}

/**
 * Perf gates measure wall-clock and heap slope, which is meaningless when the
 * code under test is coverage-instrumented or the runner is heavily shared.
 * Coverage CI jobs set MYLIFE_PERF_GATES=off; the uninstrumented test job
 * still enforces every budget.
 */
function perfGatesDisabled(): boolean {
  // YAML parsers may coerce a bare off to boolean false, so accept the
  // common disabled spellings a workflow env can produce.
  const value = (process.env.MYLIFE_PERF_GATES ?? '').trim().toLowerCase();
  return value === 'off' || value === 'false' || value === '0' || value === 'no';
}
export async function assertComplexitySlope<TInput>(
  options: ComplexitySlopeOptions<TInput>,
): Promise<void> {
  if (perfGatesDisabled()) {
    // Still execute one functional pass so the measured code keeps its
    // coverage and a smoke execution; only the timing assertion is skipped.
    await options.run(options.setup(options.sizes[0]!));
    return;
  }
  const {
    label,
    sizes,
    setup,
    run,
    warmupRuns = 1,
    sampleRuns = 5,
    attempts = 3,
    maxRatios,
    expected = 'linear',
  } = options;

  assertSizesAscending(sizes);

  const ratioBudget = maxRatios ?? DEFAULT_RATIO_BY_EXPECTED[expected];
  if (ratioBudget.length < sizes.length - 1) {
    throw new Error(
      `maxRatios must provide at least ${sizes.length - 1} thresholds for ${sizes.length} sizes.`,
    );
  }

  const measureMedians = async (): Promise<number[]> => {
    const medians: number[] = [];
    for (const size of sizes) {
      for (let runIndex = 0; runIndex < warmupRuns; runIndex += 1) {
        await run(setup(size));
      }

      const samples: number[] = [];
      for (let runIndex = 0; runIndex < sampleRuns; runIndex += 1) {
        samples.push(await runTimed(run, setup(size)));
      }
      medians.push(median(samples));
    }
    return medians;
  };

  // Retry-only-on-failure with a per-size minimum. The first sweep is the common
  // path and costs exactly one measurement, so tests that pass cleanly see no
  // added cost or timeout pressure. Only a sweep that exceeds budget triggers
  // more attempts, each refining the per-size MINIMUM median: timing noise (GC,
  // scheduler preemption, CPU contention from parallel workers) only ever ADDS
  // wall-clock time, so the fastest sample per size is the cleanest estimate of
  // its intrinsic cost, and denoising each size independently rescues a false
  // positive from a transient spike. A genuinely superlinear function exceeds
  // budget on every attempt and still fails.
  const totalAttempts = Math.max(1, attempts);
  const points = sizes.map(() => Number.POSITIVE_INFINITY);
  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const medians = await measureMedians();
    for (let index = 0; index < points.length; index += 1) {
      points[index] = Math.min(points[index]!, medians[index]!);
    }

    let offending = -1;
    let offendingRatio = 0;
    let offendingBudget = 0;
    for (let index = 1; index < points.length; index += 1) {
      const previous = Math.max(points[index - 1]!, TIMING_NOISE_FLOOR_MS);
      const next = Math.max(points[index]!, TIMING_NOISE_FLOOR_MS);
      const ratio = previous === 0 ? Number.POSITIVE_INFINITY : next / previous;
      const budget = ratioBudget[index - 1]!;
      if (ratio > budget) {
        offending = index;
        offendingRatio = ratio;
        offendingBudget = budget;
        break;
      }
    }

    if (offending === -1) {
      return;
    }

    if (attempt === totalAttempts - 1) {
      throw new Error(
        `${label}: complexity slope exceeded at ${sizes[offending - 1]} -> ${sizes[offending]} (best of ${totalAttempts}). ratio=${offendingRatio.toFixed(2)}, budget=${offendingBudget.toFixed(2)}, medians(ms)=${points.map((value) => value.toFixed(3)).join(', ')}`,
      );
    }
  }
}

/**
 * A real GC handle. Without one the heap delta measures GC-timing luck, not the
 * function under test: whether V8 happened to collect during the run decided
 * pass/fail (observed as a recurring "flake" on the roles gate). When vitest does
 * not run with --expose-gc, the flag is enabled at runtime and the handle pulled
 * from a scratch context. Falls back to null only if V8 refuses.
 */
function acquireGc(): (() => void) | null {
  if (typeof globalThis.gc === 'function') return globalThis.gc;
  try {
    setFlagsFromString('--expose-gc');
    const handle = runInNewContext('gc') as (() => void) | undefined;
    setFlagsFromString('--no-expose-gc');
    return typeof handle === 'function' ? handle : null;
  } catch {
    return null;
  }
}

export async function assertMemoryBudget<TInput>(
  options: MemoryBudgetOptions<TInput>,
): Promise<void> {
  if (perfGatesDisabled()) {
    await options.run(options.setup());
    return;
  }
  const { label, setup, run, repeats = 20, maxHeapDeltaBytes } = options;
  const gc = acquireGc();

  // Without a GC handle a single measurement is nondeterministic. A real leak
  // grows the heap on EVERY attempt, so the minimum delta over a few attempts
  // still catches it while a lucky collection clears the timing noise.
  const attempts = gc ? 1 : 5;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    gc?.();
    const heapBefore = process.memoryUsage().heapUsed;

    for (let index = 0; index < repeats; index += 1) {
      await run(setup());
    }

    gc?.();
    const delta = process.memoryUsage().heapUsed - heapBefore;
    bestDelta = Math.min(bestDelta, delta);
    if (bestDelta <= maxHeapDeltaBytes) return;
  }

  throw new Error(
    `${label}: memory budget exceeded. delta=${bestDelta} bytes, budget=${maxHeapDeltaBytes} bytes.`,
  );
}

export function createSeededRng(seed = 42): SeededRng {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: SeededRng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export async function runDeterministicFuzz<TCase>(
  options: DeterministicFuzzOptions<TCase>,
): Promise<void> {
  const { label, iterations, seed = 42, makeCase, assertCase } = options;
  const rng = createSeededRng(seed);

  for (let index = 0; index < iterations; index += 1) {
    try {
      await assertCase(makeCase(rng, index), index);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${label}: fuzz failure at iteration=${index}, seed=${seed}. ${reason}`,
      );
    }
  }
}
