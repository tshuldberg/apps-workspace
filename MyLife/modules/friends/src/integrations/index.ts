// ── Cross-Module Integrations Barrel ────────────────────────────────

// Types
export type {
  ModuleIntegration,
  IntegrationActivity,
  HangoutSuggestion,
} from './types';

// Base helpers
export { isModuleEnabled, createIntegration } from './base';

// P7-A: Dining + RSVP + Trails
export { diningIntegration, getSharedMeals } from './dining-link';
export { rsvpIntegration, getSharedEvents } from './rsvp-link';
export { trailsIntegration, getSharedAdventures } from './trails-link';

// P7-B: Mood + Journal + Budget
export {
  calculateSocialMoodCorrelation,
  type SocialMoodCorrelation,
} from './mood-link';
export { getJournalDeepLink, getJournalContext } from './journal-link';
export { getGiftSpendingSummary, type GiftSpendingSummary } from './budget-link';

// P7-C: Workouts + Gaming + Music
export { workoutsIntegration, getWorkoutPartnerStats } from './workouts-link';
export { gamingIntegration, getGamingBuddyStats } from './gaming-link';
export { musicIntegration, getConcertCompanions } from './music-link';

// P8-B: Shop deep links
export { linkPersonToShop } from './shop-link';
