// ── Module Definition ────────────────────────────────────────────────
export { FRIENDS_MODULE } from './definition';

// ── Schema ──────────────────────────────────────────────────────────
export { INIT_TABLES, INIT_INDEXES } from './db';

// ── Types ───────────────────────────────────────────────────────────
export type {
  Person,
  Circle,
  Hangout,
  Gift,
  GiftIdea,
  Memory,
  LifeEvent,
  Nudge,
  Photo,
} from './types';

// ── People Schemas ─────────────────────────────────────────────────
export {
  RelationshipType,
  EnergyTag,
  CommunicationPreference,
  PersonSort,
  PersonInputSchema,
  PersonUpdateSchema,
  PersonFilterSchema,
} from './models/schemas';
export type {
  PersonInput,
  PersonUpdate,
  PersonFilter,
  PersonRow,
  PersonRecord,
} from './models/schemas';

// ── People CRUD ────────────────────────────────────────────────────
export {
  createPerson,
  getPerson,
  updatePerson,
  deletePerson,
  archivePerson,
  unarchivePerson,
  listPeople,
  searchPeople,
} from './db/crud/people';

// ── Circle Schemas ──────────────────────────────────────────────────
export { CircleInputSchema, CircleUpdateSchema } from './models/circle-schemas';
export type { CircleRow, CircleRecord } from './models/circle-schemas';
export type { CircleInput, CircleUpdate } from './db/crud/circles';

// ── Circle CRUD ─────────────────────────────────────────────────────
export {
  createCircle,
  getCircle,
  updateCircle,
  deleteCircle,
  listCircles,
  addMember,
  removeMember,
  getCirclesForPerson,
  removePersonFromAllCircles,
} from './db/crud/circles';

// ── Hangout Schemas ────────────────────────────────────────────────
export {
  ActivityTag,
  QualityRating,
  HangoutInputSchema,
  HangoutUpdateSchema,
  HangoutFilterSchema,
} from './models/hangout-schemas';
export type {
  HangoutInput,
  HangoutUpdate,
  HangoutFilter,
  HangoutRow,
  HangoutRecord,
} from './models/hangout-schemas';

// ── Hangout CRUD ───────────────────────────────────────────────────
export {
  createHangout,
  getHangout,
  updateHangout,
  deleteHangout,
  listHangouts,
  listHangoutsForPerson,
  getLastHangoutDate,
} from './db/crud/hangouts';

// ── Gift Schemas ──────────────────────────────────────────────────
export {
  GiftDirection,
  GiftOccasion,
  GiftInputSchema,
  GiftIdeaInputSchema,
  GiftIdeaUpdateSchema,
} from './models/gift-schemas';
export type {
  GiftInput,
  GiftIdeaInput,
  GiftIdeaUpdate,
  GiftRow,
  GiftRecord,
  GiftIdeaRow,
  GiftIdeaRecord,
} from './models/gift-schemas';

// ── Gift CRUD ─────────────────────────────────────────────────────
export {
  createGift,
  getGift,
  deleteGift,
  listGiftsForPerson,
  listGiftsByOccasion,
  getGiftSpendingForPerson,
} from './db/crud/gifts';

// ── Gift Idea CRUD ────────────────────────────────────────────────
export {
  createIdea,
  getIdea,
  updateIdea,
  deleteIdea,
  listIdeasForPerson,
  markPurchased,
} from './db/crud/gift-ideas';

// ── Memory Schemas ───────────────────────────────────────────────
export {
  MemoryInputSchema,
  MemoryUpdateSchema,
  MemoryFilterSchema,
} from './models/memory-schemas';
export type {
  MemoryInput,
  MemoryUpdate,
  MemoryFilter,
  MemoryRow,
  MemoryRecord,
} from './models/memory-schemas';

// ── Memory CRUD ──────────────────────────────────────────────────
export {
  createMemory,
  getMemory,
  updateMemory,
  deleteMemory,
  listMemories,
  listMemoriesForPerson,
  getInsideJokes,
  getMemoryAnniversaries,
} from './db/crud/memories';

// ── Journal Schemas ───────────────────────────────────────────────
export { JournalType, JournalEntryInputSchema } from './models/journal-schemas';
export type {
  JournalEntryInput,
  JournalEntryRow,
  JournalEntryRecord,
  JournalCountByType,
} from './models/journal-schemas';

// ── Journal CRUD ──────────────────────────────────────────────────
export {
  createJournalEntry,
  listJournalForPerson,
  deleteJournalEntry,
  countJournalByType,
} from './db/crud/journal';

// ── Frequency Engine ───────────────────────────────────────────────
export {
  calculateDaysSinceLastSeen,
  getFrequencyStatus,
  generateLastSeenLabel,
  getFrequencyColor,
  getOverduePeople,
  getApproachingPeople,
} from './engine';
export type { FrequencyStatus } from './engine';

