import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StateEnumerator, StateRecord, StateStoreId } from './model';
import { STATE_STORE_DESCRIPTORS, type StateServiceRoot } from './stores';

/**
 * File-backend enumerators. Each reads the File adapter's on-disk layout
 * DIRECTLY (a documented directory scan or ledger read), never through a store
 * read method whose default limits or ordering would miss records. Every
 * enumerator's `guarantee` states exactly how it achieves completeness.
 *
 * The digest payload each enumerator emits is normalized to the SEMANTIC record
 * (see per-store notes) so the file and PostgreSQL sides hash identically for an
 * identical record. The `record` field carries the native file object for the
 * importer.
 */

/** Roots resolved from the CLI: absolute path for each service data-dir. */
export type StateServiceRoots = Partial<Record<StateServiceRoot, string>>;

function requireRoot(roots: StateServiceRoots, root: StateServiceRoot, storeId: StateStoreId): string {
  const value = roots[root];
  if (!value) {
    throw new Error(`Missing --${root}-dir (source data dir) required for store ${storeId}`);
  }
  return value;
}

/** Directory of the File adapter for a store, honoring its named subdir. */
function storeDir(roots: StateServiceRoots, storeId: StateStoreId): string {
  const descriptor = STATE_STORE_DESCRIPTORS[storeId];
  const root = requireRoot(roots, descriptor.serviceRoot, storeId);
  return descriptor.fileSubdir ? path.join(root, descriptor.fileSubdir) : root;
}

async function readdirSafe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function hexToUtf8(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}

/** Files named {hex(id)}.{suffix}.json; returns [id, absolutePath] pairs. */
async function hexNamedFiles(dir: string, suffix: string): Promise<Array<[string, string]>> {
  const ending = `.${suffix}.json`;
  const out: Array<[string, string]> = [];
  for (const name of await readdirSafe(dir)) {
    if (!name.endsWith(ending)) continue;
    const hex = name.slice(0, -ending.length);
    if (!/^[0-9a-f]*$/.test(hex) || hex.length % 2 !== 0) continue;
    out.push([hexToUtf8(hex), path.join(dir, name)]);
  }
  return out;
}

type FileEnumerate = (roots: StateServiceRoots) => AsyncIterable<StateRecord>;

function makeEnumerator(
  storeId: StateStoreId,
  guarantee: string,
  enumerate: FileEnumerate,
  roots: StateServiceRoots,
): StateEnumerator {
  return {
    storeId,
    completeness: 'complete',
    guarantee,
    enumerate: () => enumerate(roots),
  };
}

// --- Per-store file enumerators --------------------------------------------

