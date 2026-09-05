// Web auto-connect-core (Plan 29 item 12) honesty + persistence. Twin of
// apps/meerkat/app/(root)/data/__tests__/auto-connect-core.test.ts.

import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { AutoConnectRoundResult } from '@mylife/sync';
import {
  describeAutoConnectRound,
  describeAutoConnectRecovery,
  getLastAutoConnectRound,
  isAutoConnectEnabled,
  recordAutoConnectRound,
  runComposedAutoConnectRound,
  setAutoConnectEnabled,
  type AutoConnectRoundSummary,
} from '../auto-connect-core';

function fakeSettingsDb(): DatabaseAdapter {
  const store = new Map<string, string>();
  return {
    execute(sql: string, params: unknown[] = []): void {
      if (sql.includes('INSERT OR REPLACE INTO mk_settings')) {
        store.set(String(params[0]), String(params[1]));
      } else if (sql.includes('DELETE FROM mk_settings')) {
        store.delete(String(params[0]));
      }
    },
    query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      if (sql.includes('SELECT value FROM mk_settings')) {
        const key = String(params[0]);
        return store.has(key) ? ([{ value: store.get(key) }] as unknown as T[]) : [];
      }
      return [];
    },
    transaction(fn: () => void): void {
      fn();
    },
  };
}

function sessionsResult(over: Partial<AutoConnectRoundResult> = {}): AutoConnectRoundResult {
  return { attempted: 0, completed: 0, failed: 0, skipped: 0, dials: [], nextEarliestRetryAt: null, ...over };
}

describe('web runComposedAutoConnectRound', () => {
  it('composes drain + sessions into an honest summary', async () => {
    const outcome = await runComposedAutoConnectRound({
      trigger: 'foreground',
      runDrain: async () => ({ ran: true, appliedMessages: 2 }),
      runSessions: async () => sessionsResult({ attempted: 1, completed: 1 }),
      now: () => 1_700_000_000_000,
    });
    expect(outcome.summary).toMatchObject({ drainApplied: 2, attempted: 1, completed: 1, gossip: null });
  });

  it('reports 0 drained when the drain did not run', async () => {
    const outcome = await runComposedAutoConnectRound({
      trigger: 'manual',
      runDrain: async () => ({ ran: false, appliedMessages: 5 }),
      runSessions: async () => sessionsResult(),
    });
    expect(outcome.summary.drainApplied).toBe(0);
  });
});

describe('web describeAutoConnectRound', () => {
  it('says nothing has run with no summary', () => {
    expect(describeAutoConnectRound(null)).toBe('No automatic round has run on this device yet.');
  });
});

describe('web auto-connect settings + persistence', () => {
  it('defaults off, round-trips flag and last-round summary', () => {
    const db = fakeSettingsDb();
    expect(isAutoConnectEnabled(db)).toBe(false);
    setAutoConnectEnabled(db, true);
    expect(isAutoConnectEnabled(db)).toBe(true);
    const summary: AutoConnectRoundSummary = {
      at: new Date(1_700_000_000_000).toISOString(),
      trigger: 'foreground',
      drainApplied: 0,
      attempted: 2,
      completed: 1,
      failed: 1,
      skipped: 0,
      nextEarliestRetryAt: null,
      gossip: null,
    };
    recordAutoConnectRound(db, summary);
    expect(getLastAutoConnectRound(db)).toEqual(summary);
  });
});


describe('catch-up recovery guidance', () => {
  it('distinguishes a skipped mailbox from zero received messages and persists it', async () => {
    const outcome = await runComposedAutoConnectRound({
      trigger: 'manual',
      runDrain: async () => ({ ran: false, appliedMessages: 0 }),
      runSessions: async () => sessionsResult(),
    });
    const db = fakeSettingsDb();
    recordAutoConnectRound(db, outcome.summary);
    const restored = getLastAutoConnectRound(db);
    expect(restored?.drainRan).toBe(false);
    expect(describeAutoConnectRecovery(restored)).toContain('Mailbox catch-up did not run.');
    expect(describeAutoConnectRecovery(restored)).toContain('No contacts were available');
  });

  it('shows failed-session recovery and an eligibility time, never a delivery promise', async () => {
    const outcome = await runComposedAutoConnectRound({
      trigger: 'manual',
      runDrain: async () => ({ ran: true, appliedMessages: 0 }),
      runSessions: async () => sessionsResult({ attempted: 1, failed: 1, nextEarliestRetryAt: 1_800_000_030_000 }),
    });
    const text = describeAutoConnectRecovery(outcome.summary);
    expect(text).toContain('Some catch-ups failed.');
    expect(text).toContain('Earliest retry:');
    expect(text).toContain('This is not a delivery estimate.');
  });

  it('leaves a completed round without a recovery warning', async () => {
    const outcome = await runComposedAutoConnectRound({
      trigger: 'manual',
      runDrain: async () => ({ ran: true, appliedMessages: 2 }),
      runSessions: async () => sessionsResult({ attempted: 1, completed: 1 }),
    });
    expect(describeAutoConnectRecovery(outcome.summary)).toBeNull();
    expect(describeAutoConnectRecovery(null)).toBeNull();
  });
});
