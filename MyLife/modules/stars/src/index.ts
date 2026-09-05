// Definition
export { STARS_MODULE } from './definition';

// Types and schemas
export type {
  ZodiacSign,
  ZodiacElement,
  MoonPhase,
  Aspect,
  TarotCard,
  TarotSuit,
  TarotArcana,
  TarotSpreadType,
  TarotSpreadPosition,
  TarotSpreadDefinition,
  BirthProfile,
  CreateBirthProfileInput,
  UpdateBirthProfileInput,
  Transit,
  CreateTransitInput,
  DailyReading,
  CreateDailyReadingInput,
  TarotReadingCard,
  TarotReading,
  CreateTarotReadingInput,
  SavedChart,
  CompatibilityResult,
  StarsStats,
} from './types';

export {
  ZodiacSignSchema,
  ZodiacElementSchema,
  MoonPhaseSchema,
  AspectSchema,
  TarotCardSchema,
  TarotSuitSchema,
  TarotArcanaSchema,
  TarotSpreadTypeSchema,
  TarotSpreadPositionSchema,
  TarotSpreadDefinitionSchema,
  BirthProfileSchema,
  CreateBirthProfileInputSchema,
  UpdateBirthProfileInputSchema,
  TransitSchema,
  CreateTransitInputSchema,
  DailyReadingSchema,
  CreateDailyReadingInputSchema,
  TarotReadingCardSchema,
  TarotReadingSchema,
  CreateTarotReadingInputSchema,
  SavedChartSchema,
  CompatibilityResultSchema,
  StarsStatsSchema,
} from './types';

// V1 CRUD
export {
  createBirthProfile,
  getBirthProfile,
  getBirthProfiles,
  updateBirthProfile,
  deleteBirthProfile,
  createTransit,
  getTransitsByProfile,
  getTransitsByDate,
  createDailyReading,
  saveDailyReading,
  getDailyReading,
  getDailyReadings,
  deleteDailyReading,
  saveTarotReading,
  getTarotReading,
  getTarotReadings,
  updateTarotReadingNotes,
  deleteTarotReading,
  deleteReading,
  createSavedChart,
  getSavedChartsByProfile,
  getStarsStats,
  // V2 CRUD
  cacheMoonCalendarDay,
  getMoonCalendarMonth,
  saveCompatibilityResult,
  getCompatibilityResult,
  getRecentCompatibilityResults,
  cacheZodiacEvent,
  getZodiacEvents,
  saveTransitEvent,
  getTransitEventsByProfile,
  createJournalEntry,
  getJournalEntries,
  getJournalEntry,
  searchJournalEntries,
  deleteJournalEntry,
  getJournalEntryCount,
  saveSolarReturn,
  getSolarReturn,
  saveProgressedChart,
  getProgressedChart,
} from './db/crud';

export type { JournalEntryRow } from './db/crud';

// V1 Engine
export {
  getMoonPhase,
  getMoonSign,
  getZodiacSign,
  getZodiacElement,
  calculateCompatibility,
  getTarotCardOfDay,
  getSkyPositions,
} from './engine/astro';
export type { SkyPosition } from './engine/astro';

// V2 Engines
export {
  computeMoonCalendarMonth,
  computeIllumination,
  getKeyPhasesForMonth,
  getNextMoonPhase,
  getNextNewMoon,
  getNextFullMoon,
} from './engine/lunar';
export type { MoonCalendarDay } from './engine/lunar';

export { computeQuickMatch, canonicalPair } from './engine/compatibility';
export type { CompatibilityAnalysis } from './engine/compatibility';

export {
  computeSunIngresses,
  getEventsForRange,
  computeZodiacEvents,
  filterEventsByCategory,
  getEventPersonalImpact,
} from './engine/zodiac-events';
export type {
  ZodiacEvent,
  EventType,
  EventCategory,
  ZodiacEventPersonalImpact,
} from './engine/zodiac-events';

export { detectTransitsForDate, classifySignificance, filterBySignificance } from './engine/transits';
export type { TransitEvent, TransitSignificance, AspectType } from './engine/transits';

export {
  computeRetrogradeStatuses,
  computeRetrogradeBanner,
  getActiveRetrogrades,
  getUpcomingRetrogrades,
  getRetrogradeTips,
  getRetrogradePeriodsInRange,
  getYearRetrogrades,
  getRetrogradePersonalImpact,
} from './engine/retrograde';
export type {
  RetrogradeStatus,
  RetrogradeBanner,
  BannerColor,
  RetrogradePeriod,
  RetrogradePersonalImpact,
} from './engine/retrograde';

export { captureAstrologicalContext, isValidMood, validateJournalContent, detectPatterns } from './engine/journal';
export type { AstrologicalContext, JournalPattern } from './engine/journal';

export { computeSolarReturn, computeSolarReturnRange } from './engine/solar-return';
export type { SolarReturnResult } from './engine/solar-return';

export { computeProgressedChart, computeProgressedDate, computeAgeInYears, forecastMoonSignChange } from './engine/progressions';
export type { ProgressedChartResult } from './engine/progressions';

// Interpretations
export {
  MOON_PHASE_INTERPRETATIONS,
  MOON_SIGN_INTERPRETATIONS,
  RETROGRADE_TIPS,
  RETROGRADE_INTERPRETATIONS,
  JOURNAL_MOODS,
  JOURNAL_INTENTIONS,
  getJournalPrompts,
} from './engine/interpretations';
export type { Planet, JournalMood, JournalIntention, JournalPromptContext } from './engine/interpretations';

// Tarot data
export {
  TAROT_DECK,
  TAROT_DECK_BY_ID,
  TAROT_DECK_BY_NAME,
  getTarotCardById,
  getTarotCardByName,
  hashTarotSeed,
  drawRandomCard,
  drawRandomCards,
  getDeterministicTarotOrientation,
} from './data/tarot-deck';
export {
  TAROT_SPREADS,
  TAROT_SPREADS_BY_TYPE,
  getTarotSpreadDefinition,
} from './data/tarot-spreads';

// UI barrel: `./ui/index.ts` has web-safe tokens only; full RN component
// surface lives in `./ui/index.native.ts` which Metro picks on mobile.
export * from './ui';
