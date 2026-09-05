/**
 * @mylife/intelligence -- Cross-module analytics, correlation, AI permission,
 * query engine, and optional LLM integration.
 *
 * Provides:
 * 1. Statistical correlation tools (Pearson coefficient, before/after analysis)
 * 2. AI permission system (two-tier: per-module toggle + per-table granular)
 * 3. Cross-module query engine (correlation, trends, summary, insight discovery)
 * 4. Optional LLM integration (user-provided API key, explicit consent required)
 *
 * AI permissions default to ALL OFF. Users must explicitly opt in.
 * The query engine respects permissions: unpermitted modules are invisible.
 * LLM insights are ADDITIVE to on-device analytics, not a replacement.
 * Data leaves the device ONLY with explicit user consent.
 */

// Analytics
export {
  getMoodMedicationCorrelation,
  getSymptomMedicationCorrelation,
  getAdherenceMoodCorrelation,
  getOverallWellnessTimeline,
} from './analytics';
export type {
  MoodMedicationCorrelation,
  SymptomMedicationCorrelation,
  SymptomCorrelationItem,
  AdherenceMoodCorrelation,
  WellnessTimelineEntry,
} from './analytics';

// AI Permissions
export {
  AI_PERMISSION_TABLES,
  CREATE_HUB_AI_CONFIG,
  ensureAIPermissionTables,
  setPermissions,
  getPermissions,
  getAllPermissions,
  setGranularMode,
  setTablePermission,
  getTablePermissions,
  removePermissions,
  getPermittedModules,
  getPermittedTables,
  isAllowed,
  AIPermissionSchema,
  AITablePermissionSchema,
  DEFAULT_USER_ID,
} from './permissions';
export type {
  AIPermission,
  AITablePermission,
  PermissionMode,
  SetPermissionsInput,
  SetTablePermissionInput,
} from './permissions';

// Query Engine
export {
  pearson,
  queryCorrelation,
  queryTrends,
  querySummary,
  discoverInsights,
  MIN_CORRELATION_POINTS,
  CORRELATION_THRESHOLD,
} from './engine';
export type {
  CorrelationResult,
  TrendResult,
  TrendPoint,
  SummaryResult,
  InsightCard,
} from './engine';

// LLM Integration (optional, user-provided API key)
export {
  getLLMConfig,
  setLLMConfig,
  clearLLMConfig,
  isLLMConfigured,
  buildPrompt,
  queryLLM,
  parseLLMResponse,
  DEFAULT_MODELS,
  DEFAULT_MAX_TOKENS,
} from './llm';
export type {
  LLMProvider,
  LLMConfig,
  LLMInsight,
  LLMQueryOptions,
  LLMQueryResult,
  LLMFetchFn,
  LLMReasoningEffort,
  LLMVerbosity,
} from './llm';
