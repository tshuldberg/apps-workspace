// Re-export correlation engine from shared @mylife/intelligence package
export {
  getMoodMedicationCorrelation,
  getSymptomMedicationCorrelation,
  getAdherenceMoodCorrelation,
  getOverallWellnessTimeline,
} from '@mylife/intelligence';
export type {
  MoodMedicationCorrelation,
  SymptomMedicationCorrelation,
  SymptomCorrelationItem,
  AdherenceMoodCorrelation,
  WellnessTimelineEntry,
} from '@mylife/intelligence';