const enumerators: Record<StateStoreId, { guarantee: string; run: FileEnumerate }> = {
  'community.descriptor-revisions': {
    guarantee: 'Full scan of every *.rev.json in the descriptors dir.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'community.descriptor-revisions');
      for (const [communityId, file] of await hexNamedFiles(dir, 'rev')) {
        const body = await readJson<{ revision: number; descriptorHash: string }>(file);
        if (!body || typeof body.revision !== 'number' || typeof body.descriptorHash !== 'string') continue;
        yield {
          identity: [communityId],
          digestPayload: { revision: body.revision, descriptorHash: body.descriptorHash },
          record: { communityId, revision: body.revision, descriptorHash: body.descriptorHash },
        };
      }
    },
  },
  'community.publications': {
    guarantee: 'Full scan of every *.pub.json in the publications dir.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'community.publications');
      for (const [publicationId, file] of await hexNamedFiles(dir, 'pub')) {
        const record = await readJson<unknown>(file);
        if (!record || typeof record !== 'object') continue;
        yield { identity: [publicationId], digestPayload: record, record: { publicationId, record } };
      }
    },
  },
  'community.kills': {
    guarantee: 'Full scan of every *.kill.json in the community kills dir.',
    run: killEnumerator('community.kills'),
  },
  'community.reports': {
    guarantee: 'Full scan of every *.reports.json; one record per report in each list.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'community.reports');
      for (const [publicationId, file] of await hexNamedFiles(dir, 'reports')) {
        const list = await readJson<Array<{ report?: { reason?: string }; signature?: string }>>(file);
        if (!Array.isArray(list)) continue;
        for (const report of list) {
          const key = reportKeyOf(report);
          if (!key) continue;
          yield {
            identity: [publicationId, key],
            digestPayload: report,
            record: { publicationId, report },
          };
        }
      }
    },
  },
  'community.public-posts': {
    guarantee: 'Full scan of every *.posts.json; one record per accepted post.',
    run: arrayItemEnumerator('community.public-posts', 'posts', (item) => postIdOf(item)),
  },
  'community.public-post-tombstones': {
    guarantee: 'Full scan of every *.post-tombstones.json; one record per tombstone.',
    run: arrayItemEnumerator('community.public-post-tombstones', 'post-tombstones', (item) =>
      typeof (item as { postId?: string }).postId === 'string' ? (item as { postId: string }).postId : null,
    ),
  },
  'community.publication-freezes': {
    guarantee: 'Full scan of every *.freeze.json.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'community.publication-freezes');
      for (const [publicationId, file] of await hexNamedFiles(dir, 'freeze')) {
        const record = await readJson<{ signature?: string }>(file);
        if (!record || typeof record !== 'object' || typeof record.signature !== 'string') continue;
        yield { identity: [publicationId], digestPayload: record, record: { publicationId, record } };
      }
    },
  },
  'community.public-submit-windows': {
    guarantee: 'Full scan of every *.flood.json; one record per (publication, personaKey).',
    run: async function* (roots) {
      const dir = storeDir(roots, 'community.public-submit-windows');
      for (const [publicationId, file] of await hexNamedFiles(dir, 'flood')) {
        const windows = await readJson<Record<string, number[]>>(file);
        if (!windows || typeof windows !== 'object') continue;
        for (const [personaKey, timestamps] of Object.entries(windows)) {
          if (!Array.isArray(timestamps) || timestamps.length === 0) continue;
          const sorted = [...timestamps].filter((n) => typeof n === 'number').sort((a, b) => a - b);
          yield {
            identity: [publicationId, personaKey],
            digestPayload: { timestampsMs: sorted },
            record: { publicationId, personaKey, timestampsMs: sorted },
          };
        }
      }
    },
  },
  'community.blocked-personas': {
    guarantee: 'Full scan of blocked-personas/*.blocked markers (identity is the sha256 marker).',
    run: async function* (roots) {
      const dir = path.join(storeDir(roots, 'community.blocked-personas'), 'blocked-personas');
      for (const name of await readdirSafe(dir)) {
        if (!name.endsWith('.blocked')) continue;
        const hash = name.slice(0, -'.blocked'.length);
        if (!/^[0-9a-f]{64}$/.test(hash)) continue;
        // The persona pubkey is a one-way sha256 in the file marker; the identity is
        // the marker hash, which is exactly what the PostgreSQL row stores too.
        yield { identity: [hash], digestPayload: { blocked: true }, record: { personaHash: hash } };
      }
    },
  },
  'community.private-states': {
    guarantee: 'Full scan of every *.private-state.json aggregate.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'community.private-states');
      for (const [communityId, file] of await hexNamedFiles(dir, 'private-state')) {
        const body = await readJson<PrivateStateFile>(file);
        if (!body || !body.active) continue;
        yield {
          identity: [communityId],
          digestPayload: privateStateDigest(body),
          record: { communityId, file: body },
        };
      }
    },
  },
  'directory.publications': {
    guarantee: 'Full scan of every *.dirpub.json in the directory publications dir.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'directory.publications');
      for (const [publicationId, file] of await hexNamedFiles(dir, 'dirpub')) {
        const body = await readJson<{ rec: string; rids: string[]; expiresAt: number }>(file);
        if (!body || typeof body.rec !== 'string') continue;
        const rids = Array.isArray(body.rids) ? [...body.rids].sort() : [];
        yield {
          // expiresAt is a TTL expressed differently on each backend, so it is not in the
          // digest payload; the record keeps it for the importer to write expires_at.
          identity: [publicationId],
          digestPayload: { rec: body.rec, rids },
          record: { publicationId, rec: body.rec, rids, expiresAt: body.expiresAt },
        };
      }
    },
  },
  'directory.kills': {
    guarantee: 'Full scan of every *.kill.json in the directory kills dir.',
    run: killEnumerator('directory.kills'),
  },
  'humanity.spent-tokens': {
    guarantee: 'Full read of the humanity-spend-ledger.json tokens map.',
    run: async function* (roots) {
      const root = requireRoot(roots, 'humanity', 'humanity.spent-tokens');
      const ledger = await readJson<{ tokens?: Record<string, { expiresAtMs: number }> }>(
        path.join(root, 'humanity-spend-ledger.json'),
      );
      const tokens = ledger?.tokens ?? {};
      for (const [tokenHash, token] of Object.entries(tokens)) {
        if (!token || typeof token.expiresAtMs !== 'number') continue;
        yield {
          identity: [tokenHash],
          digestPayload: { expiresAtMs: token.expiresAtMs },
          record: { tokenHash, expiresAtMs: token.expiresAtMs },
        };
      }
    },
  },
  'persona.records': {
    guarantee: 'Full scan of personas/*.json.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'persona.records');
      for (const name of await readdirSafe(dir)) {
        if (!name.endsWith('.json')) continue;
        const record = await readJson<{ alias?: string }>(path.join(dir, name));
        if (!record || typeof record.alias !== 'string') continue;
        yield { identity: [record.alias], digestPayload: record, record };
      }
    },
  },
  'persona.alias-tombstones': {
    guarantee: 'Full scan of tombstones/*.json.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'persona.alias-tombstones');
      for (const name of await readdirSafe(dir)) {
        if (!name.endsWith('.json')) continue;
        const alias = name.slice(0, -'.json'.length);
        const record = await readJson<Record<string, unknown>>(path.join(dir, name));
        if (!record || typeof record !== 'object') continue;
        yield { identity: [alias], digestPayload: record, record: { alias, tombstone: record } };
      }
    },
  },
  'persona.revocations': {
    guarantee: 'Full scan of revoked/* bare marker files.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'persona.revocations');
      for (const name of await readdirSafe(dir)) {
        if (name.startsWith('.')) continue;
        if (!/^[0-9a-f]{64}$/.test(name)) continue;
        yield { identity: [name], digestPayload: { revoked: true }, record: { personaPubkey: name } };
      }
    },
  },
  'hosted.subscriptions': {
    guarantee: 'Full scan of subscriptions/*.json (record carries its own subjectId).',
    run: subjectRecordEnumerator('hosted.subscriptions'),
  },
  'hosted.app-purchases': {
    guarantee: 'Full scan of purchases/*.json (record carries its own subjectId).',
    run: subjectRecordEnumerator('hosted.app-purchases'),
  },
  'hosted.app-persona-bindings': {
    guarantee: 'Full scan of persona-bindings/*.subject.json.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'hosted.app-persona-bindings');
      for (const name of await readdirSafe(dir)) {
        if (!name.endsWith('.subject.json')) continue;
        const record = await readJson<{ subjectId?: string; personaHash?: string }>(path.join(dir, name));
        if (!record || typeof record.subjectId !== 'string' || typeof record.personaHash !== 'string') continue;
        yield {
          identity: [record.subjectId, record.personaHash],
          digestPayload: { personaHash: record.personaHash },
          record: { subjectId: record.subjectId, personaHash: record.personaHash },
        };
      }
    },
  },
  'moderation.triage': {
    guarantee: 'Full read of the triage.json {reportKey: row} map.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'moderation.triage');
      const map = await readJson<Record<string, { status?: string }>>(path.join(dir, 'triage.json'));
      if (!map || typeof map !== 'object') return;
      for (const [reportKey, row] of Object.entries(map)) {
        if (!row || typeof row !== 'object') continue;
        // Digest the status only: PostgreSQL projects status into a dedicated column, so the
        // digest keys on status (not the whole blob) to stay comparable across backends.
        yield { identity: [reportKey], digestPayload: { status: String(row.status) }, record: row };
      }
    },
  },
  'moderation.operator-audit': {
    guarantee: 'Full read of audit.log JSONL; one record per line keyed by seq.',
    run: async function* (roots) {
      const dir = storeDir(roots, 'moderation.operator-audit');
      let raw: string;
      try {
        raw = await fs.readFile(path.join(dir, 'audit.log'), 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const row = JSON.parse(trimmed) as { seq?: number };
        if (typeof row.seq !== 'number') continue;
        yield { identity: [String(row.seq)], digestPayload: row, record: row };
      }
    },
  },
  'moderation.ncmec-reports': {
    guarantee: 'Direct scan of reports/*.json (order.log ignored so a truncated log cannot hide a report).',
    run: dirRecordEnumerator('moderation.ncmec-reports', 'reports', (envelope) => {
      const record = (envelope as { record?: { id?: string; status?: string; detectedAt?: string } }).record;
      if (!record || typeof record.id !== 'string') return null;
      // Digest status + detectedAt (dedicated PostgreSQL columns) so a status change is caught.
      return {
        identity: [record.id],
        body: record,
        digest: { status: String(record.status), detectedAt: toIsoOrNull(record.detectedAt) },
      };
    }),
  },
  'moderation.dmca-claims': {
    guarantee: 'Direct scan of claims/*.json (order.log ignored).',
    run: dirRecordEnumerator('moderation.dmca-claims', 'claims', (record) => {
      const claim = record as { id?: string; status?: string; receivedAt?: string };
      if (typeof claim.id !== 'string') return null;
      return {
        identity: [claim.id],
        body: record,
        digest: { status: String(claim.status), receivedAt: toIsoOrNull(claim.receivedAt) },
      };
    }),
  },
  'ops.object-reference-keys': {
    guarantee: 'Full read of object-reference-ledger.json records; one record per object key.',
    run: async function* (roots) {
      const root = requireRoot(roots, 'community', 'ops.object-reference-keys');
      const dir = path.join(root, STATE_STORE_DESCRIPTORS['ops.object-reference-keys'].fileSubdir!);
      const snapshot = await readJson<ObjectReferenceSnapshot>(
        path.join(dir, 'object-reference-ledger.json'),
      );
      for (const record of Object.values(snapshot?.records ?? {})) {
        if (!record || typeof record.objectKey !== 'string') continue;
        const referrers = Array.isArray(record.referrers) ? [...record.referrers].sort() : [];
        yield {
          identity: [record.objectKey],
          digestPayload: { referenceCount: referrers.length },
          record: { objectKey: record.objectKey, referrers },
        };
      }
    },
  },
  'ops.object-reference-edges': {
    guarantee: 'Full read of object-reference-ledger.json records expanded to one record per edge.',
    run: async function* (roots) {
      const root = requireRoot(roots, 'community', 'ops.object-reference-edges');
      const dir = path.join(root, STATE_STORE_DESCRIPTORS['ops.object-reference-edges'].fileSubdir!);
      const snapshot = await readJson<ObjectReferenceSnapshot>(
        path.join(dir, 'object-reference-ledger.json'),
      );
      for (const record of Object.values(snapshot?.records ?? {})) {
        if (!record || typeof record.objectKey !== 'string' || !Array.isArray(record.referrers)) continue;
        for (const referrer of record.referrers) {
          if (typeof referrer !== 'string') continue;
          yield {
            identity: [record.objectKey, referrer],
            digestPayload: { edge: true },
            record: { objectKey: record.objectKey, referrer },
          };
        }
      }
    },
  },
  'ops.object-deletion-jobs': {
    guarantee: 'Full read of object-deletion-jobs.json jobs map; one record per job.',
    run: async function* (roots) {
      const root = requireRoot(roots, 'community', 'ops.object-deletion-jobs');
      const dir = path.join(root, STATE_STORE_DESCRIPTORS['ops.object-deletion-jobs'].fileSubdir!);
      const ledger = await readJson<ObjectDeletionLedger>(
        path.join(dir, 'object-deletion-jobs.json'),
      );
      for (const job of Object.values(ledger?.jobs ?? {})) {
        if (!job || typeof job.objectKey !== 'string') continue;
        yield {
          identity: [job.objectKey],
          digestPayload: { state: job.state, attempt: job.attempt, versionId: job.versionId ?? null },
          record: job,
        };
      }
    },
  },
};

