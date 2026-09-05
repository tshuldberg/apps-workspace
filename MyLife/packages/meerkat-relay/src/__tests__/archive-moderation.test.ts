/**
 * Plan 19 P9.3c/d -- host archive moderation queue (scan-hook seam).
 *
 * A durable-pin candidate enters the host review queue (pending). The host runs a
 * REAL abuse-hash + malware/AV scan hook (injected here, deployed at scale as Tier-D
 * ops). Only a `clean` result transitions the candidate to `approved` -- the ONLY
 * state in which the content is served + announced. A malware / abuse_hash_match /
 * flagged result rejects it: NOT served, NOT announced (TC-10). The scan STATE is
 * honest: serving + announcing are false until a REAL clean result returns -- never
 * a fabricated "clean".
 */

import { describe, it, expect } from 'vitest';
import {
  ArchiveModerationQueue,
  type ArchiveScanResult,
} from '../archive-moderation';

const PUB = 'pub-1';
const CID = 'content-abc';

function queue(): ArchiveModerationQueue {
  let t = Date.parse('2026-06-30T00:00:00.000Z');
  return new ArchiveModerationQueue({ now: () => (t += 1000) });
}

describe('ArchiveModerationQueue', () => {
  it('a submitted candidate is pending + unscanned and is NOT served or announced (honest scan state)', () => {
    const q = queue();
    const entry = q.submit({ publicationId: PUB, contentId: CID });
    expect(entry.state).toBe('pending');
    expect(entry.scanResult).toBe('unscanned');
    expect(entry.decidedAt).toBeNull();
    // TC-10: nothing is served or announced before a real scan result.
    expect(q.isServeable(PUB)).toBe(false);
    expect(q.isAnnounceable(PUB)).toBe(false);
  });

  it('a clean scan approves the candidate -> served + announced', async () => {
    const q = queue();
    q.submit({ publicationId: PUB, contentId: CID });
    const decided = await q.scan(PUB, () => 'clean');
    expect(decided.state).toBe('approved');
    expect(decided.scanResult).toBe('clean');
    expect(decided.decidedAt).not.toBeNull();
    expect(q.isServeable(PUB)).toBe(true);
    expect(q.isAnnounceable(PUB)).toBe(true);
  });

  it('a malware / abuse_hash_match / flagged scan rejects the candidate -> NOT served, NOT announced (TC-10)', async () => {
    for (const result of ['malware', 'abuse_hash_match', 'flagged'] as ArchiveScanResult[]) {
      const q = queue();
      q.submit({ publicationId: PUB, contentId: CID });
      const decided = await q.scan(PUB, () => result);
      expect(decided.state).toBe('rejected');
      expect(decided.scanResult).toBe(result);
      expect(q.isServeable(PUB)).toBe(false);
      expect(q.isAnnounceable(PUB)).toBe(false);
    }
  });

  it('never serves or announces while the scan is in flight (scanning state)', async () => {
    const q = queue();
    q.submit({ publicationId: PUB, contentId: CID });
    let resolveScan: (r: ArchiveScanResult) => void = () => {};
    const pending = new Promise<ArchiveScanResult>((r) => {
      resolveScan = r;
    });
    const scanPromise = q.scan(PUB, () => pending);
    // Mid-scan: the host has marked it scanning but has NO real result yet.
    expect(q.state(PUB)!.state).toBe('scanning');
    expect(q.isServeable(PUB)).toBe(false);
    expect(q.isAnnounceable(PUB)).toBe(false);
    resolveScan('clean');
    await scanPromise;
    expect(q.isServeable(PUB)).toBe(true);
  });

  it('is unknown / not serveable for an un-submitted publication, and removable on takedown', async () => {
    const q = queue();
    expect(q.state('nope')).toBeNull();
    expect(q.isServeable('nope')).toBe(false);

    q.submit({ publicationId: PUB, contentId: CID });
    await q.scan(PUB, () => 'clean');
    expect(q.isServeable(PUB)).toBe(true);
    q.remove(PUB);
    expect(q.state(PUB)).toBeNull();
    expect(q.isServeable(PUB)).toBe(false); // taken-down content is no longer serveable
  });
});
