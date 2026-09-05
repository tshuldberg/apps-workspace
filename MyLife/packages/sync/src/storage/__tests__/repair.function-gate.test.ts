import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { StorageDestinationRow, StorageObjectRow } from '../schema';
import { planRepairJob, type PlanRepairJobInput } from '../repair';

const NOW = '2026-07-14T12:00:00.000Z';

function destination(id: string, kind: StorageDestinationRow['kind']): StorageDestinationRow {
  return {
    id,
    kind,
    label: id,
    account_hint: null,
    credential_ref: null,
    root_ref: null,
    state: 'ready',
    capability_json: '{}',
    created_at: NOW,
    updated_at: NOW,
  };
}

function objectRow(
  objectId: string,
  destinationId: string,
  state: StorageObjectRow['state'],
): StorageObjectRow {
  return {
    object_id: objectId,
    destination_id: destinationId,
    data_class: 'sqlite_snapshot',
    ciphertext_hash: `hash-${objectId}`,
    plaintext_hash_encrypted: null,
    encrypted_bytes: objectId.length,
    remote_ref: state === 'verified' ? `memory://${destinationId}/${objectId}` : null,
    remote_version: state === 'verified' ? 'v1' : null,
    state,
    last_verified_at: state === 'verified' ? NOW : null,
  };
}

function repairInput(size: number, includeEverySource = true): PlanRepairJobInput {
  const targets = Array.from({ length: size }, (_, index) => (
    objectRow(`object-${index}`, `target-${index}`, 'missing')
  ));
  const sources = targets.flatMap((target, index) => (
    includeEverySource || index % 2 === 0
      ? [objectRow(target.object_id, 'local-source', 'verified')]
      : []
  ));
  return {
    objects: [...targets, ...sources],
    destinations: [
      destination('local-source', 'local_device'),
      ...targets.map((_, index) => destination(`target-${index}`, 's3')),
    ],
  };
}

describe('planRepairJob function quality gate', () => {
  it('prefers a verified local source over a verified remote mirror', () => {
    const target = objectRow('chunk', 'target', 'missing');
    const mirror = objectRow('chunk', 'mirror', 'verified');
    const local = objectRow('chunk', 'local', 'verified');
    const plan = planRepairJob({
      objects: [target, mirror, local],
      destinations: [
        destination('target', 's3'),
        destination('mirror', 'google_drive'),
        destination('local', 'local_device'),
      ],
    });

    expect(plan.items).toEqual([{ object: target, source: local }]);
    expect(plan.impossible).toEqual([]);
  });

  it('passes deterministic repair-plan fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'planRepairJob fuzz',
      iterations: 200,
      seed: 41,
      makeCase: (rng) => repairInput(randomInt(rng, 1, 60), randomInt(rng, 0, 1) === 1),
      assertCase: async (input) => {
        const targets = input.objects.filter((row) => row.state === 'missing' || row.state === 'error');
        const plan = planRepairJob(input);

        expect(plan.items.length + plan.impossible.length).toBe(targets.length);
        expect(plan.items.every(({ object, source }) => (
          source.state === 'verified'
          && source.object_id === object.object_id
          && source.ciphertext_hash === object.ciphertext_hash
          && source.destination_id !== object.destination_id
        ))).toBe(true);
      },
    });
  });

  it('stays within nlogn complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'planRepairJob',
      sizes: [250, 500, 1000],
      expected: 'nlogn',
      setup: repairInput,
      run: async (input) => planRepairJob(input),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'planRepairJob',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => repairInput(500),
      run: async (input) => planRepairJob(input),
    });
  });
});
