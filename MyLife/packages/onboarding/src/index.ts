// @mylife/onboarding -- "Replace My Apps" import system + onboarding state machine

export type {
  ImportPhase,
  ImportProgress,
  ImportValidationError,
  ImportResult,
  FormatDetection,
  ParsedRecord,
  ImportAdapter,
  DetectionResult,
} from './import';

export {
  registerAdapter,
  getAdaptersForModule,
  getAdapterByName,
  getAllAdapters,
  detectAdapter,
  clearRegistry,
  goodreadsAdapter,
  dayOneAdapter,
  ynabCsvAdapter,
  myFitnessPalAdapter,
} from './import';
export type { GoodreadsSourceRecord, GoodreadsTargetRecord } from './import';
export type { DayOneSourceRecord, JournalImportRecord } from './import';
export type { YnabTransactionRecord, BudgetImportRecord } from './import';
export type { MfpFoodRecord, NutritionImportRecord } from './import';

// Onboarding state machine
export type { OnboardingStep, OnboardingState, OnboardingStore } from './state-machine';
export {
  ONBOARDING_STEPS,
  DEFAULT_FREE_MODULES,
  OnboardingMachine,
  InMemoryOnboardingStore,
  SqliteOnboardingStore,
} from './state-machine';
