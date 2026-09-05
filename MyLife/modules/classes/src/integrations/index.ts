// P9 cross-module integration bridges. Pure TS, no React, no DB.

export {
  aggregateStudyTopics,
  buildClassDeckSeed,
  type FlashDeckSeed,
} from './flash-bridge';

export {
  aggregateClassNotePrompts,
  buildClassNoteContext,
  type ClassNoteContext,
  type SuggestedNotePrompt,
} from './notes-bridge';

export {
  suggestClassHabits,
  summarizeStudyStreak,
  type HabitFrequency,
  type SuggestedHabit,
} from './habits-bridge';

export {
  correlateMoodWithEvents,
  getAcademicEventsInRange,
  summarizeAcademicMoodInsight,
  type AcademicEvent,
  type AcademicEventKind,
  type MoodEntryLike,
  type MoodEventCorrelation,
} from './mood-bridge';

export {
  costPerCreditHour,
  extractEducationExpenses,
  suggestEducationBudget,
  type CostPerCreditEntry,
  type CostPerCreditResult,
  type EducationBudgetSuggestion,
  type EducationCategory,
  type EducationExpense,
} from './budget-bridge';

export {
  buildLanguageCourseLink,
  type LanguageCourseLink,
} from './words-bridge';

export {
  buildAcademicReflectionPrompts,
  type AcademicReflectionPrompt,
} from './journal-bridge';

export {
  buildIcsEvents,
  type IcsEvent,
  type ScheduleBlock,
} from './calendar-bridge';
