import { describe, expect, it } from 'vitest';
import type {
  StorageDestinationRow,
  StorageHealthRow,
  StorageJobRow,
  StoragePolicyRow,
} from '../schema';
import { decideStorageSchedule } from '../storage-scheduler';

const NOW = '2026-07-14T12:00:00.000Z';

function destination(state: StorageDestinationRow['state'] = 'ready'): StorageDestinationRow {
  return {
    id: 'primary',
    kind: 'local_device',
    label: 'Primary',
    account_hint: null,
    credential_ref: null,
    root_ref: null,
    state,
    capability_json: '{}',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: NOW,
  };
}

function policy(enabled = true): StoragePolicyRow {
  return {
    data_class: 'sqlite_snapshot',
    primary_destination_id: 'primary',
    mirror_destination_id: null,
    local_cache_bytes: 0,
    retention_json: JSON.stringify({
      keepLast: 7,
      maxAgeDays: 30,
      schedule: { enabled, intervalHours: 24 },
    }),
    updated_at: NOW,
  };
}

function health(overrides: Partial<StorageHealthRow> = {}): StorageHealthRow {
  return {
    destination_id: 'primary',
    state: 'ok',
    used_bytes: 1,
    cap_bytes: 100,
    verified_read_write: 1,
    checked_at: NOW,
    error_code: null,
    ...overrides,
  };
}

function backupJob(updatedAt: string, state: StorageJobRow['state']): StorageJobRow {
  return {
    id: `job-${state}`,
    kind: 'backup',
    destination_id: 'primary',
    state,
    cursor_json: null,
    total_objects: 1,
    completed_objects: state === 'succeeded' ? 1 : 0,
    total_bytes: 1,
    completed_bytes: state === 'succeeded' ? 1 : 0,
    attempts: 1,
    last_error_code: null,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

describe('storage scheduler decision', () => {
  it.each([
    ['due', [], [health()], 'due'],
    ['not due', [backupJob('2026-07-14T00:00:00.000Z', 'succeeded')], [health()], 'not_due'],
    ['paused', [backupJob('2026-07-10T00:00:00.000Z', 'paused')], [health()], 'paused_job'],
    ['revoked', [], [health({ state: 'revoked', verified_read_write: 0 })], 'revoked'],
    ['quota full', [], [health({ used_bytes: 100, cap_bytes: 100 })], 'quota_full'],
  ] as const)('returns the golden %s decision', (_label, jobs, healthRows, expected) => {
    const result = decideStorageSchedule({
      policies: [policy()],
      destinations: [destination()],
      health: healthRows,
      jobs,
      now: NOW,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.reason).toBe(expected);
    expect(result[0]?.due).toBe(expected === 'due');
  });

  it('keeps scheduling opt-in and reports invalid policy honestly', () => {
    const disabled = decideStorageSchedule({
      policies: [policy(false)], destinations: [destination()], health: [health()], jobs: [], now: NOW,
    });
    const malformed = decideStorageSchedule({
      policies: [{ ...policy(), retention_json: '{' }],
      destinations: [destination()], health: [health()], jobs: [], now: NOW,
    });

    expect(disabled[0]?.reason).toBe('disabled');
    expect(malformed[0]?.reason).toBe('invalid_policy');
  });

  it('keys last runs by data class when policies share one destination', () => {
    const secondPolicy = { ...policy(), data_class: 'library_object' };
    const result = decideStorageSchedule({
      policies: [policy(), secondPolicy],
      destinations: [destination()],
      health: [health()],
      jobs: [],
      lastRuns: [{
        dataClass: 'sqlite_snapshot',
        destinationId: 'primary',
        completedAt: '2026-07-14T00:00:00.000Z',
      }],
      now: NOW,
    });

    expect(result.find((decision) => decision.dataClass === 'sqlite_snapshot')?.reason).toBe('not_due');
    expect(result.find((decision) => decision.dataClass === 'library_object')?.reason).toBe('due');
  });
});
