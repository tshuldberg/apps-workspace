// @mylife/fast — MyFast module

// Module definition
export { FAST_MODULE } from './definition';

// Types
export * from './types';

// Database CRUD operations
export * from './db/index';

// Timer state machine
export { computeTimerState, formatDuration } from './timer';

// Preset protocols & progression
export { PRESET_PROTOCOLS, PROTOCOL_PROGRESSION } from './protocols';
export { FASTING_ZONES, getCurrentFastingZone, getCurrentZoneProgress } from './zones';

// Stats (streaks, aggregation)
export * from './stats/index';

// CSV export
export { exportFastsCSV, exportWeightCSV } from './export';

// ── Engines ──

// HealthKit Sync
export {
  convertWeight,
  shouldImportWeight,
  mergeWeightEntries,
  calculateSyncWindow,
  formatFastForHealthKit,
  isHealthKitAvailable,
} from './engines/healthkit-sync';

// Smart Water Reminders
export {
  calculatePersonalizedTarget,
  calculateNextReminderTime,
  shouldSendReminder,
  generateReminderSlots,
} from './engines/water-reminder-engine';

// Apple Watch Sync
export {
  formatWatchState,
  handleWatchCommand,
  mapZoneToWatchColor,
} from './engines/watch-sync';

// Hydration Engine
export {
  calculateDailyHydration,
  hydrationToGlasses,
  meetsHydrationTarget,
  computeHydration,
} from './engines/hydration';

// Caffeine Engine
export {
  scaleCaffeine,
  calculateDailyCaffeine,
  remainingFromDose,
  calculateRemainingCaffeine,
  calculateClearByTime,
  getCaffeineStatus,
  hasLateCaffeine,
  buildCaffeineSummary,
} from './engines/caffeine-engine';

// Fast Quality Score
export { computeFastQualityScore } from './engines/quality-score';

// Protocol Progression
export { suggestNextProtocol } from './engines/protocol-progression';

// Week-in-Review
export { computeWeekInReview } from './engines/week-in-review';
export type { WeekInReviewInput } from './engines/week-in-review';
