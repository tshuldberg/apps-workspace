import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ObjectReferenceLedgerUnavailableError,
  toObjectReferenceLedgerUnavailableError,
  type ObjectReferenceLedger,
} from '../object-reference-ledger';
import { InMemoryObjectReferenceLedger } from '../object-reference-ledger-memory';
import { FileObjectReferenceLedger } from '../object-reference-ledger-file';
import { runStoreConformanceSuite } from '../postgres/conformance/store-conformance';
import { objectReferenceLedgerScenarios } from './object-reference-ledger-conformance';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

async function ledgerDir(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-ref-ledger-'));
  temporaryDirectories.push(directory);
  return directory;
}

// A monotonic clock so unreferencedAt values are distinct and ordering is deterministic.
function fixedClock(): () => number {
  let tick = 1_000;
  return () => (tick += 1);
}

describe.each([
  ['memory', async (): Promise<ObjectReferenceLedger> => new InMemoryObjectReferenceLedger(undefined, fixedClock())],
  ['file', async (): Promise<ObjectReferenceLedger> => new FileObjectReferenceLedger(await ledgerDir(), fixedClock())],
] as const)('ObjectReferenceLedger %s conformance', (storeName, factory) => {
  it('passes every reference-ledger conformance scenario against a fresh store', async () => {
    const result = await runStoreConformanceSuite<ObjectReferenceLedger>({
      storeName,
      createStore: factory,
      scenarios: objectReferenceLedgerScenarios,
    });
    expect(result.passedScenarios).toEqual(objectReferenceLedgerScenarios.map((scenario) => scenario.name));
  });
});

describe('FileObjectReferenceLedger durability and concurrency', () => {
  it('survives a restart with the reference set intact', async () => {
    const directory = await ledgerDir();
    const first = new FileObjectReferenceLedger(directory);
    await first.addReference({ objectKey: 'objects/persist', referrer: 'hosted:s c 0' });
    await first.addReference({ objectKey: 'objects/persist', referrer: 'archive:j 0' });
    const reopened = new FileObjectReferenceLedger(directory);
    await expect(reopened.referenceCount('objects/persist')).resolves.toBe(2);
    await expect(reopened.listReferrers('objects/persist'))
      .resolves.toEqual(['archive:j 0', 'hosted:s c 0']);
  });

  it('serializes concurrent adders so a key with two distinct referrers counts two', async () => {
    const directory = await ledgerDir();
    const a = new FileObjectReferenceLedger(directory);
    const b = new FileObjectReferenceLedger(directory);
    await Promise.all([
      a.addReference({ objectKey: 'objects/race', referrer: 'ref-a' }),
      b.addReference({ objectKey: 'objects/race', referrer: 'ref-b' }),
    ]);
    await expect(new FileObjectReferenceLedger(directory).referenceCount('objects/race')).resolves.toBe(2);
  });

  it('fails closed on a corrupt ledger rather than reading an empty register', async () => {
    const directory = await ledgerDir();
    await fs.writeFile(path.join(directory, 'object-reference-ledger.json'), '{broken', 'utf8');
    await expect(new FileObjectReferenceLedger(directory).referenceCount('objects/x'))
      .rejects.toThrow(ObjectReferenceLedgerUnavailableError);
  });
});

describe('ObjectReferenceLedgerUnavailableError', () => {
  it('types a backing fault distinctly and passes an already-wrapped error through', () => {
    const cause = new Error('connection reset');
    const error = toObjectReferenceLedgerUnavailableError('add reference', cause);
    expect(error).toBeInstanceOf(ObjectReferenceLedgerUnavailableError);
    expect(error.code).toBe('object_reference_ledger_unavailable');
    expect(error.operation).toBe('add reference');
    expect(toObjectReferenceLedgerUnavailableError('remove reference', error)).toBe(error);
  });
});
