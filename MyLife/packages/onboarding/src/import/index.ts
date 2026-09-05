export type {
  ImportPhase,
  ImportProgress,
  ImportValidationError,
  ImportResult,
  FormatDetection,
  ParsedRecord,
  ImportAdapter,
} from './types';

export {
  registerAdapter,
  getAdaptersForModule,
  getAdapterByName,
  getAllAdapters,
  detectAdapter,
  clearRegistry,
} from './registry';
export type { DetectionResult } from './registry';

export { goodreadsAdapter } from './adapters/goodreads';
export type { GoodreadsSourceRecord, GoodreadsTargetRecord } from './adapters/goodreads';

export { dayOneAdapter } from './adapters/dayone';
export type { DayOneSourceRecord, JournalImportRecord } from './adapters/dayone';

export { ynabCsvAdapter } from './adapters/ynab';
export { parseYnabAmount, parseYnabDate } from './adapters/ynab';
export type { YnabTransactionRecord, BudgetImportRecord } from './adapters/ynab';

export { myFitnessPalAdapter } from './adapters/myfitnesspal';
export { parseMfpNumber, normalizeMealType, isValidDate } from './adapters/myfitnesspal';
export type { MfpFoodRecord, NutritionImportRecord } from './adapters/myfitnesspal';
