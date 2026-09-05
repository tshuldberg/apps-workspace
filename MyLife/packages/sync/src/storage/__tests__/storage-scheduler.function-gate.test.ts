import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type {
  StorageDestinationRow,
  StorageHealthRow,
  StorageJobRow,
  StoragePolicyRow,
} from '../schema';
import { decideStorageSchedule, type DecideStorageScheduleInput } from '../storage-scheduler';

const NOW = '2026-07-14T12:00:00.000Z';

function destination(index: number, state: StorageDestinationRow['state'] = 'ready'): StorageDestinationRow {
  return {
    id: `destination-${index}`,
    kind: 'local_device',
    label: `Destination ${index}`,
    account_hint: null,
    credential_ref: null,
    root_ref: null,
    state,
    capability_json: '{}',
    created_at: NOW,
    updated_at: NOW,
  };
}

function policy(index: number, enabled = true): StoragePolicyRow {
  return {
    data_class: `class-${String(index).padStart(5, '0')}`,
    primary_destination_id: `destination-${index}`,
    mirror_destination_id: null,
    local_cache_bytes: 0,
    retention_json: JSON.stringify({ schedule: { enabled, intervalHours: 24 } }),
    updated_at: NOW,
  };
}

function health(index: number, usedBytes = 1, capBytes = 100): StorageHealthRow {
  return {
    destination_id: `destination-${index}`,
    state: 'ok',
    used_bytes: usedBytes,
    cap_bytes: capBytes,
    verified_read_write: 1,
    checked_at: NOW,
    error_code: null,
  };
}

function succeededJob(index: number): StorageJobRow {
  return {
    id: `job-${index}`,
    kind: 'backup',
    destination_id: `destination-${index}`,
    state: 'succeeded',
    cursor_json: null,
    total_objects: 1,
    completed_objects: 1,
    total_bytes: 1,
    completed_bytes: 1,
    attempts: 1,
    last_error_code: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

function scheduledInput(size: number): DecideStorageScheduleInput {
  return {
    policies: Array.from({ length: size }, (_, index) => policy(size - index - 1)),
    destinations: Array.from({ length: size }, (_, index) => destination(index)),
    health: Array.from({ length: size }, (_, index) => health(index)),
    jobs: Array.from({ length: size }, (_, index) => succeededJob(index)),
    now: NOW,
  };
}

describe('decideStorageSchedule function quality gate', () => {
  it('reports a healthy never-run policy as due', () => {
    expect(decideStorageSchedule({
      policies: [policy(0)],
      destinations: [destination(0)],
      health: [health(0)],
      jobs: [],
      now: NOW,
    })).toEqual([expect.objectContaining({ due: true, reason: 'due' })]);
  });

  it('passes deterministic decision fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'decideStorageSchedule fuzz',
      iterations: 200,
      seed: 41,
      makeCase: (rng) => ({
        count: randomInt(rng, 1, 60),
        disabledModulo: randomInt(rng, 2, 8),
        quotaModulo: randomInt(rng, 2, 9),
      }),
      assertCase: async ({ count, disabledModulo, quotaModulo }) => {
        const input: DecideStorageScheduleInput = {
          policies: Array.from({ length: count }, (_, index) => policy(index, index % disabledModulo !== 0)),
          destinations: Array.from({ length: count }, (_, index) => destination(index)),
          health: Array.from({ length: count }, (_, index) => (
            index % quotaModulo === 0 ? health(index, 100, 100) : health(index)
          )),
          jobs: [],
          now: NOW,
        };
        const decisions = decideStorageSchedule(input);

        expect(decisions).toHaveLength(count);
        expect(decisions.every((decision) => decision.due === (decision.reason === 'due'))).toBe(true);
        expect(decisions.every((decision, index, all) => (
          index === 0 || all[index - 1]!.dataClass.localeCompare(decision.dataClass) <= 0
        ))).toBe(true);
      },
    });
  });

  it('stays within nlogn complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'decideStorageSchedule',
      sizes: [250, 500, 1000],
      expected: 'nlogn',
      setup: scheduledInput,
      run: async (input) => decideStorageSchedule(input),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'decideStorageSchedule',
      repeats: 10,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => scheduledInput(250),
      run: async (input) => decideStorageSchedule(input),
    });
  });
});
