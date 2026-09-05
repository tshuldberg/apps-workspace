// age-gate.ts: web adapter over the shared @mylife/sync age-gate core (legal
// readiness 2026-07-18). Twin of the mobile adapter in
// apps/meerkat/app/(root)/data/age-gate.ts: device persistence in mk_settings,
// the counsel-configured minimum age (VITE_MEERKAT_MINIMUM_AGE, default 13),
// and a runtime change signal. The birth date is never persisted.

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
import { getSetting, setSetting } from './meerkat-data';

/** Pure resolver (unit-tested); the env wrapper below feeds it. */
export function resolveMinimumAge(raw: string | undefined): number {
  return clampMinimumAge(raw);
}

/** The counsel-configurable minimum age for this build (default 13, clamped [13, 21]). */
export function configuredMinimumAge(): number {
  return resolveMinimumAge(import.meta.env.VITE_MEERKAT_MINIMUM_AGE as string | undefined);
}

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
 * Evaluate a birth date and persist the outcome. Entry errors persist nothing
 * (correctable); underage persists a durable lock; passing persists `passed`.
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
 * Fire the age-gate change signal after the account layer writes a store-provided
 * adult pass (Plan 51). The write itself lives in account.ts's applyStoreAgeSignal
 * (twin of the mobile account-core), which owns the "adult only, never overwrite a
 * locked/passed record" policy; this just wakes any subscribed screen.
 */
export function notifyAgeGateChangedFromStore(): void {
  notifyAgeGateChanged();
}
