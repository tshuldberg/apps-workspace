/**
 * Plan 39 P13: the abuse-scan matcher + the DURABLE file stores that back the legal pipelines
 * (a lost NCMEC record or DMCA notice is a lost legal obligation, so restart-survival is tested).
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HashSetAbuseScanner, UnavailableAbuseScanner } from '../abuse-scan';
import { NcmecReportQueue } from '../ncmec-queue';
import { FileNcmecReportQueueStore } from '../ncmec-queue-store-file';
import { DmcaIntakeService } from '../dmca-intake';
import { FileDmcaIntakeStore } from '../dmca-intake-store-file';

const tmpDirs: string[] = [];
async function tmpDir(): Promise<string> {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-legal-'));
  tmpDirs.push(d);
  return d;
}
afterEach(async () => { await Promise.all(tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true }))); });

describe('HashSetAbuseScanner', () => {
  it('matches known-bad hashes case-insensitively and reports clean otherwise', async () => {
    const s = new HashSetAbuseScanner(['AA'.repeat(32)]);
    expect((await s.scan(['aa'.repeat(32)])).matched).toEqual(['aa'.repeat(32)]);
    expect((await s.scan(['bb'.repeat(32)])).matched).toEqual([]);
    expect((await s.scan([])).matched).toEqual([]);
  });

  it('add() extends the known-bad set', async () => {
    const s = new HashSetAbuseScanner();
    expect(s.size).toBe(0);
    s.add(['cc'.repeat(32)]);
    expect(s.size).toBe(1);
    expect((await s.scan(['cc'.repeat(32)])).matched.length).toBe(1);
  });

  it('UnavailableAbuseScanner always throws (caller maps to fail-closed 503)', async () => {
    await expect(new UnavailableAbuseScanner().scan(['x'])).rejects.toThrow();
  });
});

describe('FileNcmecReportQueueStore durability', () => {
  it('an enqueued record + its status survive a fresh store over the same dir', async () => {
    const dir = await tmpDir();
    const q1 = new NcmecReportQueue(new FileNcmecReportQueueStore(dir));
    const rec = await q1.enqueueScanHit({ publicationId: 'p1', postId: 'a', matchedBlobHashes: ['ff'.repeat(32)] });
    await q1.exportQueued(); // marks it exported

    const q2 = new NcmecReportQueue(new FileNcmecReportQueueStore(dir));
    const list = await q2.list();
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe(rec.id);
    expect(list[0]!.status).toBe('exported');
    expect((await q2.counts()).exported).toBe(1);
  });

  it('idempotent enqueue does not duplicate across store instances', async () => {
    const dir = await tmpDir();
    await new NcmecReportQueue(new FileNcmecReportQueueStore(dir)).enqueueScanHit({ publicationId: 'p', postId: 'x', matchedBlobHashes: ['11'.repeat(32)] });
    await new NcmecReportQueue(new FileNcmecReportQueueStore(dir)).enqueueScanHit({ publicationId: 'p', postId: 'x', matchedBlobHashes: ['11'.repeat(32)] });
    expect((await new NcmecReportQueue(new FileNcmecReportQueueStore(dir)).counts()).total).toBe(1);
  });
});

describe('FileDmcaIntakeStore durability', () => {
  const claim = {
    workDescription: 'w', claimedPostIds: ['p1'], claimedUrls: [],
    claimant: { name: 'A', email: 'a@e.com', address: 'x' },
    goodFaithStatement: true as const, accuracyStatement: true as const, signature: 'A',
  };

  it('a persisted claim + its lifecycle status survive a fresh store over the same dir', async () => {
    const dir = await tmpDir();
    const s1 = new DmcaIntakeService(new FileDmcaIntakeStore(dir));
    const res = await s1.submitClaim(claim);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    await s1.recordTakedown(res.record.id, ['p1']);

    const s2 = new DmcaIntakeService(new FileDmcaIntakeStore(dir));
    const reloaded = await s2.getClaim(res.record.id);
    expect(reloaded?.status).toBe('actioned');
    expect(reloaded?.actionedPostIds).toEqual(['p1']);
    expect((await s2.listClaims()).length).toBe(1);
  });
});
