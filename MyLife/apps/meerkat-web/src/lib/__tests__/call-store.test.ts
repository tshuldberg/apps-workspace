// Plan 25 WP-25H: device-local call store + the NC-25.7 no-replication guard (web).
// The guard reads the WEB sync prefix + policy maps (meerkat-data.ts): no prefix
// resolves a call_ table and no policy entity rule starts with call_.

import { describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  ensureCallTables,
  hasSeenCallNonce,
  listCallLog,
  pruneCallNonces,
  recordCallNonce,
  recordCallReport,
  upsertCallActive,
  upsertCallLogRow,
  clearCallActive,
  CALL_ACTIVE_TABLE,
  CALL_LOG_TABLE,
  CALL_REPORTS_TABLE,
  CALL_SIGNAL_NONCES_TABLE,
} from '../call-store';
import { foldCallLog } from '../call-log-core';
import { MEERKAT_SYNC_PREFIXES, MEERKAT_SYNC_POLICIES } from '../meerkat-data';
import type { CallState } from '@mylife/sync';

function db() {
  const handle = createInMemoryTestDatabase();
  ensureCallTables(handle.adapter);
  return handle;
}

function state(overrides: Partial<CallState>): CallState {
  return {
    phase: 'idle',
    media: 'voice',
    direction: 'outgoing',
    callId: 'call-1',
    remoteDeviceId: 'ab'.repeat(32),
    securityMode: 'direct_e2e',
    iceState: 'new',
    localMicOn: true,
    localCamOn: false,
    ...overrides,
  };
}

describe('NC-25.7: call_ tables never replicate', () => {
  it('no sync prefix resolves a call_ table to a module', () => {
    for (const [, prefix] of MEERKAT_SYNC_PREFIXES) {
      for (const table of [
        CALL_LOG_TABLE,
        CALL_ACTIVE_TABLE,
        CALL_REPORTS_TABLE,
        CALL_SIGNAL_NONCES_TABLE,
      ]) {
        expect(table.startsWith(prefix)).toBe(false);
      }
    }
  });

  it('no sync policy declares an entity rule for a call_ table', () => {
    for (const [, policy] of MEERKAT_SYNC_POLICIES) {
      for (const rule of policy.entityRules ?? []) {
        expect(rule.tableName.startsWith('call_')).toBe(false);
      }
    }
  });
});

describe('call_log persistence', () => {
  it('persists the folded row and honors the honesty invariants end to end', () => {
    const handle = db();
    const input = { callId: 'call-a', createdAtMs: 1_000, direction: 'outgoing' as const };

    // Ring only, declined: no duration ever.
    let row = foldCallLog(input, state({ phase: 'ringing', callId: 'call-a' }), 1_500);
    row = foldCallLog(input, state({ phase: 'declined', callId: 'call-a' }), 2_000, row);
    upsertCallLogRow(handle.adapter, row);

    const rows = listCallLog(handle.adapter);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe('declined');
    expect(rows[0]?.connected).toBe(false);
    expect(rows[0]?.durationMs).toBeNull();
    handle.close();
  });

  it('a connected call records a real duration and upserts idempotently', () => {
    const handle = db();
    const input = { callId: 'call-b', createdAtMs: 1_000, direction: 'incoming' as const };
    let row = foldCallLog(input, state({ phase: 'connected', callId: 'call-b', direction: 'incoming' }), 2_000);
    upsertCallLogRow(handle.adapter, row);
    row = foldCallLog(input, state({ phase: 'ended', callId: 'call-b', direction: 'incoming' }), 9_000, row);
    upsertCallLogRow(handle.adapter, row);
    upsertCallLogRow(handle.adapter, row);

    const rows = listCallLog(handle.adapter);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe('completed');
    expect(rows[0]?.durationMs).toBe(7_000);
    expect(rows[0]?.direction).toBe('incoming');
    handle.close();
  });

  it('orders history newest-first and respects the limit', () => {
    const handle = db();
    for (let i = 0; i < 5; i += 1) {
      const input = { callId: `call-${i}`, createdAtMs: 1_000 + i, direction: 'outgoing' as const };
      const row = foldCallLog(input, state({ phase: 'cancelled', callId: `call-${i}` }), 2_000 + i);
      upsertCallLogRow(handle.adapter, row);
    }
    const rows = listCallLog(handle.adapter, 3);
    expect(rows.map((r) => r.id)).toEqual(['call-4', 'call-3', 'call-2']);
    handle.close();
  });
});

describe('call_active lifecycle', () => {
  it('upserts one live row and clears it on terminal', () => {
    const handle = db();
    upsertCallActive(handle.adapter, {
      callId: 'call-x',
      engine: 'direct',
      engineState: 'negotiating',
      iceState: 'checking',
      localMicOn: true,
      localCamOn: false,
      securityMode: 'direct_e2e',
      updatedAtMs: 1_000,
    });
    upsertCallActive(handle.adapter, {
      callId: 'call-x',
      engine: 'direct',
      engineState: 'connected',
      iceState: 'connected',
      localMicOn: false,
      localCamOn: true,
      securityMode: 'direct_turn_relayed',
      updatedAtMs: 2_000,
    });
    const rows = handle.adapter.query<{ engine_state: string; security_mode: string }>(
      `SELECT engine_state, security_mode FROM call_active`,
    );
    expect(rows).toEqual([{ engine_state: 'connected', security_mode: 'direct_turn_relayed' }]);
    clearCallActive(handle.adapter, 'call-x');
    expect(handle.adapter.query(`SELECT * FROM call_active`)).toHaveLength(0);
    handle.close();
  });
});

describe('call signal replay floor', () => {
  it('records, detects, and prunes nonces by expiry', () => {
    const handle = db();
    expect(hasSeenCallNonce(handle.adapter, 'aa'.repeat(16))).toBe(false);
    recordCallNonce(handle.adapter, 'aa'.repeat(16), 5_000);
    expect(hasSeenCallNonce(handle.adapter, 'aa'.repeat(16))).toBe(true);
    // Prune below expiry keeps it; at/after expiry drops it.
    pruneCallNonces(handle.adapter, 4_999);
    expect(hasSeenCallNonce(handle.adapter, 'aa'.repeat(16))).toBe(true);
    pruneCallNonces(handle.adapter, 5_000);
    expect(hasSeenCallNonce(handle.adapter, 'aa'.repeat(16))).toBe(false);
    handle.close();
  });
});

describe('call_reports', () => {
  it('records a local-only report row', () => {
    const handle = db();
    recordCallReport(handle.adapter, {
      callId: 'call-r',
      reportedDeviceId: 'cd'.repeat(32),
      reason: 'abusive call',
      nowMs: 42_000,
    });
    const rows = handle.adapter.query<{ call_id: string; reason: string }>(
      `SELECT call_id, reason FROM call_reports`,
    );
    expect(rows).toEqual([{ call_id: 'call-r', reason: 'abusive call' }]);
    handle.close();
  });
});
