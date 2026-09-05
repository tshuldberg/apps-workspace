import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { planRetentionJob, type RetentionBackupCopy } from '../retention';

const NOW = '2026-07-14T12:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1_000;

function backup(index: number, state: RetentionBackupCopy['state'] = 'complete'): RetentionBackupCopy {
  return {
    backupId: `backup-${index}`,
    destinationId: 'primary',
    dataClass: 'sqlite_snapshot',
    role: 'primary',
    state,
    completedAt: new Date(Date.parse(NOW) - index * DAY_MS).toISOString(),
  };
}

function inputFor(backups: readonly RetentionBackupCopy[], keepLast = 1, maxAgeDays = 1) {
  return {
    dataClass: 'sqlite_snapshot',
    retentionJson: JSON.stringify({ keepLast, maxAgeDays }),
    backups,
    now: NOW,
  } as const;
}

describe('planRetentionJob function quality gate', () => {
  it('deletes only expired overflow while preserving a verified copy', () => {
    const plan = planRetentionJob(inputFor([backup(0), backup(10), backup(20)]));

    expect(plan.invalidPolicy).toBe(false);
    expect(plan.deleteCopies.map((copy) => copy.backupId)).toEqual(['backup-10', 'backup-20']);
    expect(plan.deleteCopies).not.toContainEqual(expect.objectContaining({ backupId: 'backup-0' }));
  });

  it('passes deterministic retention safety fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'planRetentionJob fuzz',
      iterations: 200,
      seed: 41,
      makeCase: (rng) => {
        const count = randomInt(rng, 1, 60);
        return {
          keepLast: randomInt(rng, 1, 12),
          maxAgeDays: randomInt(rng, 1, 45),
          backups: Array.from({ length: count }, (_, index) => (
            backup(index, index === 0 || randomInt(rng, 0, 3) > 0 ? 'complete' : 'corrupt')
          )),
        };
      },
      assertCase: async ({ backups, keepLast, maxAgeDays }) => {
        const plan = planRetentionJob(inputFor(backups, keepLast, maxAgeDays));
        const completeIds = new Set(backups
          .filter((copy) => copy.state === 'complete')
          .map((copy) => copy.backupId));
        const deletedIds = new Set(plan.deleteCopies.map((copy) => copy.backupId));

        expect(plan.invalidPolicy).toBe(false);
        expect([...deletedIds].every((backupId) => completeIds.has(backupId))).toBe(true);
        expect([...completeIds].some((backupId) => !deletedIds.has(backupId))).toBe(true);
      },
    });
  });

  it('stays within nlogn complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'planRetentionJob',
      sizes: [250, 500, 1000],
      expected: 'nlogn',
      setup: (size) => inputFor(Array.from({ length: size }, (_, index) => backup(index))),
      run: async (input) => planRetentionJob(input),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'planRetentionJob',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => inputFor(Array.from({ length: 500 }, (_, index) => backup(index))),
      run: async (input) => planRetentionJob(input),
    });
  });
});