// --- Shared enumerator factories -------------------------------------------

function killEnumerator(storeId: StateStoreId): FileEnumerate {
  return async function* (roots) {
    const dir = storeDir(roots, storeId);
    for (const [communityId, file] of await hexNamedFiles(dir, 'kill')) {
      const record = await readJson<{ kill?: { communityId?: string }; signature?: string }>(file);
      if (!record || record.kill?.communityId !== communityId || typeof record.signature !== 'string') continue;
      yield { identity: [communityId], digestPayload: record, record: { communityId, record } };
    }
  };
}

function arrayItemEnumerator(
  storeId: StateStoreId,
  suffix: string,
  idOf: (item: unknown) => string | null,
): FileEnumerate {
  return async function* (roots) {
    const dir = storeDir(roots, storeId);
    for (const [publicationId, file] of await hexNamedFiles(dir, suffix)) {
      const list = await readJson<unknown[]>(file);
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        const id = idOf(item);
        if (id === null) continue;
        yield { identity: [publicationId, id], digestPayload: item, record: { publicationId, item } };
      }
    }
  };
}

function subjectRecordEnumerator(storeId: StateStoreId): FileEnumerate {
  return async function* (roots) {
    const dir = storeDir(roots, storeId);
    for (const name of await readdirSafe(dir)) {
      if (!name.endsWith('.json') || name.endsWith('.lock')) continue;
      const record = await readJson<{ subjectId?: string }>(path.join(dir, name));
      if (!record || typeof record.subjectId !== 'string') continue;
      yield { identity: [record.subjectId], digestPayload: record, record };
    }
  };
}

