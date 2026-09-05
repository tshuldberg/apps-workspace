// Auto-connect surface core (Plan 29 Phase 2-3, item 12 / AM11).
//
// The engine owns the real decision + execution (planAutoConnectRound /
// runAutoConnectJob in @mylife/sync): this file is only the app-side seam that
// (a) stores the device-local opt-in flag, (b) records the honest result of the
// last real round, and (c) composes ONE shared foreground round out of the
// mailbox drain + the auto-connect session sync (+ gossip, once the engine seam
// lands). It fabricates nothing: every number shown comes from a real drain or a
// real `runAutoConnectJob` outcome, never a simulated dial or peer count.
//
// Honesty invariants:
//   - auto-connect is opt-in and OFF by default; nothing here ever flips the
//     background-sync flag (NC-4), a separate dev-build setting.
//   - the "last round" summary is written ONLY after a round actually ran; an
//     empty summary reads as "no round yet", never a fake success.

import type { DatabaseAdapter } from '@mylife/db';
import type { AutoConnectRoundResult } from '@mylife/sync';
import { getSetting, setSetting } from './db';

/** Device-local opt-in flag for automatic dialing (default OFF). */
export const AUTO_CONNECT_ENABLED_SETTING_KEY = 'auto_connect_enabled';
/** Device-local JSON snapshot of the most recent real round (honest read model). */
export const AUTO_CONNECT_LAST_ROUND_SETTING_KEY = 'auto_connect_last_round';

/** Whether the user opted into automatic dialing. Default OFF (opt-in). */
export function isAutoConnectEnabled(db: DatabaseAdapter): boolean {
  return getSetting(db, AUTO_CONNECT_ENABLED_SETTING_KEY) === '1';
}

/** Toggle automatic dialing. This NEVER touches the background-sync flag (NC-4). */
export function setAutoConnectEnabled(db: DatabaseAdapter, enabled: boolean): void {
  setSetting(db, AUTO_CONNECT_ENABLED_SETTING_KEY, enabled ? '1' : '0');
}

/** What fired a round (for the honest "last run" label). */
export type AutoConnectTrigger = 'foreground' | 'lan_peer' | 'manual';

/**
 * Honest snapshot of one real composed round. Every count is drawn from a real
 * drain result or a real `runAutoConnectJob` outcome; `gossip` is null until the
 * engine gossip seam (item 10) is composed in.
 */
export interface AutoConnectRoundSummary {
  at: string;
  trigger: AutoConnectTrigger;
  /** Messages the mailbox drain actually applied this round. */
  drainApplied: number;
  drainRan?: boolean;
  attempted: number;
  completed: number;
  failed: number;
  skipped: number;
  nextEarliestRetryAt: number | null;
  gossip: { descriptorsSent: number; revocationsSent: number } | null;
}

export interface AutoConnectRoundInput {
  trigger: AutoConnectTrigger;
  /** The mailbox drain (the existing shared foreground drain). */
  runDrain: () => Promise<{ ran: boolean; appliedMessages: number }>;
  /** The auto-connect session sync (real `runAutoConnectJob`). */
  runSessions: () => Promise<AutoConnectRoundResult>;
  /**
   * Descriptor/revocation gossip. Reserved seam for engine item 10: when the
   * engine wires gossip into a real session round, SyncProvider passes it here so
   * this ONE round composes drain + sessions + gossip. Absent = not yet landed.
   */
  runGossip?: () => Promise<{ descriptorsSent: number; revocationsSent: number }>;
  now?: () => number;
}

/** The composed outcome (returned to the caller and persisted as a summary). */
export interface AutoConnectRoundOutcome {
  summary: AutoConnectRoundSummary;
  sessions: AutoConnectRoundResult;
}

/**
 * Run ONE shared foreground round: mailbox drain, then auto-connect session
 * sync, then gossip when composed in. Pure orchestration over injected real
 * functions so it is unit-testable without the engine. Ordering matters: drain
 * first (apply what peers parked), then dial, then gossip signed state.
 */
