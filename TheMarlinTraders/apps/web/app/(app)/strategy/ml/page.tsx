'use client'

import { useState, useCallback, useMemo } from 'react'
import { MLDashboard } from '@marlin/ui/trading/ml-dashboard'
import type {
  MLModel,
  MLPrediction,
  DriftReport,
  FeatureSet,
  MLModelType,
} from '@marlin/shared'
import { PREBUILT_FEATURE_SETS } from '@marlin/shared'

// ── Mock Data ───────────────────────────────────────────────────────────────
// TODO: Replace with tRPC queries
// trpc.ml.listModels.useQuery()
// trpc.ml.listFeatureSets.useQuery()

const now = new Date()

function hoursAgo(hours: number): string {
  return new Date(now.getTime() - hours * 3600_000).toISOString()
}

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}

// --- Model 1: Classification model (ready) ---
const MODEL_1: MLModel = {
  id: '10000000-0000-0000-0000-000000000001',
  userId: 'user-1',
  name: 'Trend Classifier v2',
  type: 'classification',
  status: 'ready',
  features: [
    { name: 'smaRatio_20', type: 'indicator', params: { period: 20 }, normalization: 'zscore' },
    { name: 'smaRatio_50', type: 'indicator', params: { period: 50 }, normalization: 'zscore' },
    { name: 'emaSlope_12', type: 'indicator', params: { period: 12 }, normalization: 'zscore' },
    { name: 'rsi_14', type: 'indicator', params: { period: 14 }, normalization: 'minmax' },
    { name: 'macdHistogram', type: 'indicator', params: {}, normalization: 'zscore' },
  ],
  targetVariable: 'binaryDirection_5',
  hyperparameters: { epochs: 100, learningRate: 0.001, trainTestSplit: 0.8 },
  trainedAt: daysAgo(3),
  metrics: { accuracy: 0.782, precision: 0.756, recall: 0.814, auc: 0.843, sharpe: 1.42 },
  createdAt: daysAgo(10),
  updatedAt: daysAgo(3),
}

// --- Model 2: Regression model (ready) ---
const MODEL_2: MLModel = {
  id: '10000000-0000-0000-0000-000000000002',
  userId: 'user-1',
  name: 'Return Predictor',
  type: 'regression',
  status: 'ready',
  features: [
    { name: 'atrRatio_14', type: 'indicator', params: { period: 14 }, normalization: 'zscore' },
    { name: 'bbWidth_20', type: 'indicator', params: { period: 20 }, normalization: 'zscore' },
    { name: 'rvol_20', type: 'volume', params: { period: 20 }, normalization: 'zscore' },
    { name: 'obvSlope_14', type: 'volume', params: { period: 14 }, normalization: 'zscore' },
  ],
  targetVariable: 'returnNBars_5',
  hyperparameters: { epochs: 200, learningRate: 0.0005, trainTestSplit: 0.8 },
  trainedAt: daysAgo(7),
  metrics: { mse: 0.0032, mae: 0.038, r2: 0.68, sharpe: 1.15 },
  createdAt: daysAgo(14),
  updatedAt: daysAgo(7),
}

// --- Model 3: Degraded classification model ---
const MODEL_3: MLModel = {
  id: '10000000-0000-0000-0000-000000000003',
  userId: 'user-1',
  name: 'Momentum Classifier (Stale)',
  type: 'classification',
  status: 'degraded',
  features: [
    { name: 'rsi_14', type: 'indicator', params: { period: 14 }, normalization: 'minmax' },
    { name: 'rsi_7', type: 'indicator', params: { period: 7 }, normalization: 'minmax' },
    { name: 'macdHistogram', type: 'indicator', params: {}, normalization: 'zscore' },
  ],
  targetVariable: 'binaryDirection_10',
  hyperparameters: { epochs: 100, learningRate: 0.001, trainTestSplit: 0.8 },
  trainedAt: daysAgo(30),
  metrics: { accuracy: 0.71, precision: 0.68, recall: 0.73, auc: 0.76, sharpe: 0.92 },
  createdAt: daysAgo(45),
  updatedAt: daysAgo(2),
}

const MOCK_MODELS = [MODEL_1, MODEL_2, MODEL_3]

// --- Mock predictions ---
function generatePredictions(modelId: string, count: number): MLPrediction[] {
  const signals = ['bullish', 'bearish', 'neutral'] as const
  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    modelId,
    timestamp: hoursAgo(count - i),
    symbol: ['AAPL', 'NVDA', 'TSLA', 'SPY', 'MSFT'][i % 5]!,
    signal: signals[i % 3]!,
    confidence: 0.55 + Math.random() * 0.35,
    features: { smaRatio_20: 1.02 + Math.random() * 0.05, rsi_14: 40 + Math.random() * 30 },
    actualOutcome: i < count - 5 ? signals[(i + (i % 2 === 0 ? 0 : 1)) % 3] : undefined,
  }))
}

