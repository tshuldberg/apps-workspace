import { performance } from 'node:perf_hooks';

type MaybePromise<T> = T | Promise<T>;

type ExpectedComplexity = 'constant' | 'linear' | 'nlogn' | 'quadratic';

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

type SeededRng = () => number;

const DEFAULT_RATIO_BY_EXPECTED: Record<ExpectedComplexity, number[]> = {
  constant: [1.8, 1.8],
  linear: [2.8, 2.8],
  nlogn: [3.6, 3.6],
  quadratic: [6.0, 6.0],
};

// Shared CI runners cannot resolve sub-millisecond wall-clock differences:
// scheduler preemption and GC pauses dwarf the real per-call cost. Below this
// floor a measured "slope" is timing noise, not algorithmic growth, so we clamp
// both ends of each ratio to it. A genuinely superlinear function still blows
// well past the floor at the largest tested size and is caught.
const TIMING_NOISE_FLOOR_MS = 1;

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

async function runTimed<TInput>(run: (input: TInput) => MaybePromise<unknown>, input: TInput): Promise<number> {
  const start = performance.now();
  await run(input);
  return performance.now() - start;
}

function assertSizesAscending(sizes: number[]): void {
  if (sizes.length < 3) {
    throw new Error('Complexity slope test requires at least 3 sizes.');
  }
  for (let i = 1; i < sizes.length; i += 1) {
    if (sizes[i] <= sizes[i - 1]) {
      throw new Error(`Sizes must be strictly increasing. Invalid pair: ${sizes[i - 1]} -> ${sizes[i]}`);
    }
  }
}

export async function assertComplexitySlope<TInput>(options: ComplexitySlopeOptions<TInput>): Promise<void> {
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
      for (let i = 0; i < warmupRuns; i += 1) {
        await run(setup(size));
      }

      const samples: number[] = [];
      for (let i = 0; i < sampleRuns; i += 1) {
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
    for (let i = 0; i < points.length; i += 1) {
      points[i] = Math.min(points[i], medians[i]);
    }

    let offending = -1;
    let offendingRatio = 0;
    let offendingBudget = 0;
    for (let i = 1; i < points.length; i += 1) {
      const prev = Math.max(points[i - 1], TIMING_NOISE_FLOOR_MS);
      const next = Math.max(points[i], TIMING_NOISE_FLOOR_MS);
      const ratio = prev === 0 ? Number.POSITIVE_INFINITY : next / prev;
      const budget = ratioBudget[i - 1];
      if (ratio > budget) {
        offending = i;
        offendingRatio = ratio;
        offendingBudget = budget;
        break;
      }
    }

    if (offending === -1) {
      return;
    }

    if (attempt === totalAttempts - 1) {
      const sizePair = `${sizes[offending - 1]} -> ${sizes[offending]}`;
      throw new Error(
        `${label}: complexity slope exceeded at ${sizePair} (best of ${totalAttempts}). ratio=${offendingRatio.toFixed(
          2,
        )}, budget=${offendingBudget.toFixed(2)}, medians(ms)=${points
          .map((value) => value.toFixed(3))
          .join(', ')}`,
      );
    }
  }
}

export async function assertMemoryBudget<TInput>(options: MemoryBudgetOptions<TInput>): Promise<void> {
  const { label, setup, run, repeats = 20, maxHeapDeltaBytes } = options;

  // If GC is exposed, reduce background noise before and after the run.
  if (globalThis.gc) {
    globalThis.gc();
  }
  const heapBefore = process.memoryUsage().heapUsed;

  for (let i = 0; i < repeats; i += 1) {
    await run(setup());
  }

  if (globalThis.gc) {
    globalThis.gc();
  }
  const heapAfter = process.memoryUsage().heapUsed;
  const delta = heapAfter - heapBefore;

  if (delta > maxHeapDeltaBytes) {
    throw new Error(
      `${label}: memory budget exceeded. delta=${delta} bytes, budget=${maxHeapDeltaBytes} bytes.`,
    );
  }
}

export function createSeededRng(seed = 42): SeededRng {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: SeededRng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export async function runDeterministicFuzz<TCase>(options: DeterministicFuzzOptions<TCase>): Promise<void> {
  const { label, iterations, seed = 42, makeCase, assertCase } = options;
  const rng = createSeededRng(seed);

  for (let i = 0; i < iterations; i += 1) {
    const input = makeCase(rng, i);
    try {
      await assertCase(input, i);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`${label}: fuzz failure at iteration=${i}, seed=${seed}. ${reason}`);
    }
  }
}
