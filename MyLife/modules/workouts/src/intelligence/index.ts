export {
  generateWorkoutInsights,
  detectMoodLiftCorrelation,
  detectFastingPerformance,
  detectProteinRecovery,
  detectConsistencyMomentum,
  detectTimeOfDayPerformance,
  detectVolumeMoodFeedback,
} from './insight';

export {
  getWorkoutDays,
  getMoodDays,
  getNutritionDays,
  getFastingDays,
} from './data-bridge';

export type {
  WorkoutInsight,
  WorkoutInsightType,
  WorkoutInsightSeverity,
  DayWorkoutData,
  DayMoodData,
  DayNutritionData,
  DayFastingData,
  InsightInput,
} from './types';

export { MIN_DAYS_INTERNAL, MIN_DAYS_CROSS_MODULE } from './types';
