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
} from './people';

// ── Circle CRUD ────────────────────────────────────────────────────
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
} from './circles';

// ── Hangout CRUD ───────────────────────────────────────────────────
export {
  createHangout,
  getHangout,
  updateHangout,
  deleteHangout,
  listHangouts,
  listHangoutsForPerson,
  getLastHangoutDate,
} from './hangouts';

// ── Gift CRUD ──────────────────────────────────────────────────────
export {
  createGift,
  getGift,
  deleteGift,
  listGiftsForPerson,
  listGiftsByOccasion,
  getGiftSpendingForPerson,
} from './gifts';

// ── Gift Idea CRUD ────────────────────────────────────────────────
export {
  createIdea,
  getIdea,
  updateIdea,
  deleteIdea,
  listIdeasForPerson,
  markPurchased,
} from './gift-ideas';

// ── Journal CRUD ──────────────────────────────────────────────────
export {
  createJournalEntry,
  listJournalForPerson,
  deleteJournalEntry,
  countJournalByType,
} from './journal';

// ── Nudge CRUD ────────────────────────────────────────────────────
export {
  createNudge,
  getNudge,
  dismissNudge,
  snoozeNudge,
  actOnNudge,
  listActiveNudges,
  listNudgesForPerson,
  cleanupOldNudges,
} from './nudges';
export type { NudgeRow, NudgeRecord, NudgeInput } from './nudges';
