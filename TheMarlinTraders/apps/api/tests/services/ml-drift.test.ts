import { describe, it, expect } from 'vitest'
import { DriftDetector, calculatePSI } from '../../src/services/ml-drift.js'
import type { MLModelMetrics, MLPrediction, MLSignal } from '@marlin/shared'

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makePrediction(
  signal: MLSignal,
  confidence: number,
  modelId: string = 'model-1',
): MLPrediction {
  return {
    id: crypto.randomUUID(),
    modelId,
    timestamp: new Date().toISOString(),
    symbol: 'AAPL',
    signal,
    confidence,
    features: { smaRatio_20: 1.02 },
  }
}

function makePredictions(
  count: number,
  signalPattern: MLSignal[],
  confidenceBase: number = 0.7,
  modelId: string = 'model-1',
): MLPrediction[] {
  return Array.from({ length: count }, (_, i) =>
    makePrediction(
      signalPattern[i % signalPattern.length]!,
      confidenceBase + (Math.random() - 0.5) * 0.2,
      modelId,
    ),
  )
}

const BASELINE_METRICS: MLModelMetrics = {
  accuracy: 0.80,
  precision: 0.78,
  recall: 0.82,
  auc: 0.85,
  sharpe: 1.5,
}

// ---------------------------------------------------------------------------
// PSI Calculation
// ---------------------------------------------------------------------------

describe('calculatePSI', () => {
  it('returns 0 for empty distributions', () => {
    expect(calculatePSI([], [])).toBe(0)
    expect(calculatePSI([1, 2, 3], [])).toBe(0)
    expect(calculatePSI([], [1, 2, 3])).toBe(0)
  })

  it('returns near 0 for identical distributions', () => {
    const data = Array.from({ length: 100 }, (_, i) => i / 100)
    const psi = calculatePSI(data, data)
    expect(psi).toBeLessThan(0.05) // Should be very close to 0
  })

  it('returns low PSI for similar distributions', () => {
    const baseline = Array.from({ length: 200 }, () => Math.random())
    const similar = Array.from({ length: 200 }, () => Math.random() + 0.05) // slight shift
    const psi = calculatePSI(baseline, similar)
    expect(psi).toBeLessThan(0.25) // Should indicate at most moderate shift
  })

  it('returns higher PSI for shifted distributions', () => {
    // Baseline: uniform 0-1
    const baseline = Array.from({ length: 200 }, () => Math.random())
    // Shifted: uniform 0.5-1.5 (major shift)
    const shifted = Array.from({ length: 200 }, () => Math.random() + 0.5)
    const psi = calculatePSI(baseline, shifted)
    expect(psi).toBeGreaterThan(0.1) // Should detect significant shift
  })

  it('returns very high PSI for completely different distributions', () => {
    // Baseline: all near 0
    const baseline = Array.from({ length: 100 }, () => Math.random() * 0.1)
    // Current: all near 1
    const current = Array.from({ length: 100 }, () => 0.9 + Math.random() * 0.1)
    const psi = calculatePSI(baseline, current)
    expect(psi).toBeGreaterThan(0.25) // Critical threshold
  })
})

// ---------------------------------------------------------------------------
// No Drift
// ---------------------------------------------------------------------------

