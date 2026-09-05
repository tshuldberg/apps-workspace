import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ObjectDeletionJobUnavailableError,
  toObjectDeletionJobUnavailableError,
  type ObjectDeletionJobStore,
} from '../object-deletion-jobs';
import { InMemoryObjectDeletionJobStore } from '../object-deletion-jobs-memory';
import { FileObjectDeletionJobStore } from '../object-deletion-jobs-file';
import { runStoreConformanceSuite } from '../postgres/conformance/store-conformance';
import { objectDeletionJobScenarios } from './object-deletion-jobs-conformance';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

async function jobsDir(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-del-jobs-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe.each([
  ['memory', async (): Promise<ObjectDeletionJobStore> => new InMemoryObjectDeletionJobStore()],
  ['file', async (): Promise<ObjectDeletionJobStore> => new FileObjectDeletionJobStore(await jobsDir())],
] as const)('ObjectDeletionJobStore %s conformance', (storeName, factory) => {
  it('passes every deletion-job conformance scenario against a fresh store', async () => {
    const result = await runStoreConformanceSuite<ObjectDeletionJobStore>({
      storeName,
      createStore: factory,
      scenarios: objectDeletionJobScenarios,
    });
    expect(result.passedScenarios).toEqual(objectDeletionJobScenarios.map((scenario) => scenario.name));
  });
});

describe('FileObjectDeletionJobStore durability and concurrency', () => {
  it('survives a restart with a leased job whose fence is preserved', async () => {
    const directory = await jobsDir();
    const first = new FileObjectDeletionJobStore(directory);
    await first.enqueue('objects/persist', 1_000);
    const [lease] = await first.claim({ owner: 'worker', limit: 1, leaseMs: 60_000, nowMs: 1_000 });

    const reopened = new FileObjectDeletionJobStore(directory);
    const job = await reopened.getJob('objects/persist');
    expect(job).toMatchObject({ state: 'leased', attempt: 1 });
    // The reopened store still honors the same lease fence.
    await expect(reopened.complete({ lease: lease!, versionId: 'v1', nowMs: 2_000 }))
      .resolves.toMatchObject({ status: 'committed' });
  });

  it('lets exactly one of two racing workers win a due job', async () => {
    const directory = await jobsDir();
    const a = new FileObjectDeletionJobStore(directory);
    const b = new FileObjectDeletionJobStore(directory);
    await a.enqueue('objects/race', 1_000);
    const [claimedA, claimedB] = await Promise.all([
      a.claim({ owner: 'a', limit: 1, leaseMs: 60_000, nowMs: 1_000 }),
      b.claim({ owner: 'b', limit: 1, leaseMs: 60_000, nowMs: 1_000 }),
    ]);
    expect(claimedA.length + claimedB.length).toBe(1);
  });

  it('fails closed on a corrupt ledger rather than losing a poison finding', async () => {
    const directory = await jobsDir();
    await fs.writeFile(path.join(directory, 'object-deletion-jobs.json'), '{broken', 'utf8');
    await expect(new FileObjectDeletionJobStore(directory).getJob('objects/x'))
      .rejects.toThrow(ObjectDeletionJobUnavailableError);
  });
});

describe('ObjectDeletionJobUnavailableError', () => {
  it('types a backing fault distinctly and passes an already-wrapped error through', () => {
    const cause = new Error('disk full');
    const error = toObjectDeletionJobUnavailableError('enqueue', cause);
    expect(error).toBeInstanceOf(ObjectDeletionJobUnavailableError);
    expect(error.code).toBe('object_deletion_job_unavailable');
    expect(error.operation).toBe('enqueue');
    expect(toObjectDeletionJobUnavailableError('claim', error)).toBe(error);
  });
});