const MOCK_PREDICTIONS: Record<string, MLPrediction[]> = {
  [MODEL_1.id]: generatePredictions(MODEL_1.id, 15),
  [MODEL_2.id]: generatePredictions(MODEL_2.id, 8),
  [MODEL_3.id]: generatePredictions(MODEL_3.id, 20),
}

// --- Mock drift history ---
const MOCK_DRIFT_HISTORY: Record<string, DriftReport[]> = {
  [MODEL_1.id]: [
    {
      id: crypto.randomUUID(),
      modelId: MODEL_1.id,
      detectedAt: daysAgo(5),
      metric: 'accuracy',
      baseline: 0.782,
      current: 0.75,
      degradation: 0.04,
      severity: 'none',
      psi: 0.03,
      recommendation: 'No significant drift detected.',
    },
  ],
  [MODEL_2.id]: [],
  [MODEL_3.id]: [
    {
      id: crypto.randomUUID(),
      modelId: MODEL_3.id,
      detectedAt: daysAgo(10),
      metric: 'accuracy',
      baseline: 0.71,
      current: 0.62,
      degradation: 0.127,
      severity: 'none',
      psi: 0.06,
      recommendation: 'Minor degradation detected. Continue monitoring.',
    },
    {
      id: crypto.randomUUID(),
      modelId: MODEL_3.id,
      detectedAt: daysAgo(5),
      metric: 'accuracy',
      baseline: 0.71,
      current: 0.55,
      degradation: 0.225,
      severity: 'warning',
      psi: 0.14,
      recommendation: 'Model performance has degraded by 22.5% on accuracy. Monitor closely and consider retraining if degradation continues.',
    },
    {
      id: crypto.randomUUID(),
      modelId: MODEL_3.id,
      detectedAt: daysAgo(2),
      metric: 'accuracy',
      baseline: 0.71,
      current: 0.41,
      degradation: 0.423,
      severity: 'critical',
      psi: 0.28,
      recommendation: 'Model performance has degraded by 42.3% on accuracy. Immediate retraining is recommended with recent market data.',
    },
  ],
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function MLPage() {
  const [models, setModels] = useState<MLModel[]>(MOCK_MODELS)

  const handleCreateModel = useCallback(
    (config: { name: string; modelType: MLModelType; featureSetName: string; target: string }) => {
      const featureSet = PREBUILT_FEATURE_SETS.find((fs) => fs.name === config.featureSetName)
      if (!featureSet) return

      const newModel: MLModel = {
        id: crypto.randomUUID(),
        userId: 'user-1',
        name: config.name,
        type: config.modelType,
        status: 'draft',
        features: featureSet.features,
        targetVariable: config.target,
        hyperparameters: { epochs: 100, learningRate: 0.001 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setModels((prev) => [newModel, ...prev])
    },
    [],
  )

  const handleTrainModel = useCallback((modelId: string) => {
    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId
          ? {
              ...m,
              status: 'training' as const,
              updatedAt: new Date().toISOString(),
            }
          : m,
      ),
    )

    // Simulate training completion after 2 seconds
    setTimeout(() => {
      setModels((prev) =>
        prev.map((m) =>
          m.id === modelId
            ? {
                ...m,
                status: 'ready' as const,
                trainedAt: new Date().toISOString(),
                metrics:
                  m.type === 'classification'
                    ? {
                        accuracy: 0.72 + Math.random() * 0.15,
                        precision: 0.68 + Math.random() * 0.18,
                        recall: 0.65 + Math.random() * 0.2,
                        auc: 0.75 + Math.random() * 0.15,
                        sharpe: 0.8 + Math.random() * 1.2,
                      }
                    : {
                        mse: 0.001 + Math.random() * 0.005,
                        mae: 0.02 + Math.random() * 0.03,
                        r2: 0.5 + Math.random() * 0.35,
                        sharpe: 0.6 + Math.random() * 1.4,
                      },
                updatedAt: new Date().toISOString(),
              }
            : m,
        ),
      )
    }, 2000)
  }, [])

  const handleDeleteModel = useCallback((modelId: string) => {
    setModels((prev) => prev.filter((m) => m.id !== modelId))
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">ML Models</h1>
        <p className="text-xs text-text-muted">
          Train, evaluate, and monitor machine learning models for trading signal generation
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <MLDashboard
          models={models}
          predictions={MOCK_PREDICTIONS}
          driftHistory={MOCK_DRIFT_HISTORY}
          featureSets={PREBUILT_FEATURE_SETS}
          onCreateModel={handleCreateModel}
          onTrainModel={handleTrainModel}
          onDeleteModel={handleDeleteModel}
        />
      </div>
    </div>
  )
}
