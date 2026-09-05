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

// Minimal mk_settings-backed adapter: enough for the get/set helpers under test.
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
  return {
    attempted: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    dials: [],
    nextEarliestRetryAt: null,
    ...over,
  };
}

describe('runComposedAutoConnectRound', () => {
  it('composes drain + sessions into an honest summary', async () => {
    const outcome = await runComposedAutoConnectRound({
      trigger: 'foreground',
      runDrain: async () => ({ ran: true, appliedMessages: 3 }),
      runSessions: async () => sessionsResult({ attempted: 2, completed: 1, failed: 1, nextEarliestRetryAt: 42 }),
      now: () => 1_700_000_000_000,
    });
    expect(outcome.summary).toMatchObject({
      trigger: 'foreground',
      drainApplied: 3,
      attempted: 2,
      completed: 1,
      failed: 1,
      skipped: 0,
      nextEarliestRetryAt: 42,
      gossip: null,
    });
    expect(outcome.summary.at).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it('reports 0 drained when the drain did not run (no relay)', async () => {
    const outcome = await runComposedAutoConnectRound({
      trigger: 'manual',
      runDrain: async () => ({ ran: false, appliedMessages: 9 }),
      runSessions: async () => sessionsResult(),
    });
    expect(outcome.summary.drainApplied).toBe(0);
  });

  it('includes gossip counts only when the gossip seam is composed in', async () => {
    const outcome = await runComposedAutoConnectRound({
      trigger: 'lan_peer',
      runDrain: async () => ({ ran: true, appliedMessages: 0 }),
      runSessions: async () => sessionsResult({ completed: 1 }),
      runGossip: async () => ({ descriptorsSent: 2, revocationsSent: 1 }),
    });
    expect(outcome.summary.gossip).toEqual({ descriptorsSent: 2, revocationsSent: 1 });
  });
});

describe('describeAutoConnectRound', () => {
  it('says nothing has run when there is no summary', () => {
    expect(describeAutoConnectRound(null)).toBe('No automatic round has run on this device yet.');
  });

  it('reports the real counts without inventing activity', () => {
    const summary: AutoConnectRoundSummary = {
      at: new Date(1_700_000_000_000).toISOString(),
      trigger: 'foreground',
      drainApplied: 2,
      attempted: 3,
      completed: 2,
      failed: 1,
      skipped: 0,
      nextEarliestRetryAt: null,
      gossip: null,
    };
    const text = describeAutoConnectRound(summary);
    expect(text).toContain('2 synced');
    expect(text).toContain('1 failed');
    expect(text).toContain('2 messages received');
  });
});

describe('auto-connect settings + last-round persistence', () => {
  it('defaults to off and round-trips the opt-in flag', () => {
    const db = fakeSettingsDb();
    expect(isAutoConnectEnabled(db)).toBe(false);
    setAutoConnectEnabled(db, true);
    expect(isAutoConnectEnabled(db)).toBe(true);
    setAutoConnectEnabled(db, false);
    expect(isAutoConnectEnabled(db)).toBe(false);
  });

  it('persists and reloads the last real round summary', () => {
    const db = fakeSettingsDb();
    expect(getLastAutoConnectRound(db)).toBeNull();
    const summary: AutoConnectRoundSummary = {
      at: new Date(1_700_000_000_000).toISOString(),
      trigger: 'lan_peer',
      drainApplied: 1,
      attempted: 1,
      completed: 1,
      failed: 0,
      skipped: 2,
      nextEarliestRetryAt: 123,
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
