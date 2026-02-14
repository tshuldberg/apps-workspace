/**
 * Monte Carlo Simulation
 * Sprints 43-44: Randomized trade-order simulation for robustness analysis
 *
 * Bootstraps trade P&Ls with replacement to generate confidence intervals
 * for key portfolio metrics: final equity, max drawdown, and Sharpe ratio.
 * Also calculates probability of ruin (hitting a drawdown threshold).
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface MonteCarloConfig {
  /** Number of simulation paths (default 1000) */
  numSimulations: number
  /** Confidence level for interval calculation (default 0.95) */
  confidenceLevel: number
  /** Starting capital for equity simulations */
  initialCapital: number
  /** Random seed for reproducibility (optional) */
  seed?: number
}

const DEFAULT_MC_CONFIG: MonteCarloConfig = {
  numSimulations: 1000,
  confidenceLevel: 0.95,
  initialCapital: 100_000,
}

export interface PercentileDistribution {
  p5: number
  p25: number
  p50: number
  p75: number
  p95: number
}

export interface SimulationPath {
  equityCurve: number[]
  finalEquity: number
  maxDrawdown: number
  sharpeRatio: number
}

export interface MonteCarloResult {
  /** All simulation paths (truncated to samplePaths for visualization) */
  paths: SimulationPath[]
  /** Sample of paths for fan chart visualization (100 max) */
  samplePaths: number[][]
  /** Percentile distributions for key metrics */
  finalEquity: PercentileDistribution
  maxDrawdown: PercentileDistribution
  sharpeRatio: PercentileDistribution
  /** Mean values across all simulations */
  meanFinalEquity: number
  meanMaxDrawdown: number
  meanSharpe: number
  /** Number of simulations run */
  numSimulations: number
}

export interface RuinResult {
  /** Probability of hitting the drawdown threshold (0-1) */
  probability: number
  /** Number of paths that hit the threshold */
  ruinCount: number
  /** Total simulations run */
  totalSimulations: number
  /** The threshold used */
  drawdownThreshold: number
}

// ── Seeded Random Number Generator ───────────────────────────────────────

/**
 * Simple xorshift128 PRNG for reproducible simulations.
 * Falls back to Math.random() if no seed is provided.
 */
class SeededRandom {
  private state: [number, number, number, number]
  private useMathRandom: boolean

  constructor(seed?: number) {
    if (seed === undefined) {
      this.useMathRandom = true
      this.state = [0, 0, 0, 0]
    } else {
      this.useMathRandom = false
      // Initialize state from seed using splitmix32
      this.state = [0, 0, 0, 0]
      let s = seed | 0
      for (let i = 0; i < 4; i++) {
        s = (s + 0x9e3779b9) | 0
        let t = s ^ (s >>> 16)
        t = Math.imul(t, 0x21f0aaad)
        t = t ^ (t >>> 15)
        t = Math.imul(t, 0x735a2d97)
        t = t ^ (t >>> 15)
        this.state[i] = t >>> 0
      }
    }
  }

  /** Returns a random float in [0, 1) */
  next(): number {
    if (this.useMathRandom) return Math.random()

    let t = this.state[3]!
    const s = this.state[0]!
    this.state[3] = this.state[2]!
    this.state[2] = this.state[1]!
    this.state[1] = s

    t ^= t << 11
    t ^= t >>> 8
    this.state[0] = t ^ s ^ (s >>> 19)

    return (this.state[0]! >>> 0) / 4294967296
  }

  /** Returns a random integer in [0, max) */
  nextInt(max: number): number {
    return Math.floor(this.next() * max)
  }
}

// ── Monte Carlo Simulator ────────────────────────────────────────────────

export class MonteCarloSimulator {
  private readonly config: MonteCarloConfig
  private rng: SeededRandom

  constructor(config?: Partial<MonteCarloConfig>) {
    this.config = { ...DEFAULT_MC_CONFIG, ...config }
    this.rng = new SeededRandom(this.config.seed)
  }

  /**
   * Run Monte Carlo simulation by bootstrapping trade P&Ls.
   * Randomly reorders trades to generate diverse equity paths and
   * compute confidence intervals for key metrics.
   *
   * @param tradePnls - Array of individual trade P&L values
   * @param numSimulations - Override for number of simulations
   * @param confidenceLevel - Override for confidence level
   */
  simulate(
    tradePnls: number[],
    numSimulations?: number,
    confidenceLevel?: number,
  ): MonteCarloResult {
    const n = numSimulations ?? this.config.numSimulations
    const _confidence = confidenceLevel ?? this.config.confidenceLevel

    if (tradePnls.length === 0) {
      return this.emptyResult(n)
    }

    const paths: SimulationPath[] = []

    for (let sim = 0; sim < n; sim++) {
      const path = this.runSinglePath(tradePnls)
      paths.push(path)
    }

    // Extract metric arrays for percentile calculation
    const finalEquities = paths.map((p) => p.finalEquity)
    const maxDrawdowns = paths.map((p) => p.maxDrawdown)
    const sharpes = paths.map((p) => p.sharpeRatio)

    // Sample paths for fan chart (max 100)
    const sampleIndices = this.sampleIndices(n, Math.min(n, 100))
    const samplePaths = sampleIndices.map((i) => paths[i]!.equityCurve)

    return {
      paths,
      samplePaths,
      finalEquity: this.percentiles(finalEquities),
      maxDrawdown: this.percentiles(maxDrawdowns),
      sharpeRatio: this.percentiles(sharpes),
      meanFinalEquity: this.mean(finalEquities),
      meanMaxDrawdown: this.mean(maxDrawdowns),
      meanSharpe: this.mean(sharpes),
      numSimulations: n,
    }
  }

