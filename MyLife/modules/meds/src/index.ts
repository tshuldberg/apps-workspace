export { MEDS_MODULE } from './definition';
export * from './ui/typography';
export * from './ui/tokens';

// Cross-module interface
export { medsCrossModule } from './cross-module';

// Re-export all models
export * from './models';

// Re-export legacy CRUD operations (backward compat)
export {
  createMedication,
  getMedications,
  getMedicationById,
  updateMedication,
  deleteMedication,
  countMedications,
  recordDose,
  getDoses,
  getDosesForDate,
  deleteDose,
  getAdherenceRate,
  getSetting,
  setSetting,
} from './db';

// Re-export migration for external use
export { MEDS_MIGRATION_V2 } from './db/migrations';

// Extended medication CRUD + refill tracking
export {
  createMedicationExtended,
  getMedicationExtended,
  getActiveMedications,
  updatePillCount,
  decrementPillCount,
  recordRefill,
  getRefillHistory,
  calculateBurnRate,
  getDaysRemaining,
  getLowSupplyAlerts,
} from './medication';
export type { LowSupplyAlert } from './medication';

// Reminders, dose logging, and adherence engine
export {
  createRemindersForMedication,
  getActiveReminders,
  snoozeReminder,
  dismissReminder,
  getRemindersForMedication,
  logDose,
  getDoseLogsForDate,
  getDoseLogsForMedication,
  undoDoseLog,
  getAdherenceRate as getAdherenceRateV2,
  getStreak,
  getAdherenceStats,
  getAdherenceByDay,
  getAdherenceCalendar,
} from './reminders';
export type { AdherenceStats, DayStatus, DayAdherence, MedDayStatus, CalendarDay } from './reminders';

// Drug interaction checker
export {
  seedAdditionalInteractions,
  checkInteractions,
  getInteractionsForMedication,
  ADDITIONAL_INTERACTIONS,
} from './interactions';
export type { BundledInteraction } from './interactions';

// Medication diary
export {
  createDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
  getDiaryEntryById,
  getDiaryEntries,
  getDiaryInsights,
} from './diary';
export type {
  DiaryEntry,
  CreateDiaryEntryInput,
  UpdateDiaryEntryInput,
  DiaryEntryDetail,
  DiaryInsights,
} from './models/diary';

// Health measurements
export {
  logMeasurement,
  getMeasurements,
  getMeasurementById,
  updateMeasurement,
  deleteMeasurement,
  getMeasurementTrend,
  getMeasurementTrendWithMedMarkers,
} from './measurements';

// Mood, activities, symptoms, and calendar
export {
  MOOD_VOCABULARY,
  MOOD_VOCABULARY_SIMPLIFIED,
  DEFAULT_ACTIVITIES,
  HIGH_ENERGY_PLEASANT,
  HIGH_ENERGY_UNPLEASANT,
  LOW_ENERGY_PLEASANT,
  LOW_ENERGY_UNPLEASANT,
  moodColor,
  createMoodEntry,
  getMoodEntries,
  getMoodEntryById,
  deleteMoodEntry,
  getMoodEntriesForDate,
  addActivity,
  getActivities,
  getMoodActivities,
  linkActivitiesToMood,
  removeActivity,
  getDailyMoodSummary,
  getMoodScore,
  getMoodTrends,
  getMoodCorrelations,
  seedPredefinedSymptoms,
  getSymptoms,
  createCustomSymptom,
  logSymptom,
  getSymptomLogs,
  getSymptomLogsForSymptom,
  getMoodCalendar,
  getMoodCalendarMonth,
  getDayDetail,
} from './mood';
export type {
  MoodQuadrant,
  MoodTrendDay,
  MoodDayOfWeekAverage,
  MoodTrends,
  MoodActivityCorrelation,
  MoodMedicationImpact,
  MoodCorrelations,
} from './mood';

// Analytics and correlation engine
export {
  getMoodMedicationCorrelation,
  getSymptomMedicationCorrelation,
  getAdherenceMoodCorrelation,
  getOverallWellnessTimeline,
  getOverallStats,
} from './analytics';
export type {
  MoodMedicationCorrelation,
  SymptomMedicationCorrelation,
  SymptomCorrelationItem,
  AdherenceMoodCorrelation,
  WellnessTimelineEntry,
  MedicationSummary,
  OverallStats,
} from './analytics';

// Export reports (doctor + therapy markdown)
export { generateDoctorReport, generateTherapyReport } from './export';

// Blood pressure tracking
export {
  classifyBP,
  validateBP,
  calculateBPAverages,
  getCategoryDistribution,
  parseLegacyBP,
  filterReadingsByPeriod,
} from './bp/engine';
export {
  logBPReading,
  getBPReadingById,
  getBPReadings,
  updateBPReading,
  deleteBPReading,
} from './db/bp';

// Blood glucose tracking
export {
  classifyGlucose,
  isInRange,
  convertGlucose,
  calculateTimeInRange,
  estimateA1c,
  calculateAverageGlucose,
  analyzeGlucosePatterns,
  parseLegacyGlucose,
} from './glucose/engine';
export {
  logGlucoseReading,
  getGlucoseReadingById,
  getGlucoseReadings,
  getLatestGlucoseReading,
  updateGlucoseReading,
  deleteGlucoseReading,
} from './db/glucose';
export { createA1cRecord, getA1cRecords } from './db/a1c';

