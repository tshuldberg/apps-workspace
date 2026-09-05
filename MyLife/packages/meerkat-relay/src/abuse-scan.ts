/**
 * CSAM / abuse hash-scan SEAM for the PUBLIC-post submit boundary (Plan 39 P13).
 *
 * Every attachment blob accepted by the gated public submit route is matched against a
 * known-bad hash set BEFORE the node countersigns + appends it (community-node.ts). This is
 * the same honesty posture as the archive-moderation scan rail (Plan 19 P9): a real result
 * gates acceptance, an unconfigured/unreachable scanner is reported honestly and FAILS CLOSED
 * for media posts. Text-only posts (no attachments) never touch the scanner.
 *
 * The scanner is a pure hash-set matcher interface: given the attachment blob hashes, it
 * returns which are known-bad. The REAL vendor hash DB (NCMEC / industry hash lists) is
 * founder-ops (Plan 39 P15); this seam never fabricates a clean verdict. A matcher that
 * throws / rejects is treated by the caller as `scanner_unavailable` (never an admit).
 *
 * NC-P1: this rail exists ONLY on the published_blob / public-post path. The private mesh
 * tier is never scanned (no account, no server, no scanner).
 */

/** The outcome the submit boundary needs: which of the supplied blob hashes are known-bad. */
export interface BlobScanMatch {
  /** Subset of the input hashes present in the known-bad set (lowercased). Empty => clean. */
  readonly matched: readonly string[];
}

/**
 * Hash-set matcher seam. A real deployment injects a matcher backed by the founder-provisioned
 * CSAM/abuse hash DB. Contract: resolve with the matched subset for a completed scan; REJECT
 * (throw) ONLY on a genuine scanner outage -- the caller maps a rejection to fail-closed
 * `scanner_unavailable`, never a silent accept.
 */
export interface AbuseHashScanner {
  scan(blobHashes: readonly string[]): Promise<BlobScanMatch>;
}

/** The node's honest report of its scanner posture (surfaced in the ready log + status). */
export type AbuseScannerState = 'configured' | 'not_configured';

/**
 * In-memory hash-set matcher: matches supplied blob hashes against a static known-bad set.
 * Used by tests and by a self-host node seeded with a local hash list. Case-insensitive.
 * This is a REAL matcher (no fabrication): an empty set legitimately matches nothing, and
 * the node still reports itself `configured` because a scan genuinely runs.
 */
export class HashSetAbuseScanner implements AbuseHashScanner {
  private readonly known: Set<string>;

  constructor(knownBadHashes: Iterable<string> = []) {
    this.known = new Set([...knownBadHashes].map((h) => h.trim().toLowerCase()).filter(Boolean));
  }

  /** Add hashes to the known-bad set (e.g. a founder-ops hash-DB refresh). */
  add(hashes: Iterable<string>): void {
    for (const h of hashes) {
      const norm = h.trim().toLowerCase();
      if (norm) this.known.add(norm);
    }
  }

  get size(): number {
    return this.known.size;
  }

  async scan(blobHashes: readonly string[]): Promise<BlobScanMatch> {
    const matched: string[] = [];
    for (const raw of blobHashes) {
      const norm = raw.trim().toLowerCase();
      if (norm && this.known.has(norm)) matched.push(norm);
    }
    return { matched };
  }
}

/**
 * A scanner that ALWAYS fails (rejects). A deploy uses this as an explicit placeholder before
 * the real hash DB lands so the node stays `configured`-shaped yet every media submit is
 * honestly refused `scanner_unavailable` (fail closed) rather than silently accepted. Never
 * used to fake a clean verdict.
 */
export class UnavailableAbuseScanner implements AbuseHashScanner {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async scan(_blobHashes: readonly string[]): Promise<BlobScanMatch> {
    throw new Error('abuse_scanner_unavailable');
  }
}
