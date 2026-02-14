import type {
  DriftReport,
  DriftSeverity,
  DriftMetric,
  MLPrediction,
  MLModelMetrics,
} from '@marlin/shared'

// ---------------------------------------------------------------------------
// In-memory drift history (would be DB in production)
// ---------------------------------------------------------------------------

const driftHistory = new Map<string, DriftReport[]>() // modelId -> reports

// ---------------------------------------------------------------------------
// PSI (Population Stability Index) calculation
// ---------------------------------------------------------------------------

/**
 * Compute the Population Stability Index between two distributions.
 * PSI measures how much a distribution has shifted.
 *
 * PSI < 0.1 = no significant shift
 * PSI 0.1-0.25 = moderate shift (warning)
 * PSI > 0.25 = significant shift (critical)
 *
 * Both arrays are binned into `numBins` equal-frequency buckets based on
 * the baseline distribution.
 */
export function calculatePSI(
  baseline: number[],
  current: number[],
  numBins: number = 10,
): number {
  if (baseline.length === 0 || current.length === 0) return 0

  // Sort baseline to determine bin edges
  const sorted = [...baseline].sort((a, b) => a - b)
  const binEdges: number[] = []
  for (let i = 1; i < numBins; i++) {
    const idx = Math.floor((i / numBins) * sorted.length)
    binEdges.push(sorted[Math.min(idx, sorted.length - 1)]!)
  }

  // Count values in each bin for both distributions
  const countInBins = (values: number[]): number[] => {
    const counts = new Array<number>(numBins).fill(0)
    for (const val of values) {
      let bin = 0
      for (let i = 0; i < binEdges.length; i++) {
        if (val > binEdges[i]!) bin = i + 1
      }
      counts[Math.min(bin, numBins - 1)]!++
    }
    return counts
  }

  const baselineCounts = countInBins(baseline)
  const currentCounts = countInBins(current)

  // Convert to proportions with epsilon smoothing
  const epsilon = 0.0001
  const baselineTotal = baseline.length
  const currentTotal = current.length

  let psi = 0
  for (let i = 0; i < numBins; i++) {
    const p = (baselineCounts[i]! / baselineTotal) + epsilon
    const q = (currentCounts[i]! / currentTotal) + epsilon
    psi += (q - p) * Math.log(q / p)
  }

  return Math.max(0, psi)
}

// ---------------------------------------------------------------------------
// DriftDetector class
// ---------------------------------------------------------------------------