// Insulin tracking
export {
  calculateIOB,
  getSuggestedSite,
  getSiteRecency,
  getDailyInsulinTotals,
  calculateDailyAverage,
} from './insulin/engine';
export {
  logInsulinEntry,
  getInsulinEntryById,
  getInsulinEntries,
  deleteInsulinEntry,
  getInjectionSites,
  getInjectionSiteByName,
} from './db/insulin';
export {
  createCGMReading,
  getCGMReadings,
  getCGMSyncState,
  upsertCGMSyncState,
} from './db/cgm';

// Caregiver alerts
export {
  generateAlertMessage,
  shouldFireAlert,
  generateWeeklySummary,
} from './caregiver/engine';
export {
  getCaregivers,
  createCaregiver,
  updateCaregiver,
  deleteCaregiver,
  getAlertConfig,
  updateAlertConfig,
  recordCaregiverAlert,
  getAlertHistory,
  getCaregiverAlertRows,
} from './caregiver/crud';
export type {
  CaregiverAlertHistoryItem,
  CaregiverRuleConfig,
  CaregiverRuleKey,
  CaregiverRulesState,
} from './caregiver/crud';

// BP trend visualization
export {
  getBPTrendData,
  getBPPeriodStats,
  calculateTrendDirection,
  comparePeriods,
  aggregateToWeekly,
} from './bp/trends';
export type {
  BPTrendPoint,
  BPPeriodStats,
  BPPeriodComparison,
} from './bp/trends';

// HbA1c calculator
export {
  getA1cConfidence,
  interpretA1c,
  calculateGMI as calculateGMIFromA1c,
} from './glucose/a1c';

// FODMAP tracking
export {
  classifyMealFODMAP,
  getFODMAPTypes,
  searchFODMAPFoods,
  calculateTriggerCorrelation,
  groupByFODMAPType,
} from './fodmap/engine';
export type { FODMAPTypes, TriggerCorrelation } from './fodmap/engine';
export {
  getFodmapFoods,
  searchFodmapFoods,
  createFoodDiaryEntry,
  getFoodDiary,
  deleteFoodDiaryEntry,
  createStoolLog,
  getStoolLogs,
  deleteStoolLog,
  getFodmapInsights,
} from './fodmap/records';
export type {
  FodmapInsights,
  FodmapLoadSummary,
  FodmapLoadTone,
  FodmapRecentSymptom,
  FodmapSafeFood,
} from './fodmap/records';

// Weather correlation
export {
  pearsonCorrelation,
  calculateWeatherCorrelation,
  identifyTriggerProfile,
  shouldShowForecastAlert,
} from './weather/engine';
export {
  getWeatherSnapshots,
  getCurrentWeather,
  getWeatherHistory,
  getWeatherSymptomLinks,
  createWeatherLink,
  getWeatherCorrelationPoints,
  getWeatherCorrelations,
  getTriggerAlerts,
  getWeatherTriggerInsights,
} from './weather/queries';
export type {
  WeatherFactorKey,
  WeatherCorrelationPoint,
  WeatherTriggerAlert,
  WeatherTriggerInsights,
} from './weather/queries';

// Pain location map
export {
  calculateHeatmap,
  getActiveZones,
  getAverageSeverityByZone,
  getPainMedicationCorrelation,
} from './pain/engine';
export type { PainMedicationCorrelation } from './pain/engine';
export {
  createPainEntry,
  getPainEntries,
  getPainByRegion,
  getPainInsights,
} from './pain/queries';
export type {
  PainRegionSummary,
  PainInsights,
} from './pain/queries';

// Intelligence engines
export {
  getMedicationInsights,
} from './engine/medication-insights';
export type {
  MedicationInsight,
  InsightCategory,
  InsightSeverity,
} from './engine/medication-insights';

export {
  getRegimenSummary,
} from './engine/regimen-summary';
export type {
  RegimenSummary,
  ScheduledDose,
  VitalsSnapshot,
  ActiveAlert,
} from './engine/regimen-summary';

export {
  getWellnessScore,
} from './engine/wellness-score';
export type {
  WellnessScore,
  ScoreComponent,
} from './engine/wellness-score';

// Healthcare contacts
export {
  createContact,
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
} from './contacts';

// Appointments
export {
  createAppointment,
  getAppointments,
  getAppointmentById,
  getUpcomingAppointments,
  getPastAppointments,
  updateAppointment,
  deleteAppointment,
} from './appointments';

// CGM integration
export {
  calculateGMI,
  calculateTrendArrow,
  calculateCV,
  calculateSD,
  calculateTIRBreakdown,
  calculateAGP,
  getCGMStats,
  deduplicateReadings,
} from './cgm/engine';

// Drug database stub (future: RxNorm/OpenFDA integration)
// TODO: Replace with real API integration per modules/meds/CLAUDE.md "Future: Drug Database"
export function searchDrugDatabase(_query: string): Array<{ name: string; rxcui: string }> {
  return [];
}
