/**
 * Host archive moderation queue (Plan 19 P9.3c/d).
 *
 * The authoritative review queue for durable-pin candidates. A candidate is pinned
 * (cap-enforced, by the seeder) and submitted here as `pending`. The host then runs
 * a REAL abuse-hash + malware/AV scan via the injected scan hook (deployed at scale
 * as Tier-D ops). Only a `clean` result transitions the candidate to `approved` --
 * the ONLY state in which the content may be served openly and announced to the
 * public directory. A `malware` / `abuse_hash_match` / `flagged` result rejects it:
 * it is NOT served and NOT announced (TC-10).
 *
 * Honesty: serving + announcing are gated on a REAL scan result. Between submit and
 * a real result the state is `pending`/`scanning` and the content is neither served
 * nor announced -- the publisher + reader see "scanning..." until a real `clean`
 * comes back, never a fabricated badge.
 */

export type ArchiveScanResult = 'clean' | 'malware' | 'abuse_hash_match' | 'flagged';

export type ArchiveModerationState = 'pending' | 'scanning' | 'approved' | 'rejected';

export interface ArchiveCandidate {
  publicationId: string;
  contentId: string;
}

export interface ArchiveModerationEntry extends ArchiveCandidate {
  state: ArchiveModerationState;
  scanResult: ArchiveScanResult | 'unscanned';
  /** ISO time the scan result was decided, or null while pending/scanning. */
  decidedAt: string | null;
}

/** The REAL scan: abuse-hash + malware/AV over the candidate's content. Injected
 * (deployed scanner is Tier-D ops); a deterministic result is injected in tests. */
export type ArchiveScanHook = (
  candidate: ArchiveCandidate,
) => ArchiveScanResult | Promise<ArchiveScanResult>;

export interface ArchiveModerationQueueOptions {
  now?: () => number;
}

export class ArchiveModerationQueue {
  private readonly entries = new Map<string, ArchiveModerationEntry>();
  private readonly now: () => number;

  constructor(options: ArchiveModerationQueueOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  /** Enter a durable-pin candidate into review. Pending + unscanned: not yet served. */
  submit(candidate: ArchiveCandidate): ArchiveModerationEntry {
    const existing = this.entries.get(candidate.publicationId);
    if (existing) return existing;
    const entry: ArchiveModerationEntry = {
      publicationId: candidate.publicationId,
      contentId: candidate.contentId,
      state: 'pending',
      scanResult: 'unscanned',
      decidedAt: null,
    };
    this.entries.set(candidate.publicationId, entry);
    return entry;
  }

  /**
   * Run the REAL scan hook for a submitted candidate. Marks it `scanning` (so it is
   * still NOT served), awaits the hook, then approves on `clean` or rejects on any
   * abuse/malware/flagged result. Returns the decided entry.
   */
  async scan(publicationId: string, hook: ArchiveScanHook): Promise<ArchiveModerationEntry> {
    const entry = this.entries.get(publicationId);
    if (!entry) throw new Error(`ArchiveModerationQueue: unknown candidate ${publicationId}`);
    entry.state = 'scanning';
    const result = await hook({ publicationId: entry.publicationId, contentId: entry.contentId });
    entry.scanResult = result;
    entry.state = result === 'clean' ? 'approved' : 'rejected';
    entry.decidedAt = new Date(this.now()).toISOString();
    return entry;
  }

  state(publicationId: string): ArchiveModerationEntry | null {
    return this.entries.get(publicationId) ?? null;
  }

  /** Served openly ONLY when a real clean scan approved it (TC-10). */
  isServeable(publicationId: string): boolean {
    return this.entries.get(publicationId)?.state === 'approved';
  }

  /** Announced to the public directory ONLY when approved (announce-on-approve). */
  isAnnounceable(publicationId: string): boolean {
    return this.isServeable(publicationId);
  }

  /** Drop a candidate on owner takedown / DescriptorKill (no longer serveable). */
  remove(publicationId: string): void {
    this.entries.delete(publicationId);
  }
}
