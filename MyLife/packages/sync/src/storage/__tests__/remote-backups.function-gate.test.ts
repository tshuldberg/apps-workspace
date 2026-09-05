import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { remoteBackupObjectId, remoteBackupPrefix } from '../remote-backups';

describe('remoteBackupObjectId function quality gate', () => {
  it('creates deterministic provider-safe ids and rejects unsafe paths', () => {
    const objectId = remoteBackupObjectId('backup-1', 'database/000000.mkchunk');

    expect(objectId).toBe(remoteBackupObjectId('backup-1', 'database/000000.mkchunk'));
    expect(objectId).toMatch(/^[A-Za-z0-9._-]+$/u);
    expect(objectId.startsWith(remoteBackupPrefix('backup-1'))).toBe(true);
    expect(() => remoteBackupObjectId('backup-1', '')).toThrow('backup object path is invalid');
    expect(() => remoteBackupObjectId('backup-1', 'bad\npath')).toThrow('backup object path is invalid');
  });

  it('passes deterministic path fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'remoteBackupObjectId fuzz',
      iterations: 200,
      seed: 41,
      makeCase: (rng, index) => ({
        backupId: `backup-${index}-${randomInt(rng, 0, 1_000_000)}`,
        logicalPath: `database/${'x'.repeat(randomInt(rng, 1, 500))}.mkchunk`,
      }),
      assertCase: async ({ backupId, logicalPath }) => {
        const first = remoteBackupObjectId(backupId, logicalPath);
        const second = remoteBackupObjectId(backupId, `${logicalPath}.next`);

        expect(first).toBe(remoteBackupObjectId(backupId, logicalPath));
        expect(first).not.toBe(second);
        expect(first.startsWith(remoteBackupPrefix(backupId))).toBe(true);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'remoteBackupObjectId',
      sizes: [512, 1024, 2048],
      expected: 'linear',
      setup: (size) => `database/${'x'.repeat(size)}.mkchunk`,
      run: async (logicalPath) => {
        for (let iteration = 0; iteration < 25; iteration += 1) {
          remoteBackupObjectId('quality-backup', logicalPath);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'remoteBackupObjectId',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => `database/${'x'.repeat(1000)}.mkchunk`,
      run: async (logicalPath) => remoteBackupObjectId('quality-backup', logicalPath),
    });
  });
});
