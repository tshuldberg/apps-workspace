// age-gate.ts: pure, platform-free minimum-age gate logic shared by the Meerkat
// mobile and web apps (legal readiness 2026-07-18, runbook Step 3).
//
// Design constraints, encoded rather than documented:
// - NEUTRAL gate: the evaluator takes a full birth date and computes the exact
//   age; callers must not hint the passing threshold in the entry UI.
// - DATA MINIMIZATION: the persisted record NEVER contains the birth date. It
//   records only the outcome, the policy that produced it, and when.
// - HONEST LOCKOUT: an underage answer persists as `locked`. Re-prompting right
//   away would make the gate a retry puzzle, not a gate.
// - The minimum age is configuration (counsel-ruled), clamped to a lawful floor
//   of 13 (COPPA); the default is 13 until counsel rules otherwise.

export const MEERKAT_DEFAULT_MINIMUM_AGE = 13;
export const MEERKAT_MINIMUM_AGE_FLOOR = 13;
export const MEERKAT_MINIMUM_AGE_CEILING = 21;

/** The mk_settings key both apps persist the gate outcome under. */
export const AGE_GATE_SETTING_KEY = 'meerkat_age_gate_v1';

/** Oldest plausible human age accepted before the date is treated as an entry error. */
export const AGE_GATE_MAX_PLAUSIBLE_AGE = 120;

export interface AgeGateBirthDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export type AgeGateEvaluation =
  | { ok: true; age: number }
  | { ok: false; reason: 'invalid_date' | 'in_future' | 'implausible' | 'underage'; age?: number };

export interface AgeGateRecord {
  version: 1;
  status: 'passed' | 'locked';
  /** ISO timestamp of the decision. */
  at: string;
  /** The minimum age policy in force when the decision was made. */
  minimumAge: number;
  /**
   * Where the decision came from. 'device' (default, absent on older records)
   * is the neutral in-app gate; 'store' is a store-provided age signal consumed
   * via the verification account (Plan 51). Only an ADULT store signal may skip
   * the gate; a store minor signal never locks and never skips (the neutral
   * gate still runs, because "minor" does not mean "under the minimum age").
   */
  source?: 'device' | 'store';
}

/** The store-provided age signal shape the verification account can supply. */
export type StoreAgeSignal = 'adult' | 'minor' | 'unknown';

/**
 * Whether a store age signal is allowed to satisfy the gate. Encoded policy:
 * only 'adult' skips. 'minor' and 'unknown' leave the gate exactly as it is
 * today; nothing a store says can lock a device.
 */
export function storeAgeSignalSatisfiesGate(signal: StoreAgeSignal): boolean {
  return signal === 'adult';
}

/**
 * Clamp a raw configured minimum age (env string or number) into the lawful
 * range. Anything unparseable resolves to the default. The floor is 13: a
 * configuration cannot weaken the gate below COPPA's line.
 */
export function clampMinimumAge(raw: string | number | undefined | null): number {
  const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isSafeInteger(parsed)) return MEERKAT_DEFAULT_MINIMUM_AGE;
  if (parsed < MEERKAT_MINIMUM_AGE_FLOOR) return MEERKAT_MINIMUM_AGE_FLOOR;
  if (parsed > MEERKAT_MINIMUM_AGE_CEILING) return MEERKAT_MINIMUM_AGE_CEILING;
  return parsed;
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isSafeInteger(year) || !Number.isSafeInteger(month) || !Number.isSafeInteger(day)) {
    return false;
  }
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  // UTC round-trip rejects overflow dates like Feb 30 (which Date silently rolls over).
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

/** Exact age in whole years at `nowMs`, computed in UTC. */
export function exactAgeAt(birth: AgeGateBirthDate, nowMs: number): number {
  const now = new Date(nowMs);
  let age = now.getUTCFullYear() - birth.year;
  const birthdayThisYearPassed =
    now.getUTCMonth() + 1 > birth.month ||
    (now.getUTCMonth() + 1 === birth.month && now.getUTCDate() >= birth.day);
  if (!birthdayThisYearPassed) age -= 1;
  return age;
}

/**
 * Evaluate a birth date against the minimum-age policy. Distinguishes entry
 * errors (invalid/future/implausible dates, which the UI should let the user
 * correct) from a real underage answer (which the caller must persist as a
 * durable lock, never a retry prompt).
 */
export function evaluateAgeGateBirthDate(
  birth: AgeGateBirthDate,
  nowMs: number,
  minimumAge: number,
): AgeGateEvaluation {
  if (!isRealCalendarDate(birth.year, birth.month, birth.day)) {
    return { ok: false, reason: 'invalid_date' };
  }
  const birthUtc = Date.UTC(birth.year, birth.month - 1, birth.day);
  if (birthUtc > nowMs) return { ok: false, reason: 'in_future' };
  const age = exactAgeAt(birth, nowMs);
  if (age > AGE_GATE_MAX_PLAUSIBLE_AGE) return { ok: false, reason: 'implausible', age };
  if (age < clampMinimumAge(minimumAge)) return { ok: false, reason: 'underage', age };
  return { ok: true, age };
}

/** Encode a gate outcome for persistence. Never accepts or stores a birth date. */
export function encodeAgeGateRecord(
  status: AgeGateRecord['status'],
  minimumAge: number,
  nowMs: number,
  source: NonNullable<AgeGateRecord['source']> = 'device',
): string {
  if (source === 'store' && status !== 'passed') {
    // Nothing a store says can lock a device; only the neutral gate locks.
    throw new Error('A store age signal can only record a passed gate');
  }
  const record: AgeGateRecord = {
    version: 1,
    status,
    at: new Date(nowMs).toISOString(),
    minimumAge: clampMinimumAge(minimumAge),
    source,
  };
  return JSON.stringify(record);
}

/**
 * Decode a persisted gate record. Anything malformed decodes to null (the gate
 * re-prompts; it never fabricates a passed state from a corrupt row).
 */
export function decodeAgeGateRecord(raw: string | null | undefined): AgeGateRecord | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (record.version !== 1) return null;
  if (record.status !== 'passed' && record.status !== 'locked') return null;
  if (typeof record.at !== 'string' || Number.isNaN(Date.parse(record.at))) return null;
  if (typeof record.minimumAge !== 'number' || !Number.isSafeInteger(record.minimumAge)) return null;
  const source = record.source === 'store' ? 'store' : 'device';
  if (source === 'store' && record.status !== 'passed') return null; // corrupt: stores cannot lock
  return {
    version: 1,
    status: record.status,
    at: record.at,
    minimumAge: clampMinimumAge(record.minimumAge),
    source,
  };
}
