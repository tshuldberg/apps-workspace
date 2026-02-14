export type {
  StrategyParameter,
  StrategyLanguage,
  StrategyConfig,
  StrategySignal,
  BacktestConfig,
  BacktestTrade,
  EquityPoint,
  BacktestMetrics,
  BacktestResult,
  StrategyCategory,
  StrategyTemplate,
  StrategyFile,
  StrategyRunStatus,
} from './types.js'

export {
  StrategyParameterSchema,
  StrategyLanguageSchema,
  StrategyConfigSchema,
  StrategySignalSchema,
  BacktestConfigSchema,
  BacktestTradeSchema,
  EquityPointSchema,
  BacktestMetricsSchema,
  BacktestResultSchema,
  StrategyCategorySchema,
  StrategyTemplateSchema,
  StrategyFileSchema,
  StrategyRunStatusSchema,
} from './types.js'

export {
  STRATEGY_TEMPLATES,
  MA_CROSSOVER_TEMPLATE,
  RSI_MEAN_REVERSION_TEMPLATE,
  BREAKOUT_TEMPLATE,
  MACD_MOMENTUM_TEMPLATE,
  BOLLINGER_SQUEEZE_TEMPLATE,
  getStrategyTemplateById,
  getStrategyTemplatesByCategory,
} from './templates.js'

export type {
  MLFeatureType,
  NormalizationMethod,
  MLFeature,
  MLModelType,
  MLModelStatus,
  MLModelMetrics,
  MLModel,
  MLSignal,
  MLPrediction,
  FeatureSet,
  TrainingConfig,
  DriftMetric,
  DriftSeverity,
  DriftReport,
} from './ml-types.js'

export {
  MLFeatureTypeSchema,
  NormalizationMethodSchema,
  MLFeatureSchema,
  MLModelTypeSchema,
  MLModelStatusSchema,
  MLModelMetricsSchema,
  MLModelSchema,
  MLSignalSchema,
  MLPredictionSchema,
  FeatureSetSchema,
  TrainingConfigSchema,
  DriftMetricSchema,
  DriftSeveritySchema,
  DriftReportSchema,
  TREND_FEATURES,
  MOMENTUM_FEATURES,
  VOLATILITY_FEATURES,
  VOLUME_FEATURES,
  PREBUILT_FEATURE_SETS,
} from './ml-types.js'

// ── Visual Builder Types (Sprints 47-48) ────────────────────────────────────

export type {
  BlockPosition,
  BlockType,
  PortDirection,
  PortDataType,
  PortDefinition,
  ConditionVariant,
  ConditionConfig,
  ActionVariant,
  ActionConfig,
  IndicatorVariant,
  IndicatorConfig,
  LogicVariant,
  LogicConfig,
  StrategyBlock,
  BlockConnection,
  VisualStrategy,
  ValidationError,
} from './visual-builder-types.js'

export {
  BlockPositionSchema,
  BlockTypeSchema,
  PortDirectionSchema,
  PortDataTypeSchema,
  PortDefinitionSchema,
  ConditionVariantSchema,
  ConditionConfigSchema,
  ActionVariantSchema,
  ActionConfigSchema,
  IndicatorVariantSchema,
  IndicatorConfigSchema,
  LogicVariantSchema,
  LogicConfigSchema,
  StrategyBlockSchema,
  BlockConnectionSchema,
  VisualStrategySchema,
  getDefaultPorts,
  BLOCK_LABELS,
  BLOCK_TYPE_COLORS,
  validateStrategy,
  compileToTypeScript,
} from './visual-builder-types.js'

// ── Python Strategy Types (Sprints 47-48) ───────────────────────────────────

export type {
  AllowedPythonPackage,
  PythonRuntimeConfig,
  PythonStrategyConfig,
  PythonBarAPI,
  PythonIndicatorsAPI,
  PythonContextAPI,
  PythonTradingAPI,
} from './python-types.js'

export {
  ALLOWED_PYTHON_PACKAGES,
  AllowedPythonPackageSchema,
  PythonRuntimeConfigSchema,
  PythonStrategyConfigSchema,
  PYTHON_MA_CROSSOVER_TEMPLATE,
  PYTHON_RSI_STRATEGY_TEMPLATE,
  PYTHON_API_STUB,
} from './python-types.js'
