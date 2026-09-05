// Definition
export { CYCLE_MODULE } from './definition';

// Types and schemas
export type {
  CyclePhase,
  FlowLevel,
  SymptomCategory,
  SymptomIntensity,
  Cycle,
  CycleDay,
  Symptom,
  CreateCycleInput,
  CreateCycleDayInput,
  CreateCycleDayRawInput,
  UpdateCycleDayInput,
  CycleStats,
  CyclePrediction,
  Temperature,
  TemperatureMethod,
  TemperatureUnit,
  CreateTemperatureInput,
  CreateTemperatureRawInput,
  CoverlineResult,
  PregnancyStatus,
  PregnancyStartMethod,
  PregnancyConfig,
  CreatePregnancyInput,
  Appointment,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  PregnancyWeekInfo,
  PartnerLinkStatus,
  PartnerLink,
  CreatePartnerLinkInput,
  CreatePartnerLinkRawInput,
  UpdatePartnerLinkInput,
  SharedCycleView,
} from './types';

export {
  CyclePhaseSchema,
  FlowLevelSchema,
  SymptomCategorySchema,
  SymptomIntensitySchema,
  CycleSchema,
  CycleDaySchema,
  SymptomSchema,
  CreateCycleInputSchema,
  CreateCycleDayInputSchema,
  UpdateCycleDayInputSchema,
  CycleStatsSchema,
  CyclePredictionSchema,
  TemperatureMethodSchema,
  TemperatureUnitSchema,
  TemperatureSchema,
  CreateTemperatureInputSchema,
  PHYSICAL_SYMPTOMS,
  MOOD_SYMPTOMS,
  PregnancyStatusSchema,
  PregnancyStartMethodSchema,
  PregnancyConfigSchema,
  CreatePregnancyInputSchema,
  AppointmentSchema,
  CreateAppointmentInputSchema,
  UpdateAppointmentInputSchema,
  PregnancyWeekInfoSchema,
  PREGNANCY_PHYSICAL_SYMPTOMS,
  PREGNANCY_MOOD_SYMPTOMS,
  PartnerLinkStatusSchema,
  PartnerLinkSchema,
  CreatePartnerLinkInputSchema,
  UpdatePartnerLinkInputSchema,
  SharedCycleViewSchema,
} from './types';

// CRUD
export {
  createCycle,
  getCycle,
  getCycles,
  endCycle,
  deleteCycle,
  createCycleDay,
  getCycleDaysByDate,
  getCycleDaysByCycle,
  getCycleDayByDate,
  updateCycleDay,
  deleteCycleDay,
  getSymptomsForDay,
  addSymptom,
  deleteSymptom,
  getCycleStats,
  getSymptomFrequencies,
  getCycleCount,
  createTemperature,
  getTemperatureByDate,
  getTemperaturesByCycleDays,
  getTemperaturesByDateRange,
  updateTemperature,
  upsertTemperature,
  deleteTemperature,
  createPregnancyConfig,
  getActivePregnancy,
  getPregnancyConfig,
  getPregnancyHistory,
  endPregnancy,
  updateDueDate,
  createAppointment,
  getAppointmentsByPregnancy,
  getUpcomingAppointments,
  updateAppointment,
  completeAppointment,
  deleteAppointment,
  createPartnerLink,
  getActivePartnerLink,
  getPartnerLinkByCode,
  updatePartnerLink,
  revokePartnerLink,
} from './db/crud';

// Engine - Prediction
export {
  calculateAverageCycleLength,
  calculateAveragePeriodLength,
  predictNextPeriod,
  getCurrentPhase,
  isLateByDays,
} from './engine/prediction';

// Engine - Temperature
export {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  calculateCoverline,
  detectTemperatureShift,
  analyzeTemperatures,
} from './engine/temperature';

// Engine - Pregnancy
export {
  calculateDueDateFromLMP,
  calculateDueDateFromConception,
  calculateDueDateFromTransfer,
  calculateDueDate,
  getLMPFromDueDate,
  getCurrentWeek,
  getCurrentTrimester,
  getDaysUntilDue,
  getPregnancyWeekInfo,
  isPastDue,
  formatWeekDisplay,
} from './engine/pregnancy';

// Engine - Sharing
export {
  generateShareCode,
  generateSharedView,
  validateSnapshot,
  isSnapshotStale,
} from './engine/sharing';

// Engine - Insights
export type {
  SymptomPhaseEntry,
  SymptomPhasePattern,
  CycleTrendDirection,
  CycleTrend,
  CycleInsight,
  PhaseSignal,
} from './engine/insights';

export {
  analyzeSymptomsByPhase,
  detectCycleTrend,
  generateCycleInsights,
  getPhaseSignal,
} from './engine/insights';

// Data
export { PREGNANCY_WEEK_DATA } from './data/pregnancy-weeks';

// UI tokens, typography, and shared components (Obsidian Noir redesign).
// `./ui/index.ts` exports only web-safe design tokens; the full RN component
// surface lives in `./ui/index.native.ts` which Metro picks on mobile. Web
// bundlers ignore `.native.ts` and see tokens only.
// See modules/budget/src/index.ts for the documented pattern.
export * from './ui';
