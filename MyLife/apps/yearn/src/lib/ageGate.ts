export interface YearnDateParts {
  year: number;
  month: number;
  day: number;
}

export type YearnAgeGateStatus =
  | 'accepted'
  | 'invalid_date'
  | 'under_18'
  | 'unrealistic_age';

export interface YearnAgeGateResult {
  status: YearnAgeGateStatus;
  birthdate: string | null;
  age: number | null;
  message: string | null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toIsoDate(parts: YearnDateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function utcDateParts(date: Date): YearnDateParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function parseYearnBirthdate(value: string): YearnDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function calculateYearnAge(
  birthdate: YearnDateParts,
  referenceDate: Date = new Date(),
): number {
  const today = utcDateParts(referenceDate);
  let age = today.year - birthdate.year;
  const birthdayHasPassed = today.month > birthdate.month
    || (today.month === birthdate.month && today.day >= birthdate.day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}

export function getYearnAdultBirthdateCutoff(
  referenceDate: Date = new Date(),
): string {
  const today = utcDateParts(referenceDate);
  const cutoff = new Date(Date.UTC(today.year - 18, today.month - 1, today.day));
  return toIsoDate(utcDateParts(cutoff));
}

export const YEARN_AGE_GATE_STORAGE_KEY = 'yearn:agegate:v1';

export interface YearnAgeGateStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * Returns the persisted birthdate only when it still evaluates as accepted,
 * so a tampered or stale value can never skip the gate.
 */
export async function loadPersistedYearnAgeGateBirthdate(
  storage: YearnAgeGateStorage,
  referenceDate: Date = new Date(),
): Promise<string | null> {
  try {
    const stored = await storage.getItem(YEARN_AGE_GATE_STORAGE_KEY);
    if (!stored) return null;
    const result = evaluateYearnAgeGate(stored, referenceDate);
    return result.status === 'accepted' ? result.birthdate : null;
  } catch {
    return null;
  }
}

export async function persistYearnAgeGateBirthdate(
  storage: YearnAgeGateStorage,
  birthdate: string,
  referenceDate: Date = new Date(),
): Promise<boolean> {
  const result = evaluateYearnAgeGate(birthdate, referenceDate);
  if (result.status !== 'accepted' || !result.birthdate) return false;
  try {
    await storage.setItem(YEARN_AGE_GATE_STORAGE_KEY, result.birthdate);
    return true;
  } catch {
    return false;
  }
}

export function evaluateYearnAgeGate(
  birthdateInput: string,
  referenceDate: Date = new Date(),
): YearnAgeGateResult {
  const birthdate = parseYearnBirthdate(birthdateInput);
  if (!birthdate) {
    return {
      status: 'invalid_date',
      birthdate: null,
      age: null,
      message: 'Enter your birthdate as YYYY-MM-DD.',
    };
  }

  const age = calculateYearnAge(birthdate, referenceDate);
  const isoBirthdate = toIsoDate(birthdate);

  if (age < 18) {
    return {
      status: 'under_18',
      birthdate: isoBirthdate,
      age,
      message: 'Yearn is only available to adults 18 and older.',
    };
  }

  if (age > 120) {
    return {
      status: 'unrealistic_age',
      birthdate: isoBirthdate,
      age,
      message: 'Enter a valid birthdate.',
    };
  }

  return {
    status: 'accepted',
    birthdate: isoBirthdate,
    age,
    message: null,
  };
}
