import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  OBJECT_STORE_MIN_PART_BYTES,
  ObjectStoreUnavailableError,
  toObjectStoreUnavailableError,
  type MeerkatObjectStore,
} from '../object-store';
import { InMemoryObjectStore } from '../object-store-memory';
import { FileObjectStore } from '../object-store-file';
import { HostedObjectStoreAdapter } from '../object-store-hosted-adapter';
import type { HostedObjectUploadTarget } from '../hosted-storage-metadata';
import { runStoreConformanceSuite } from '../postgres/conformance/store-conformance';
import { objectStoreScenarios, sha256Hex } from './object-store-conformance';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

async function fileStoreDir(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-object-store-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe.each([
  ['memory', async (): Promise<MeerkatObjectStore> => new InMemoryObjectStore()],
  ['file', async (): Promise<MeerkatObjectStore> => new FileObjectStore(await fileStoreDir())],
] as const)('MeerkatObjectStore %s conformance', (storeName, factory) => {
  it('passes every object-store conformance scenario against a fresh store', async () => {
    const result = await runStoreConformanceSuite<MeerkatObjectStore>({
      storeName,
      createStore: factory,
      scenarios: objectStoreScenarios,
    });
    expect(result.passedScenarios).toEqual(objectStoreScenarios.map((scenario) => scenario.name));
  });
});

describe('FileObjectStore durability and concurrency', () => {
  it('survives a restart with durable bytes and a monotonic version counter', async () => {
    const directory = await fileStoreDir();
    const first = new FileObjectStore(directory);
    const bytes = new Uint8Array(Buffer.from('durable across restart', 'utf8'));
    const put = await first.put({ key: 'quarantine/persist', checksumSha256: sha256Hex(bytes), bytes });
    expect(put.status).toBe('stored');
    if (put.status !== 'stored') return;
    await first.promote({
      quarantineKey: 'quarantine/persist',
      durableKey: 'durable/persist',
      expectedChecksumSha256: sha256Hex(bytes),
    });

    const reopened = new FileObjectStore(directory);
    const observed = await reopened.observe('durable/persist');
    expect(observed).toMatchObject({ state: 'durable', checksumSha256: sha256Hex(bytes) });
    // The bytes themselves survive the restart, read back from the on-disk object file.
    const read = await reopened.read('durable/persist');
    expect(read?.bytes).toEqual(bytes);
    await reopened.deleteObject('durable/persist');
    const rewrite = new Uint8Array(Buffer.from('a later generation', 'utf8'));
    const next = await reopened.put({
      key: 'durable/persist',
      checksumSha256: sha256Hex(rewrite),
      bytes: rewrite,
    });
    expect(next.status).toBe('stored');
    if (next.status !== 'stored') return;
    expect(next.object.versionId).not.toBe(observed?.versionId);
  });

  it('serializes concurrent writers to the same key so exactly one final object remains', async () => {
    const directory = await fileStoreDir();
    const writerA = new FileObjectStore(directory);
    const writerB = new FileObjectStore(directory);
    const bytesA = new Uint8Array(Buffer.from('writer A payload', 'utf8'));
    const bytesB = new Uint8Array(Buffer.from('writer B payload', 'utf8'));
    const [resultA, resultB] = await Promise.all([
      writerA.put({ key: 'quarantine/race', checksumSha256: sha256Hex(bytesA), bytes: bytesA }),
      writerB.put({ key: 'quarantine/race', checksumSha256: sha256Hex(bytesB), bytes: bytesB }),
    ]);
    expect(resultA.status).toBe('stored');
    expect(resultB.status).toBe('stored');
    const observed = await new FileObjectStore(directory).observe('quarantine/race');
    expect(observed?.state).toBe('quarantined');
    // The durable ledger holds exactly one object at the key, and its bytes are one of
    // the two writers' payloads (a whole object, never a torn interleave).
    const read = await new FileObjectStore(directory).read('quarantine/race');
    expect([sha256Hex(bytesA), sha256Hex(bytesB)]).toContain(read?.object.checksumSha256);
  });

  it('fails closed when the durable ledger is corrupt rather than reading an empty store', async () => {
    const directory = await fileStoreDir();
    await fs.writeFile(path.join(directory, 'object-store.json'), '{broken', 'utf8');
    await expect(new FileObjectStore(directory).observe('quarantine/x'))
      .rejects.toThrow('object ledger is corrupt');
  });

  it('stores bytes as individual object files, not inside the metadata ledger', async () => {
    const directory = await fileStoreDir();
    const store = new FileObjectStore(directory);
    const bytes = new Uint8Array(Buffer.from('a payload the ledger must not carry', 'utf8'));
    await store.put({ key: 'quarantine/on-disk', checksumSha256: sha256Hex(bytes), bytes });
    const ledgerText = await fs.readFile(path.join(directory, 'object-store.json'), 'utf8');
    // The ledger holds metadata only: the payload bytes never appear in it.
    expect(ledgerText).not.toContain(Buffer.from(bytes).toString('base64'));
    expect(ledgerText).not.toContain('a payload the ledger must not carry');
    const objectFiles = await fs.readdir(path.join(directory, 'objects'));
    expect(objectFiles).toHaveLength(1);
  });

  it('treats an orphan byte file with no ledger row as absent (WP-2C sweepable)', async () => {
    const directory = await fileStoreDir();
    const store = new FileObjectStore(directory);
    // Simulate a crash after the byte file landed but before the ledger referenced it.
    await fs.mkdir(path.join(directory, 'objects'), { recursive: true });
    await fs.writeFile(
      path.join(directory, 'objects', 'orphan-bytes'),
      Buffer.from('crashed-before-ledger', 'utf8'),
    );
    expect(await store.observe('quarantine/orphan')).toBeNull();
    const page = await store.listInventory({ limit: 100 });
    expect(page.entries).toHaveLength(0);
  });

  it('a crash between the delete ledger-write and the unlink leaves an orphan, never a dangling row', async () => {
    const directory = await fileStoreDir();
    const store = new FileObjectStore(directory);
    const bytes = new Uint8Array(Buffer.from('deletable across crash', 'utf8'));
    await store.put({ key: 'quarantine/crash-del', checksumSha256: sha256Hex(bytes), bytes });
    const objectFilesBefore = await fs.readdir(path.join(directory, 'objects'));
    expect(objectFilesBefore).toHaveLength(1);

    // Reproduce the post-crash state directly: the ledger row is gone (deleteObject
    // writes the ledger first) but the byte file has not yet been unlinked. This is the
    // exact window a crash between the two steps leaves behind.
    const ledgerPath = path.join(directory, 'object-store.json');
    const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8')) as {
      objects: Record<string, unknown>;
    };
    delete ledger.objects['quarantine/crash-del'];
    await fs.writeFile(ledgerPath, JSON.stringify(ledger), 'utf8');

    const reopened = new FileObjectStore(directory);
    // The object reads as absent (no dangling reference), and the leftover byte file is
    // a sweepable orphan that WP-2C reconciliation removes.
    expect(await reopened.observe('quarantine/crash-del')).toBeNull();
    expect((await reopened.listInventory({ limit: 100 })).entries).toHaveLength(0);
    expect(await fs.readdir(path.join(directory, 'objects'))).toHaveLength(1);
  });

  it('makes completeMultipart replay idempotent after the pending upload is consumed', async () => {
    const directory = await fileStoreDir();
    const store = new FileObjectStore(directory);
    const finalTail = new Uint8Array(Buffer.from('final replay tail', 'utf8'));
    const firstPart = new Uint8Array(OBJECT_STORE_MIN_PART_BYTES);
    firstPart.fill(9);
    const whole = new Uint8Array(firstPart.length + finalTail.length);
    whole.set(firstPart, 0);
    whole.set(finalTail, firstPart.length);
    const begun = await store.beginMultipart({
      key: 'quarantine/mp-replay',
      checksumSha256: sha256Hex(whole),
      sizeBytes: whole.length,
    });
    const parts = [
      { partNumber: 1, checksumSha256: sha256Hex(firstPart), sizeBytes: firstPart.length },
      { partNumber: 2, checksumSha256: sha256Hex(finalTail), sizeBytes: finalTail.length },
    ];
    expect((await store.appendPart({
      key: 'quarantine/mp-replay', uploadId: begun.uploadId, partNumber: 1,
      checksumSha256: parts[0]!.checksumSha256, bytes: firstPart,
    })).status).toBe('appended');
    expect((await store.appendPart({
      key: 'quarantine/mp-replay', uploadId: begun.uploadId, partNumber: 2,
      checksumSha256: parts[1]!.checksumSha256, bytes: finalTail,
    })).status).toBe('appended');
    const first = await store.completeMultipart({
      key: 'quarantine/mp-replay', uploadId: begun.uploadId, parts,
    });
    expect(first.status).toBe('stored');
    if (first.status !== 'stored') return;
    // The pending directory is gone; a replayed complete resolves to the same object.
    const replay = await store.completeMultipart({
      key: 'quarantine/mp-replay', uploadId: begun.uploadId, parts,
    });
    expect(replay.status).toBe('stored');
    if (replay.status !== 'stored') return;
    expect(replay.object.versionId).toBe(first.object.versionId);
    expect(replay.object.checksumSha256).toBe(sha256Hex(whole));
  });
});

