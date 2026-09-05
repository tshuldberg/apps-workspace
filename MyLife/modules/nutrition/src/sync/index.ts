export {
  calculateBMR,
  applyActivityMultiplier,
  getUserProfile,
  hasUserProfile,
  upsertEnergyLog,
  getEnergyLog,
  deleteEnergyLog,
  getNetCalories,
  getEnergyBalance,
  getWeeklyEnergyBalance,
  calculateAndStoreExpenditure,
  readActiveCaloriesFromHealth,
} from './energy-balance';

export {
  isSyncEnabled,
  getSyncDirection,
  syncEnergyForDate,
  getDietaryCaloriesForWriteBack,
} from './healthkit';

export type {
  EnergySource,
  ActivityLevel,
  UserSex,
  EnergyLogEntry,
  UserProfile,
  EnergyBalance,
  DailyEnergyBreakdown,
} from './types';

export { ACTIVITY_MULTIPLIERS, DEFAULT_USER_PROFILE } from './types';