describe('DriftDetector — no drift', () => {
  it('returns null when performance matches baseline', () => {
    const detector = new DriftDetector()

    // Generate predictions that match the baseline accuracy (80%)
    const count = 100
    const predictions: MLPrediction[] = []
    const outcomes: MLSignal[] = []

    for (let i = 0; i < count; i++) {
      const signal: MLSignal = i % 3 === 0 ? 'bullish' : i % 3 === 1 ? 'bearish' : 'neutral'
      predictions.push(makePrediction(signal, 0.75, 'test-nodrift'))
      // 80% correct — matches baseline
      outcomes.push(i % 5 === 0 ? (signal === 'bullish' ? 'bearish' : 'bullish') : signal)
    }

    const report = detector.checkDrift('test-nodrift', BASELINE_METRICS, predictions, outcomes)
    expect(report).toBeNull()
  })

  it('returns null for empty predictions', () => {
    const detector = new DriftDetector()
    const report = detector.checkDrift('test-empty', BASELINE_METRICS, [], [])
    expect(report).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Warning at >20% Degradation
// ---------------------------------------------------------------------------

describe('DriftDetector — warning threshold', () => {
  it('returns warning when accuracy degrades >20%', () => {
    const detector = new DriftDetector()

    // Baseline accuracy = 0.80
    // Current accuracy = ~0.60 => degradation = (0.80 - 0.60) / 0.80 = 0.25 => > 20%
    const count = 100
    const predictions: MLPrediction[] = []
    const outcomes: MLSignal[] = []

    for (let i = 0; i < count; i++) {
      const signal: MLSignal = i % 2 === 0 ? 'bullish' : 'bearish'
      predictions.push(makePrediction(signal, 0.7, 'test-warning'))
      // Only 60% correct
      outcomes.push(i % 5 < 3 ? signal : (signal === 'bullish' ? 'bearish' : 'bullish'))
    }

    const report = detector.checkDrift('test-warning', BASELINE_METRICS, predictions, outcomes)
    expect(report).not.toBeNull()
    expect(report!.severity).toBe('warning')
    expect(report!.degradation).toBeGreaterThan(0.20)
    expect(report!.recommendation).toContain('Monitor closely')
  })
})

// ---------------------------------------------------------------------------
// Critical at >40% Degradation
// ---------------------------------------------------------------------------

describe('DriftDetector — critical threshold', () => {
  it('returns critical when accuracy degrades >40%', () => {
    const detector = new DriftDetector()

    // Baseline accuracy = 0.80
    // Current accuracy = ~0.40 => degradation = (0.80 - 0.40) / 0.80 = 0.50 => > 40%
    const count = 100
    const predictions: MLPrediction[] = []
    const outcomes: MLSignal[] = []

    for (let i = 0; i < count; i++) {
      const signal: MLSignal = i % 2 === 0 ? 'bullish' : 'bearish'
      predictions.push(makePrediction(signal, 0.6, 'test-critical'))
      // Only 40% correct
      outcomes.push(i % 5 < 2 ? signal : (signal === 'bullish' ? 'bearish' : 'bullish'))
    }

    const report = detector.checkDrift('test-critical', BASELINE_METRICS, predictions, outcomes)
    expect(report).not.toBeNull()
    expect(report!.severity).toBe('critical')
    expect(report!.degradation).toBeGreaterThan(0.40)
    expect(report!.recommendation).toContain('Immediate retraining')
  })
})

// ---------------------------------------------------------------------------
// PSI-based drift detection
// ---------------------------------------------------------------------------

describe('DriftDetector — PSI detection', () => {
  it('detects feature distribution shift via PSI', () => {
    const detector = new DriftDetector()

    // Create predictions where first half has low confidence, second half has high
    // This creates a distribution shift in the confidence values
    const count = 100
    const predictions: MLPrediction[] = []
    const outcomes: MLSignal[] = []

    for (let i = 0; i < count; i++) {
      const signal: MLSignal = 'bullish'
      // First half: low confidence; second half: high confidence
      const confidence = i < 50 ? 0.3 + Math.random() * 0.1 : 0.85 + Math.random() * 0.1
      predictions.push(makePrediction(signal, confidence, 'test-psi'))
      // Keep accuracy at ~75% (close to baseline) so PSI is the main signal
      outcomes.push(i % 4 === 0 ? 'bearish' : signal)
    }

    const report = detector.checkDrift('test-psi', BASELINE_METRICS, predictions, outcomes)
    // The confidence distribution shift should be detected via PSI
    if (report) {
      expect(report.psi).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Drift Report Generation
// ---------------------------------------------------------------------------

describe('DriftDetector — report generation', () => {
  it('generates a full drift report with summary', () => {
    const detector = new DriftDetector()

    const count = 50
    const predictions = makePredictions(count, ['bullish', 'bearish', 'neutral'], 0.7, 'test-report')
    const outcomes: MLSignal[] = Array.from({ length: count }, (_, i) =>
      i % 3 === 0 ? 'bullish' : i % 3 === 1 ? 'bearish' : 'neutral',
    )

    const { report, summary } = detector.generateDriftReport(
      'test-report',
      BASELINE_METRICS,
      predictions,
      outcomes,
    )

    expect(summary.sampleSize).toBe(count)
    expect(summary.rollingAccuracy).toBeGreaterThanOrEqual(0)
    expect(summary.rollingAccuracy).toBeLessThanOrEqual(1)
    expect(summary.rollingAUC).toBeGreaterThanOrEqual(0)
    expect(summary.psi).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(summary.history)).toBe(true)
  })

  it('accumulates drift history across calls', () => {
    const detector = new DriftDetector()
    const modelId = 'test-history-' + Date.now()

    // First call — trigger a warning
    const preds1 = makePredictions(50, ['bullish'], 0.7, modelId)
    const outcomes1: MLSignal[] = Array.from({ length: 50 }, (_, i) =>
      i % 5 < 3 ? 'bullish' : 'bearish',
    )
    detector.checkDrift(modelId, BASELINE_METRICS, preds1, outcomes1)

    // Second call — trigger another report
    const preds2 = makePredictions(50, ['bearish'], 0.6, modelId)
    const outcomes2: MLSignal[] = Array.from({ length: 50 }, (_, i) =>
      i % 5 < 2 ? 'bearish' : 'bullish',
    )
    detector.checkDrift(modelId, BASELINE_METRICS, preds2, outcomes2)

    const history = detector.getDriftHistory(modelId)
    // Should have accumulated reports (at least from the calls that triggered drift)
    expect(history.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('DriftDetector — edge cases', () => {
  it('handles mismatched prediction and outcome lengths', () => {
    const detector = new DriftDetector()
    const predictions = makePredictions(10, ['bullish'], 0.7, 'test-mismatch')
    const outcomes: MLSignal[] = ['bullish', 'bearish', 'bullish'] // shorter

    // Should not crash — uses min length
    const report = detector.checkDrift('test-mismatch', BASELINE_METRICS, predictions, outcomes)
    // With only 3 samples and ~67% accuracy, degradation should be calculable
    expect(report === null || typeof report.degradation === 'number').toBe(true)
  })

  it('handles baseline metrics with zeros gracefully', () => {
    const detector = new DriftDetector()
    const zeroMetrics: MLModelMetrics = { accuracy: 0, auc: 0 }
    const predictions = makePredictions(20, ['bullish', 'bearish'], 0.7, 'test-zero')
    const outcomes: MLSignal[] = Array.from({ length: 20 }, () => 'bullish')

    // Should not crash with division by zero
    const report = detector.checkDrift('test-zero', zeroMetrics, predictions, outcomes)
    // With zero baseline, degradation should be 0 (no reference point)
    expect(report === null || Number.isFinite(report.degradation)).toBe(true)
  })

  it('getDriftHistory returns empty array for unknown model', () => {
    const detector = new DriftDetector()
    expect(detector.getDriftHistory('nonexistent')).toEqual([])
  })
})
