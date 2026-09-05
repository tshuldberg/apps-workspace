// age-gate.ts: mobile adapter over the shared @mylife/sync age-gate core
// (legal readiness 2026-07-18). The pure evaluator, record codec, and settings
// key live in the shared package; this file owns only device persistence, the
// configured minimum age, and the runtime change signal the root layout uses.
//
// Data minimization: the birth date is evaluated in memory and never persisted;
// only the outcome record (passed/locked + policy + timestamp) is stored.

import type { DatabaseAdapter } from '@mylife/db';
import {
  AGE_GATE_SETTING_KEY,
  clampMinimumAge,
  decodeAgeGateRecord,
  encodeAgeGateRecord,
  evaluateAgeGateBirthDate,
  type AgeGateBirthDate,
  type AgeGateEvaluation,
  type AgeGateRecord,
} from '@mylife/sync';
import { getSetting, setSetting } from './db';

/** Pure resolver from an expo extra bag (unit-tested without native modules). */
export function resolveMinimumAgeFromExtra(extra: Record<string, unknown>): number {
  const raw = extra.minimumAge;
  return clampMinimumAge(typeof raw === 'string' || typeof raw === 'number' ? raw : undefined);
}

/** The counsel-configurable minimum age for this build (env MEERKAT_MINIMUM_AGE, default 13). */
export function configuredMinimumAge(): number {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const extra = (require('expo-constants').default?.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return resolveMinimumAgeFromExtra(extra);
}

/** The persisted gate outcome, or null when the gate has not been answered. */
export function readAgeGateRecord(db: DatabaseAdapter): AgeGateRecord | null {
  return decodeAgeGateRecord(getSetting(db, AGE_GATE_SETTING_KEY));
}

export function isAgeGatePassed(db: DatabaseAdapter): boolean {
  return readAgeGateRecord(db)?.status === 'passed';
}

export function isAgeGateLocked(db: DatabaseAdapter): boolean {
  return readAgeGateRecord(db)?.status === 'locked';
}

/**
 * Evaluate a birth date and persist the outcome. Entry errors (invalid/future/
 * implausible dates) persist nothing so the user can correct a typo; a real
 * underage answer persists a durable lock; a passing answer persists `passed`.
 */
export function submitAgeGateBirthDate(
  db: DatabaseAdapter,
  birth: AgeGateBirthDate,
  nowMs = Date.now(),
  minimumAge = configuredMinimumAge(),
): AgeGateEvaluation {
  const evaluation = evaluateAgeGateBirthDate(birth, nowMs, minimumAge);
  if (evaluation.ok) {
    setSetting(db, AGE_GATE_SETTING_KEY, encodeAgeGateRecord('passed', minimumAge, nowMs));
    notifyAgeGateChanged();
  } else if (evaluation.reason === 'underage') {
    setSetting(db, AGE_GATE_SETTING_KEY, encodeAgeGateRecord('locked', minimumAge, nowMs));
    notifyAgeGateChanged();
  }
  return evaluation;
}

// Runtime change signal (same module-singleton pattern as onboarding-core): the
// root layout re-reads gate state when a decision lands.
const listeners = new Set<() => void>();

export function subscribeAgeGateChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyAgeGateChanged(): void {
  for (const listener of listeners) listener();
}

/**
 * Fire the age-gate change signal from a NON-gate writer (Plan 51: the verification
 * account writes a passing record from a store adult signal via account-core, then
 * needs the root layout to re-read gate state). The account layer owns the gate
 * record write; this only re-uses the same runtime signal so the AgeGate component
 * re-evaluates. It never changes gate state itself.
 */
export function notifyAgeGateChangedFromStore(): void {
  notifyAgeGateChanged();
}
