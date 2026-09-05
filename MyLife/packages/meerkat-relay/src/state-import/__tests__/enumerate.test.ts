import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileNcmecReportQueueStore } from '../../ncmec-queue-store-file';
import { FileDmcaIntakeStore } from '../../dmca-intake-store-file';
import { FileObjectDeletionJobStore } from '../../object-deletion-jobs-file';
import type { NcmecReportRecord } from '../../ncmec-queue';
import { fileEnumerator, type StateServiceRoots } from '../enumerate-file';
import { computeStoreDigest } from '../digest';

async function drain(roots: StateServiceRoots, storeId: Parameters<typeof fileEnumerator>[0]) {
  const records = [];
  for await (const record of fileEnumerator(storeId, roots).enumerate()) records.push(record);
  return records;
}

describe('file enumerators', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-state-import-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('scans hex-named descriptor revisions completely', async () => {
    const dir = path.join(root, 'community', 'descriptors');
    await fs.mkdir(dir, { recursive: true });
    const hex = (id: string) => Buffer.from(id, 'utf8').toString('hex');
    await fs.writeFile(path.join(dir, `${hex('c1')}.rev.json`),
      JSON.stringify({ revision: 5, descriptorHash: 'a'.repeat(128) }));
    await fs.writeFile(path.join(dir, `${hex('c2')}.rev.json`),
      JSON.stringify({ revision: 2, descriptorHash: 'b'.repeat(128) }));

    const records = await drain({ community: path.join(root, 'community') }, 'community.descriptor-revisions');
    expect(records.map((r) => r.identity[0]).sort()).toEqual(['c1', 'c2']);
    const build = await computeStoreDigest(
      fileEnumerator('community.descriptor-revisions', { community: path.join(root, 'community') }),
      'file',
    );
    expect(build.digest.count).toBe(2);
    expect(build.digest.salient.highestRevision).toBe(5);
  });

  it('enumerates the NCMEC gap store by a direct dir scan, ignoring order.log', async () => {
    const base = path.join(root, 'community', 'ncmec-queue');
    const store = new FileNcmecReportQueueStore(base);
    const record: NcmecReportRecord = {
      id: 'a'.repeat(64),
      source: 'submit_scan',
      detectedAt: '2026-01-01T00:00:00.000Z',
      publicationId: 'pub-1',
      reason: 'csam-match',
      status: 'queued',
    };
    await store.enqueue(record);
    // Corrupt order.log to prove the enumerator does NOT rely on it.
    await fs.writeFile(path.join(base, 'order.log'), '');

    const records = await drain({ community: path.join(root, 'community') }, 'moderation.ncmec-reports');
    expect(records).toHaveLength(1);
    expect(records[0]!.identity).toEqual(['a'.repeat(64)]);
  });

  it('enumerates the DMCA gap store by a direct dir scan', async () => {
    const base = path.join(root, 'community', 'dmca-intake');
    const store = new FileDmcaIntakeStore(base);
    // The File adapter validates only the id regex on create; a minimal record with a
    // 64-hex id is enough to prove the direct dir-scan enumerator finds every claim.
    const created = await store.create({
      id: 'c'.repeat(64),
      receivedAt: '2026-02-02T00:00:00.000Z',
      status: 'received',
      lifecycleVersion: 1,
    } as unknown as Parameters<typeof store.create>[0]);
    expect(created.id).toBe('c'.repeat(64));

    const records = await drain({ community: path.join(root, 'community') }, 'moderation.dmca-claims');
    expect(records.map((r) => r.identity[0])).toEqual(['c'.repeat(64)]);
  });

  it('enumerates the object-deletion ledger completely', async () => {
    const base = path.join(root, 'community', 'object-deletion');
    const store = new FileObjectDeletionJobStore(base);
    await store.enqueue('objects/abc', 1000);
    await store.enqueue('objects/def', 2000);

    const records = await drain({ community: path.join(root, 'community') }, 'ops.object-deletion-jobs');
    expect(records.map((r) => r.identity[0]).sort()).toEqual(['objects/abc', 'objects/def']);
    expect(records.every((r) => (r.digestPayload as { state: string }).state === 'pending')).toBe(true);
  });

  it('yields nothing for an empty tree without throwing', async () => {
    const records = await drain({ community: path.join(root, 'community') }, 'community.publications');
    expect(records).toHaveLength(0);
  });

  it('errors clearly when a required source root is missing', async () => {
    await expect(drain({}, 'humanity.spent-tokens')).rejects.toThrow(/humanity-dir|humanity/);
  });
});