function dirRecordEnumerator(
  storeId: StateStoreId,
  subdir: string,
  extract: (body: unknown) => { identity: string[]; body: unknown; digest?: unknown } | null,
): FileEnumerate {
  return async function* (roots) {
    const dir = path.join(storeDir(roots, storeId), subdir);
    for (const name of await readdirSafe(dir)) {
      if (!name.endsWith('.json')) continue;
      const body = await readJson<unknown>(path.join(dir, name));
      if (!body) continue;
      const extracted = extract(body);
      if (!extracted) continue;
      yield {
        identity: extracted.identity,
        digestPayload: extracted.digest ?? extracted.body,
        record: extracted.body,
      };
    }
  };
}

// --- Small helpers ----------------------------------------------------------

interface PrivateStateFile {
  active: { descriptorHash?: string; descriptor?: { revision?: number } } | null;
  [key: string]: unknown;
}

function privateStateDigest(body: PrivateStateFile): unknown {
  const active = body.active;
  return {
    descriptorHash: active?.descriptorHash ?? null,
    revision: active?.descriptor?.revision ?? null,
  };
}

interface ObjectReferenceSnapshot {
  records?: Record<string, { objectKey: string; referrers: string[] }>;
}

interface ObjectDeletionLedger {
  jobs?: Record<string, {
    objectKey: string;
    state: string;
    attempt: number;
    versionId: string | null;
  }>;
}