export async function runComposedAutoConnectRound(
  input: AutoConnectRoundInput,
): Promise<AutoConnectRoundOutcome> {
  const now = input.now ?? (() => Date.now());
  const drain = await input.runDrain();
  const sessions = await input.runSessions();
  const gossip = input.runGossip ? await input.runGossip() : null;
  const summary: AutoConnectRoundSummary = {
    at: new Date(now()).toISOString(),
    trigger: input.trigger,
    drainApplied: drain.ran ? drain.appliedMessages : 0,
    drainRan: drain.ran,
    attempted: sessions.attempted,
    completed: sessions.completed,
    failed: sessions.failed,
    skipped: sessions.skipped,
    nextEarliestRetryAt: sessions.nextEarliestRetryAt,
    gossip,
  };
  return { summary, sessions };
}

/** Persist the honest last-round snapshot (device-local; never replicated). */
export function recordAutoConnectRound(db: DatabaseAdapter, summary: AutoConnectRoundSummary): void {
  setSetting(db, AUTO_CONNECT_LAST_ROUND_SETTING_KEY, JSON.stringify(summary));
}

/** Read the last real round, or null when none has run on this device. */
export function getLastAutoConnectRound(db: DatabaseAdapter): AutoConnectRoundSummary | null {
  const raw = getSetting(db, AUTO_CONNECT_LAST_ROUND_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AutoConnectRoundSummary>;
    if (typeof parsed.at !== 'string') return null;
    return {
      at: parsed.at,
      trigger: (parsed.trigger as AutoConnectTrigger) ?? 'manual',
      drainApplied: parsed.drainApplied ?? 0,
      ...(typeof parsed.drainRan === 'boolean' ? { drainRan: parsed.drainRan } : {}),
      attempted: parsed.attempted ?? 0,
      completed: parsed.completed ?? 0,
      failed: parsed.failed ?? 0,
      skipped: parsed.skipped ?? 0,
      nextEarliestRetryAt: parsed.nextEarliestRetryAt ?? null,
      gossip: parsed.gossip ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Honest one-line summary of the last round for the card. Never invents
 * activity: with no round it says so; with a round it reports the real counts.
 */
export function describeAutoConnectRound(summary: AutoConnectRoundSummary | null): string {
  if (!summary) return 'No automatic round has run on this device yet.';
  const when = new Date(summary.at).toLocaleString();
  const parts: string[] = [];
  parts.push(`${summary.completed} synced`);
  if (summary.failed > 0) parts.push(`${summary.failed} failed`);
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
  if (summary.drainApplied > 0) {
    parts.push(`${summary.drainApplied} message${summary.drainApplied === 1 ? '' : 's'} received`);
  }
  return `Last round ${when}: ${parts.join(', ')}.`;
}

/** Recovery advice from real outcomes; retry eligibility is not a scheduled delivery. */
export function describeAutoConnectRecovery(summary: AutoConnectRoundSummary | null): string | null {
  if (!summary) return null;
  const parts: string[] = [];
  if (summary.drainRan === false) parts.push('Mailbox catch-up did not run. Check your connection settings.');
  if (summary.failed > 0) {
    parts.push('Some catch-ups failed. Check your connection and contact verification, then try again.');
  } else if (summary.completed === 0 && summary.skipped > 0) {
    parts.push('No contact session completed. Contacts may be unavailable or waiting to retry.');
  } else if (summary.attempted === 0 && summary.skipped === 0) {
    parts.push('No contacts were available for a session. Add a contact or review their automatic connection setting.');
  }
  if (summary.nextEarliestRetryAt !== null) {
    parts.push(`Earliest retry: ${new Date(summary.nextEarliestRetryAt).toLocaleString()}. Keep Meerkat open and tap Catch up now after that time. This is not a delivery estimate.`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}
