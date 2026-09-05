export type EnergySource = 'manual' | 'healthkit' | 'calculated';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type UserSex = 'male' | 'female';

export interface EnergyLogEntry {
  id: string;
  date: string;
  basalCalories: number;
  activeCalories: number;
  totalExpenditure: number;
  source: EnergySource;
  syncedAt: string | null;
  createdAt: string;
}

export interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: UserSex;
  activityLevel: ActivityLevel;
}

export interface EnergyBalance {
  caloriesIn: number;
  caloriesOut: number;
  net: number;
}

export interface DailyEnergyBreakdown {
  date: string;
  bmr: number;
  activeCalories: number;
  totalExpenditure: number;
  caloriesIn: number;
  net: number;
}

/** Activity level multipliers for Mifflin-St Jeor BMR */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Default user profile for BMR estimation when no profile data is available */
export const DEFAULT_USER_PROFILE: UserProfile = {
  weightKg: 70,
  heightCm: 170,
  age: 30,
  sex: 'male',
  activityLevel: 'moderate',
};