export class DriftDetector {
  /**
   * Check for model drift by comparing recent performance to training metrics.
   *
   * @param modelId — model identifier
   * @param trainingMetrics — metrics from the original training run
   * @param recentPredictions — last N predictions with outcomes
   * @param recentOutcomes — actual outcomes matching predictions (same length)
   */
  checkDrift(
    modelId: string,
    trainingMetrics: MLModelMetrics,
    recentPredictions: MLPrediction[],
    recentOutcomes: MLPrediction['signal'][],
  ): DriftReport | null {
    if (recentPredictions.length === 0 || recentOutcomes.length === 0) {
      return null
    }

    // Ensure equal lengths
    const len = Math.min(recentPredictions.length, recentOutcomes.length)
    const preds = recentPredictions.slice(0, len)
    const outcomes = recentOutcomes.slice(0, len)

    // Calculate rolling accuracy
    let correct = 0
    for (let i = 0; i < len; i++) {
      if (preds[i]!.signal === outcomes[i]) correct++
    }
    const rollingAccuracy = correct / len

    // Calculate rolling AUC approximation (using confidence-weighted accuracy)
    let weightedCorrect = 0
    let totalWeight = 0
    for (let i = 0; i < len; i++) {
      const weight = preds[i]!.confidence
      if (preds[i]!.signal === outcomes[i]) weightedCorrect += weight
      totalWeight += weight
    }
    const rollingAUC = totalWeight > 0 ? weightedCorrect / totalWeight : 0

    // Compare against training baselines
    const baselineAccuracy = trainingMetrics.accuracy ?? 0.75
    const baselineAUC = trainingMetrics.auc ?? 0.80

    // Check accuracy degradation
    const accuracyDegradation = baselineAccuracy > 0
      ? Math.max(0, (baselineAccuracy - rollingAccuracy) / baselineAccuracy)
      : 0

    // Check AUC degradation
    const aucDegradation = baselineAUC > 0
      ? Math.max(0, (baselineAUC - rollingAUC) / baselineAUC)
      : 0

    // Pick the worst metric
    let worstMetric: DriftMetric = 'accuracy'
    let worstDegradation = accuracyDegradation
    let baseline = baselineAccuracy
    let current = rollingAccuracy

    if (aucDegradation > accuracyDegradation) {
      worstMetric = 'auc'
      worstDegradation = aucDegradation
      baseline = baselineAUC
      current = rollingAUC
    }

    // Also compute PSI on confidence scores
    const baselineConfidences = preds.slice(0, Math.floor(len / 2)).map((p) => p.confidence)
    const recentConfidences = preds.slice(Math.floor(len / 2)).map((p) => p.confidence)
    const psi = calculatePSI(baselineConfidences, recentConfidences)

    // Determine severity
    const severity = this.classifySeverity(worstDegradation, psi)

    if (severity === 'none') {
      return null
    }

    const recommendation = severity === 'critical'
      ? `Model performance has degraded by ${(worstDegradation * 100).toFixed(1)}% on ${worstMetric}. Immediate retraining is recommended with recent market data.`
      : `Model performance has degraded by ${(worstDegradation * 100).toFixed(1)}% on ${worstMetric}. Monitor closely and consider retraining if degradation continues.`

    const report: DriftReport = {
      id: crypto.randomUUID(),
      modelId,
      detectedAt: new Date().toISOString(),
      metric: worstMetric,
      baseline,
      current,
      degradation: worstDegradation,
      severity,
      psi,
      recommendation,
    }

    // Store in history
    const history = driftHistory.get(modelId) ?? []
    history.push(report)
    driftHistory.set(modelId, history)

    return report
  }

  /**
   * Get drift report history for a model.
   */
  getDriftHistory(modelId: string): DriftReport[] {
    return driftHistory.get(modelId) ?? []
  }

  /**
   * Generate a comprehensive drift analysis report.
   */
  generateDriftReport(
    modelId: string,
    trainingMetrics: MLModelMetrics,
    recentPredictions: MLPrediction[],
    recentOutcomes: MLPrediction['signal'][],
  ): {
    report: DriftReport | null
    summary: {
      rollingAccuracy: number
      rollingAUC: number
      psi: number
      sampleSize: number
      history: DriftReport[]
    }
  } {
    const len = Math.min(recentPredictions.length, recentOutcomes.length)

    // Rolling accuracy
    let correct = 0
    for (let i = 0; i < len; i++) {
      if (recentPredictions[i]!.signal === recentOutcomes[i]) correct++
    }
    const rollingAccuracy = len > 0 ? correct / len : 0

    // Rolling AUC
    let weightedCorrect = 0
    let totalWeight = 0
    for (let i = 0; i < len; i++) {
      const weight = recentPredictions[i]!.confidence
      if (recentPredictions[i]!.signal === recentOutcomes[i]) weightedCorrect += weight
      totalWeight += weight
    }
    const rollingAUC = totalWeight > 0 ? weightedCorrect / totalWeight : 0

    // PSI
    const half = Math.floor(len / 2)
    const baselineConf = recentPredictions.slice(0, half).map((p) => p.confidence)
    const recentConf = recentPredictions.slice(half, len).map((p) => p.confidence)
    const psi = calculatePSI(baselineConf, recentConf)

    const report = this.checkDrift(modelId, trainingMetrics, recentPredictions, recentOutcomes)
    const history = this.getDriftHistory(modelId)

    return {
      report,
      summary: {
        rollingAccuracy,
        rollingAUC,
        psi,
        sampleSize: len,
        history,
      },
    }
  }

  // ── Private ────────────────────────────────────────────────

  /**
   * Classify drift severity based on degradation and PSI.
   * >20% degradation OR PSI > 0.1 = warning
   * >40% degradation OR PSI > 0.25 = critical
   */
  private classifySeverity(degradation: number, psi: number): DriftSeverity {
    if (degradation > 0.40 || psi > 0.25) return 'critical'
    if (degradation > 0.20 || psi > 0.10) return 'warning'
    return 'none'
  }
}