/** Normalize an ISO instant to millisecond-precision ISO so it matches the PostgreSQL side. */
function toIsoOrNull(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function reportKeyOf(report: unknown): string | null {
  // The report_key in PostgreSQL is derived from the signed report; the file stores
  // the signed report only. We key on the signature, which is 1:1 with report_key.
  const signature = (report as { signature?: string }).signature;
  return typeof signature === 'string' && signature.length > 0 ? signature : null;
}

function postIdOf(item: unknown): string | null {
  const post = (item as { post?: { postId?: string } }).post;
  return post && typeof post.postId === 'string' ? post.postId : null;
}

/** Build every file enumerator, bound to the resolved service roots. */
export function fileEnumerators(roots: StateServiceRoots): Record<StateStoreId, StateEnumerator> {
  const out = {} as Record<StateStoreId, StateEnumerator>;
  for (const storeId of Object.keys(enumerators) as StateStoreId[]) {
    const { guarantee, run } = enumerators[storeId];
    out[storeId] = makeEnumerator(storeId, guarantee, run, roots);
  }
  return out;
}

export function fileEnumerator(storeId: StateStoreId, roots: StateServiceRoots): StateEnumerator {
  const { guarantee, run } = enumerators[storeId];
  return makeEnumerator(storeId, guarantee, run, roots);
}