  /**
   * Calculate the probability of ruin — the chance that equity drops below
   * a drawdown threshold at any point during the simulated trade sequence.
   *
   * @param tradePnls - Array of individual trade P&L values
   * @param drawdownThreshold - Fraction of peak equity that constitutes ruin (e.g., 0.5 = 50% DD)
   * @param numSimulations - Override for number of simulations
   */
  calculateRuinProbability(
    tradePnls: number[],
    drawdownThreshold: number,
    numSimulations?: number,
  ): RuinResult {
    const n = numSimulations ?? this.config.numSimulations

    if (tradePnls.length === 0 || drawdownThreshold <= 0) {
      return {
        probability: 0,
        ruinCount: 0,
        totalSimulations: n,
        drawdownThreshold,
      }
    }

    let ruinCount = 0

    for (let sim = 0; sim < n; sim++) {
      const shuffled = this.bootstrapSample(tradePnls, tradePnls.length)
      let equity = this.config.initialCapital
      let peak = equity

      for (const pnl of shuffled) {
        equity += pnl
        if (equity > peak) peak = equity

        const drawdown = peak > 0 ? (peak - equity) / peak : 0
        if (drawdown >= drawdownThreshold) {
          ruinCount++
          break
        }
      }
    }

    return {
      probability: ruinCount / n,
      ruinCount,
      totalSimulations: n,
      drawdownThreshold,
    }
  }

  // ── Private Methods ────────────────────────────────────────────────────

  /**
   * Run a single simulation path by sampling trades with replacement.
   */
  private runSinglePath(tradePnls: number[]): SimulationPath {
    const bootstrapped = this.bootstrapSample(tradePnls, tradePnls.length)
    const equityCurve: number[] = [this.config.initialCapital]
    let equity = this.config.initialCapital
    let peak = equity
    let maxDrawdown = 0

    for (const pnl of bootstrapped) {
      equity += pnl
      equityCurve.push(equity)

      if (equity > peak) peak = equity
      const dd = peak > 0 ? (peak - equity) / peak : 0
      if (dd > maxDrawdown) maxDrawdown = dd
    }

    // Calculate Sharpe ratio for this path
    const returns = bootstrapped
    const mean = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0
    const variance =
      returns.length > 1
        ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
        : 0
    const stdDev = Math.sqrt(variance)
    const sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0

    return {
      equityCurve,
      finalEquity: equity,
      maxDrawdown,
      sharpeRatio,
    }
  }

  /**
   * Bootstrap sample with replacement from the source array.
   */
  private bootstrapSample(source: number[], size: number): number[] {
    const result: number[] = []
    for (let i = 0; i < size; i++) {
      result.push(source[this.rng.nextInt(source.length)]!)
    }
    return result
  }

  /**
   * Calculate percentile distribution for a set of values.
   */
  private percentiles(values: number[]): PercentileDistribution {
    if (values.length === 0) {
      return { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 }
    }

    const sorted = [...values].sort((a, b) => a - b)
    return {
      p5: this.percentile(sorted, 0.05),
      p25: this.percentile(sorted, 0.25),
      p50: this.percentile(sorted, 0.50),
      p75: this.percentile(sorted, 0.75),
      p95: this.percentile(sorted, 0.95),
    }
  }

  /**
   * Calculate a specific percentile from a sorted array using linear interpolation.
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    if (sorted.length === 1) return sorted[0]!

    const idx = p * (sorted.length - 1)
    const lower = Math.floor(idx)
    const upper = Math.ceil(idx)
    const fraction = idx - lower

    if (lower === upper) return sorted[lower]!
    return sorted[lower]! * (1 - fraction) + sorted[upper]! * fraction
  }

  /**
   * Calculate the arithmetic mean of an array.
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((s, v) => s + v, 0) / values.length
  }

  /**
   * Sample N unique indices from [0, total).
   */
  private sampleIndices(total: number, n: number): number[] {
    if (n >= total) return Array.from({ length: total }, (_, i) => i)

    const indices = new Set<number>()
    while (indices.size < n) {
      indices.add(this.rng.nextInt(total))
    }
    return Array.from(indices)
  }

  /**
   * Return an empty result when no trades are provided.
   */
  private emptyResult(n: number): MonteCarloResult {
    const zeroDist: PercentileDistribution = { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 }
    return {
      paths: [],
      samplePaths: [],
      finalEquity: { ...zeroDist, p5: this.config.initialCapital, p25: this.config.initialCapital, p50: this.config.initialCapital, p75: this.config.initialCapital, p95: this.config.initialCapital },
      maxDrawdown: zeroDist,
      sharpeRatio: zeroDist,
      meanFinalEquity: this.config.initialCapital,
      meanMaxDrawdown: 0,
      meanSharpe: 0,
      numSimulations: n,
    }
  }
}