// ── Birthday Engine ───────────────────────────────────────────────
export {
  getDaysUntilBirthday,
  getAge,
  getTurningAge,
  getUpcomingBirthdays,
  getFriendshipAnniversaries,
  shouldTriggerReminder,
  getBirthdayMonth,
  generateDaysUntilLabel,
  formatBirthdayDate,
} from './engine';
export type {
  BirthdayPersonInput,
  UpcomingBirthday,
  AnniversaryPersonInput,
  UpcomingAnniversary,
} from './engine';

// ── Nudge Engine ─────────────────────────────────────────────────
export {
  detectDrift,
  shouldNudge,
  generateDriftMessage,
  getNudgeUrgency,
} from './engine';
export type {
  DriftInfo,
  NudgeSettings,
  NudgeType,
  NudgeUrgency,
  PendingNudge,
} from './engine';

// ── Nudge CRUD ───────────────────────────────────────────────────
export {
  createNudge,
  getNudge,
  dismissNudge,
  snoozeNudge,
  actOnNudge,
  listActiveNudges,
  listNudgesForPerson,
  cleanupOldNudges,
} from './db/crud/nudges';
export type { NudgeRow, NudgeRecord, NudgeInput } from './db/crud/nudges';

// ── Timeline Engine ──────────────────────────────────────────────
export {
  buildPersonTimeline,
  detectMilestones,
  getYearGroup,
  formatTimelineDate,
  getTypeColor,
} from './engine';
export type {
  TimelineEntryType,
  TimelineEntry,
  Milestone,
} from './engine';

// ── Social Energy Engine ─────────────────────────────────────────
export {
  getWeekStart,
  calculateWeeklySocialTime,
  generateWeeklySummary,
  getAverageWeeklySocialHours,
  getSocialPattern,
  detectOverSocializing,
  detectUnderSocializing,
  generatePatternInsight,
} from './engine';
export type {
  WeeklySummary,
  SocialPattern,
} from './engine';

// ── Quality Analysis Engine ─────────────────────────────────────
export {
  getTimeDistribution,
  getQualityCorrelation,
  getInnerCircle,
  getTimeVsQualityQuadrant,
  getEnergyCorrelation,
} from './engine';
export type {
  PersonTimeShare,
  QualityCorrelation,
  TimeQualityQuadrant,
  EnergyBreakdown,
} from './engine';

// ── Life Event Schemas ────────────────────────────────────────────
export {
  LifeEventType,
  LifeEventInputSchema,
} from './models/life-event-schemas';
export type {
  LifeEventInput,
  LifeEventRow,
  LifeEventRecord,
} from './models/life-event-schemas';

// ── Life Event CRUD ──────────────────────────────────────────────
export {
  createLifeEvent,
  getLifeEvent,
  listEventsForPerson,
  acknowledgeEvent,
  deleteLifeEvent,
  listRecentEvents,
  getPeopleByCities,
} from './db/crud/life-events';

// ── Life Chapters Engine ─────────────────────────────────────────
export {
  getResponseSuggestion,
  getCityGroups,
  formatLifeEventLabel,
  getLifeEventIcon,
} from './engine';

// ── Group Dynamics Engine ────────────────────────────────────────
export {
  getGroupActivity,
  getCompatibilityPairs,
  detectTraditions,
  detectIntroductions,
} from './engine';
export type {
  GroupActivitySummary,
  CompatibilityPair,
  GroupTradition,
  Introduction,
} from './engine';

// ── Settings CRUD ─────────────────────────────────────────────────
export {
  getSetting,
  setSetting,
  getSettings,
  deleteSetting,
} from './db/crud/settings';
export type { FriendsSettingKey } from './db/crud/settings';

// ── Security & Privacy ────────────────────────────────────────────
export {
  cascadeDeletePerson,
  exportAllData,
  exportCSV,
  getDataStats,
  deleteAllData,
} from './security';
export type {
  CascadeDeleteResult,
  DataStats,
  FriendsExport,
} from './security';

// ── Cross-Module Integrations ──────────────────────────────────────
export {
  // Base
  isModuleEnabled,
  createIntegration,
  // P7-A: Dining + RSVP + Trails
  diningIntegration,
  getSharedMeals,
  rsvpIntegration,
  getSharedEvents,
  trailsIntegration,
  getSharedAdventures,
  // P7-B: Mood + Journal + Budget
  calculateSocialMoodCorrelation,
  getJournalDeepLink,
  getJournalContext,
  getGiftSpendingSummary,
  // P7-C: Workouts + Gaming + Music
  workoutsIntegration,
  getWorkoutPartnerStats,
  gamingIntegration,
  getGamingBuddyStats,
  musicIntegration,
  getConcertCompanions,
} from './integrations';
export type {
  ModuleIntegration,
  IntegrationActivity,
  HangoutSuggestion,
  SocialMoodCorrelation,
  GiftSpendingSummary,
} from './integrations';
