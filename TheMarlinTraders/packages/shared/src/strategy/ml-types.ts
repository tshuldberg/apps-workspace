import { z } from 'zod'

// ── ML Feature ─────────────────────────────────────────────────────────────

export const MLFeatureTypeSchema = z.enum(['indicator', 'price', 'volume', 'custom'])
export type MLFeatureType = z.infer<typeof MLFeatureTypeSchema>

export const NormalizationMethodSchema = z.enum(['none', 'zscore', 'minmax'])
export type NormalizationMethod = z.infer<typeof NormalizationMethodSchema>

export const MLFeatureSchema = z.object({
  name: z.string().min(1).max(64),
  type: MLFeatureTypeSchema,
  params: z.record(z.unknown()).default({}),
  normalization: NormalizationMethodSchema.default('none'),
})

export type MLFeature = z.infer<typeof MLFeatureSchema>

// ── ML Model ───────────────────────────────────────────────────────────────

export const MLModelTypeSchema = z.enum(['classification', 'regression'])
export type MLModelType = z.infer<typeof MLModelTypeSchema>

export const MLModelStatusSchema = z.enum(['draft', 'training', 'ready', 'degraded'])
export type MLModelStatus = z.infer<typeof MLModelStatusSchema>

export const MLModelMetricsSchema = z.object({
  accuracy: z.number().min(0).max(1).optional(),
  precision: z.number().min(0).max(1).optional(),
  recall: z.number().min(0).max(1).optional(),
  auc: z.number().min(0).max(1).optional(),
  mse: z.number().min(0).optional(),
  mae: z.number().min(0).optional(),
  r2: z.number().optional(),
  sharpe: z.number().optional(),
})

export type MLModelMetrics = z.infer<typeof MLModelMetricsSchema>

export const MLModelSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  name: z.string().min(1).max(128),
  type: MLModelTypeSchema,
  status: MLModelStatusSchema,
  features: z.array(MLFeatureSchema),
  targetVariable: z.string().min(1),
  hyperparameters: z.record(z.unknown()).default({}),
  trainedAt: z.string().datetime().optional(),
  metrics: MLModelMetricsSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type MLModel = z.infer<typeof MLModelSchema>

// ── ML Prediction ──────────────────────────────────────────────────────────

export const MLSignalSchema = z.enum(['bullish', 'bearish', 'neutral'])
export type MLSignal = z.infer<typeof MLSignalSchema>

export const MLPredictionSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
  timestamp: z.string().datetime(),
  symbol: z.string().min(1).max(20),
  signal: MLSignalSchema,
  confidence: z.number().min(0).max(1),
  features: z.record(z.number()),
  actualOutcome: MLSignalSchema.optional(),
})

export type MLPrediction = z.infer<typeof MLPredictionSchema>

// ── Feature Set ────────────────────────────────────────────────────────────

export const FeatureSetSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(512),
  features: z.array(MLFeatureSchema),
})

export type FeatureSet = z.infer<typeof FeatureSetSchema>

// ── Training Config ────────────────────────────────────────────────────────

export const TrainingConfigSchema = z.object({
  name: z.string().min(1).max(128),
  modelType: MLModelTypeSchema,
  features: z.array(MLFeatureSchema).min(1),
  target: z.string().min(1),
  trainTestSplit: z.number().min(0.1).max(0.9).default(0.8),
  epochs: z.number().int().min(1).max(1000).default(100),
  learningRate: z.number().min(0.00001).max(1).default(0.001),
  validationSplit: z.number().min(0).max(0.5).default(0.2),
})

export type TrainingConfig = z.infer<typeof TrainingConfigSchema>

// ── Drift Report ───────────────────────────────────────────────────────────

export const DriftMetricSchema = z.enum(['accuracy', 'auc', 'sharpe'])
export type DriftMetric = z.infer<typeof DriftMetricSchema>

export const DriftSeveritySchema = z.enum(['none', 'warning', 'critical'])
export type DriftSeverity = z.infer<typeof DriftSeveritySchema>

export const DriftReportSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
  detectedAt: z.string().datetime(),
  metric: DriftMetricSchema,
  baseline: z.number(),
  current: z.number(),
  degradation: z.number().min(0).max(1),
  severity: DriftSeveritySchema,
  psi: z.number().min(0).optional(),
  recommendation: z.string(),
})

export type DriftReport = z.infer<typeof DriftReportSchema>

// ── Pre-built Feature Sets ─────────────────────────────────────────────────

export const TREND_FEATURES: FeatureSet = {
  name: 'Trend Features',
  description: 'Trend-following features based on SMA ratios and EMA slopes across multiple timeframes.',
  features: [
    { name: 'smaRatio_20', type: 'indicator', params: { period: 20 }, normalization: 'zscore' },
    { name: 'smaRatio_50', type: 'indicator', params: { period: 50 }, normalization: 'zscore' },
    { name: 'smaRatio_200', type: 'indicator', params: { period: 200 }, normalization: 'zscore' },
    { name: 'emaSlope_12', type: 'indicator', params: { period: 12 }, normalization: 'zscore' },
    { name: 'emaSlope_26', type: 'indicator', params: { period: 26 }, normalization: 'zscore' },
  ],
}

export const MOMENTUM_FEATURES: FeatureSet = {
  name: 'Momentum Features',
  description: 'Momentum oscillators including RSI and MACD histogram for overbought/oversold detection.',
  features: [
    { name: 'rsi_14', type: 'indicator', params: { period: 14 }, normalization: 'minmax' },
    { name: 'rsi_7', type: 'indicator', params: { period: 7 }, normalization: 'minmax' },
    { name: 'macdHistogram', type: 'indicator', params: {}, normalization: 'zscore' },
  ],
}

export const VOLATILITY_FEATURES: FeatureSet = {
  name: 'Volatility Features',
  description: 'Volatility metrics including ATR ratio and Bollinger Band width for regime detection.',
  features: [
    { name: 'atrRatio_14', type: 'indicator', params: { period: 14 }, normalization: 'zscore' },
    { name: 'atrRatio_7', type: 'indicator', params: { period: 7 }, normalization: 'zscore' },
    { name: 'bbWidth_20', type: 'indicator', params: { period: 20 }, normalization: 'zscore' },
  ],
}

export const VOLUME_FEATURES: FeatureSet = {
  name: 'Volume Features',
  description: 'Volume-based features including relative volume and OBV slope for participation analysis.',
  features: [
    { name: 'rvol_20', type: 'volume', params: { period: 20 }, normalization: 'zscore' },
    { name: 'obvSlope_14', type: 'volume', params: { period: 14 }, normalization: 'zscore' },
  ],
}

export const PREBUILT_FEATURE_SETS: FeatureSet[] = [
  TREND_FEATURES,
  MOMENTUM_FEATURES,
  VOLATILITY_FEATURES,
  VOLUME_FEATURES,
]