describe('ObjectStoreUnavailableError', () => {
  it('types a backing-store fault distinctly and never as absence', () => {
    const cause = new Error('connection reset');
    const error = toObjectStoreUnavailableError('observe', cause);
    expect(error).toBeInstanceOf(ObjectStoreUnavailableError);
    expect(error.code).toBe('object_store_unavailable');
    expect(error.operation).toBe('observe');
    expect(error.cause).toBe(cause);
    // Passing an already-wrapped error through returns it unchanged.
    expect(toObjectStoreUnavailableError('read', error)).toBe(error);
  });
});

describe('HostedObjectStoreAdapter compatibility', () => {
  const presignedTarget: HostedObjectUploadTarget = {
    objectKey: 'quarantine/hosted',
    method: 'PUT',
    url: 'https://example.invalid/presigned',
    headers: {},
    expiresAt: '2026-07-10T13:00:00.000Z',
    fencingToken: 7,
  };

  it('projects observeObject and deleteObject from a MeerkatObjectStore for the metadata flow', async () => {
    const store = new InMemoryObjectStore();
    const adapter = new HostedObjectStoreAdapter(store, {
      createUploadTarget: async () => presignedTarget,
    });
    const bytes = new Uint8Array(Buffer.from('hosted payload', 'utf8'));
    const put = await store.put({ key: 'quarantine/hosted', checksumSha256: sha256Hex(bytes), bytes });
    expect(put.status).toBe('stored');
    if (put.status !== 'stored') return;

    const observation = await adapter.observeObject('quarantine/hosted');
    expect(observation).toEqual({
      objectKey: 'quarantine/hosted',
      checksum: sha256Hex(bytes),
      sizeBytes: bytes.length,
      versionId: put.object.versionId,
    });

    const target = await adapter.createUploadTarget({
      objectKey: 'quarantine/hosted',
      checksum: sha256Hex(bytes),
      sizeBytes: bytes.length,
      fencingToken: 7,
      expiresAt: presignedTarget.expiresAt,
    });
    expect(target).toBe(presignedTarget);

    const receipt = await adapter.deleteObject({
      objectKey: 'quarantine/hosted',
      versionId: put.object.versionId,
    });
    expect(receipt).toEqual({
      objectKey: 'quarantine/hosted',
      versionId: put.object.versionId,
      deleted: true,
    });
    expect(await store.observe('quarantine/hosted')).toBeNull();
  });

  it('reports a rejected object as absent so it can never satisfy a fenced commit', async () => {
    const store = new InMemoryObjectStore();
    const adapter = new HostedObjectStoreAdapter(store, {
      createUploadTarget: async () => presignedTarget,
    });
    const bytes = new Uint8Array(Buffer.from('rejected payload', 'utf8'));
    const put = await store.put({
      key: 'quarantine/rejected',
      checksumSha256: sha256Hex(new Uint8Array(Buffer.from('wrong', 'utf8'))),
      bytes,
    });
    expect(put.status).toBe('checksum_mismatch');
    expect(await adapter.observeObject('quarantine/rejected')).toBeNull();
  });
});
