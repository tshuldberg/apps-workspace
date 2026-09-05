import { createHmac } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';
import {
  verifyPublication,
  verifyPublicationOwnerSignature,
  verifyOwnerTakedown,
  type PublicCategory,
  type SignedDescriptorKill,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import {
  type AnnounceResult,
  type DirectoryHostAnnouncementInput,
  type DirectoryHostAnnouncementStore,
  type DirectoryPublicationAnnouncement,
  type DirectoryTakedownOutcome,
  type DirectoryTrendingCandidate,
  type PublicDirectoryRepository,
} from '../../public-directory-node';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

const RID_RE = /^[0-9a-f]{16,64}$/u;
const PUBLIC_CATEGORIES = new Set<PublicCategory>([
  'technology',
  'gaming',
  'news',
  'sports',
  'local',
  'hobbies',
  'creative',
  'discussion',
  'other',
]);
const MAX_DATABASE_RECORD_BYTES = 65_536;
const MAX_SIGNED_RECORD_BYTES = 128 * 1024;
const MAX_DIRECTORY_RECORDS = 200_000;

interface PublicationRow extends QueryResultRow {
  publication_id: unknown;
  signed_record: unknown;
  rids: unknown;
  expires_at: unknown;
  owner_device_id: unknown;
  community_id: unknown;
  content_id: unknown;
  publication_kind: unknown;
  category: unknown;
  descriptor_revision: unknown;
  descriptor_status: unknown;
  descriptor_updated_at: unknown;
  lifecycle_version: unknown;
}

interface PublicationCountRow extends QueryResultRow {
  global_count: unknown;
  owner_count: unknown;
}

interface HostRow extends QueryResultRow {
  rid: unknown;
  announcer_hash: unknown;
  opaque_record: unknown;
  expires_at: unknown;
  lifecycle_version: unknown;
}

interface CountRow extends QueryResultRow {
  count: unknown;
}

interface ExistsRow extends QueryResultRow {
  exists: unknown;
}

interface HostCountRow extends QueryResultRow {
  rid: unknown;
  count: unknown;
}

interface DecodedPublication {
  signed: SignedPublicationDescriptor;
  rids: string[];
  expiresAt: number;
}

function assertText(name: string, value: string, maximum: number): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new TypeError(`${name} must be a non-empty string no longer than ${maximum} characters.`);
  }
}

function assertRid(rid: string): void {
  if (typeof rid !== 'string' || !RID_RE.test(rid)) {
    throw new TypeError('Directory registry id must be 16 to 64 lowercase hexadecimal characters.');
  }
}

function assertPositiveInteger(name: string, value: number, maximum: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new RangeError(`${name} must be an integer between 1 and ${maximum}.`);
  }
}

function safeInteger(value: unknown, name: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'bigint'
      ? Number(value)
      : typeof value === 'string' && /^\d+$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL ${name} is not a non-negative safe integer.`);
  }
  return parsed;
}

function timestampMs(value: unknown, name: string): number {
  const parsed = value instanceof Date
    ? value.getTime()
    : typeof value === 'string' || typeof value === 'number'
      ? new Date(value).getTime()
      : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL ${name} is not a valid timestamp.`);
  }
  return parsed;
}

function parseSignedRecord(record: string): SignedPublicationDescriptor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(record) as unknown;
  } catch {
    throw new Error('PostgreSQL directory signed record is not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('PostgreSQL directory signed record is not an object.');
  }
  const signed = parsed as SignedPublicationDescriptor;
  if (!signed.descriptor || !verifyPublicationOwnerSignature(signed)) {
    throw new Error('PostgreSQL directory signed record has an invalid owner signature.');
  }
  return signed;
}

function decodeRids(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('PostgreSQL directory rids are not an array.');
  const rids: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== 'string' || !RID_RE.test(candidate)) {
      throw new Error('PostgreSQL directory contains a non-canonical registry id.');
    }
    if (!seen.has(candidate)) {
      seen.add(candidate);
      rids.push(candidate);
    }
  }
  return rids;
}

function decodePublication(row: PublicationRow): DecodedPublication {
  if (typeof row.publication_id !== 'string'
    || typeof row.signed_record !== 'string'
    || typeof row.owner_device_id !== 'string'
    || typeof row.community_id !== 'string'
    || typeof row.content_id !== 'string'
    || typeof row.publication_kind !== 'string'
    || typeof row.category !== 'string'
    || typeof row.descriptor_status !== 'string') {
    throw new Error('PostgreSQL directory publication has invalid typed columns.');
  }
  const signed = parseSignedRecord(row.signed_record);
  const descriptor = signed.descriptor;
  const revision = safeInteger(row.descriptor_revision, 'directory descriptor revision');
  safeInteger(row.lifecycle_version, 'directory publication lifecycle version');
  const descriptorUpdatedAt = timestampMs(
    row.descriptor_updated_at,
    'directory descriptor updated_at',
  );
  const expiresAt = timestampMs(row.expires_at, 'directory publication expires_at');
  if (descriptor.publicationId !== row.publication_id
    || descriptor.ownerDeviceId !== row.owner_device_id
    || descriptor.communityId !== row.community_id
    || descriptor.contentId !== row.content_id
    || descriptor.kind !== row.publication_kind
    || descriptor.category !== row.category
    || descriptor.revision !== revision
    || descriptor.status !== row.descriptor_status
    || Date.parse(descriptor.updatedAt) !== descriptorUpdatedAt
    || !PUBLIC_CATEGORIES.has(descriptor.category)) {
    throw new Error('PostgreSQL directory typed columns do not match the signed record.');
  }
  if (descriptor.status === 'active' && verifyPublication(signed) !== 'ok') {
    throw new Error('PostgreSQL directory active record is not a valid genesis publication.');
  }
  return { signed, rids: decodeRids(row.rids), expiresAt };
}

function validateAnnouncement(input: DirectoryPublicationAnnouncement): void {
  assertRid(input.rid);
  assertPositiveInteger('Directory publication TTL', input.ttlMs, 365 * 24 * 60 * 60 * 1000);
  assertPositiveInteger('Global publication cap', input.limits.maxPublications, MAX_DIRECTORY_RECORDS);
  assertPositiveInteger(
    'Per-owner publication cap',
    input.limits.maxPublicationsPerOwner,
    input.limits.maxPublications,
  );
  assertPositiveInteger('Per-publication registry-id cap', input.limits.maxRidsPerPublication, 10_000);
  assertText('Directory signed record', input.rec, input.limits.maxRecordChars);
  if (Buffer.byteLength(input.rec, 'utf8') > MAX_SIGNED_RECORD_BYTES) {
    throw new RangeError('Directory signed record exceeds its PostgreSQL byte bound.');
  }
  if (verifyPublication(input.signed) !== 'ok' || input.signed.descriptor.status !== 'active') {
    throw new TypeError('Directory publication must be a valid active genesis record.');
  }
  const parsed = parseSignedRecord(input.rec);
  if (parsed.signature !== input.signed.signature
    || parsed.descriptor.publicationId !== input.signed.descriptor.publicationId) {
    throw new TypeError('Directory publication record does not match its signed descriptor.');
  }
}

async function query<Row extends QueryResultRow = QueryResultRow>(
  context: PostgresStoreContext,
  operation: string,
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  try {
    return await context.query<Row>(text, values);
  } catch (error) {
    throw toPostgresStoreUnavailableError(operation, error);
  }
}

async function available<T>(operation: string, callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    throw toPostgresStoreUnavailableError(operation, error);
  }
}

async function locked<T>(
  context: PostgresStoreContext,
  operation: string,
  namespace: string,
  key: string,
  callback: () => Promise<T>,
): Promise<T> {
  try {
    return await context.withAdvisoryTransactionLock(namespace, key, callback);
  } catch (error) {
    throw toPostgresStoreUnavailableError(operation, error);
  }
}

const PUBLICATION_PROJECTION = `
  publications.publication_id AS publication_id,
  publications.signed_record AS signed_record,
  publications.rids AS rids,
  publications.expires_at AS expires_at,
  publications.owner_device_id AS owner_device_id,
  publications.community_id AS community_id,
  publications.content_id AS content_id,
  publications.publication_kind AS publication_kind,
  publications.category AS category,
  publications.descriptor_revision AS descriptor_revision,
  publications.descriptor_status AS descriptor_status,
  publications.descriptor_updated_at AS descriptor_updated_at,
  publications.lifecycle_version AS lifecycle_version
`;

/** PostgreSQL authority for public-directory publications and signed kills. */
export class PostgresPublicDirectoryRepository implements PublicDirectoryRepository {
  constructor(private readonly context: PostgresStoreContext) {}

  async storePublication(input: DirectoryPublicationAnnouncement): Promise<AnnounceResult> {
    validateAnnouncement(input);
    const descriptor = input.signed.descriptor;
    return locked(
      this.context,
      'store directory publication',
      'directory.publications',
      'global-cap',
      async () => {
        // Only the colliding id must be removed here so an expired anti-rollback
        // tombstone can be republished. The indexed background prune owns bulk expiry.
        await query(
          this.context,
          'prune colliding expired directory publication before store',
          `DELETE FROM directory.publications
           WHERE publication_id = $1 AND expires_at <= clock_timestamp()`,
          [descriptor.publicationId],
        );
        const existingResult = await query<PublicationRow>(
          this.context,
          'read directory publication for store',
          `SELECT ${PUBLICATION_PROJECTION}
           FROM directory.publications AS publications
           WHERE publications.publication_id = $1
           FOR UPDATE`,
          [descriptor.publicationId],
        );
        const existingRow = existingResult.rows[0];
        if (existingRow) {
          const existing = decodePublication(existingRow);
          if (existing.signed.descriptor.status !== 'active') {
            // A live terminal record is an anti-rollback tombstone. Genesis-only
            // announcements can never advance it, so acknowledge without resurrection.
            return { ok: true };
          }
          const rids = existing.rids.includes(input.rid)
            || existing.rids.length >= input.limits.maxRidsPerPublication
            ? existing.rids
            : [...existing.rids, input.rid].sort();
          await query(
            this.context,
            'refresh directory publication',
            `UPDATE directory.publications
             SET signed_record = $2,
                 rids = $3::text[],
                 expires_at = clock_timestamp() + ($4::double precision * interval '1 millisecond'),
                 lifecycle_version = lifecycle_version + 1,
                 updated_at = clock_timestamp()
             WHERE publication_id = $1`,
            [descriptor.publicationId, input.rec, rids, input.ttlMs],
          );
          return { ok: true };
        }

        const counts = await query<PublicationCountRow>(
          this.context,
          'count live directory publications',
          `SELECT
             count(*)::text AS global_count,
             count(*) FILTER (WHERE owner_device_id = $1)::text AS owner_count
           FROM directory.publications
           WHERE descriptor_status = 'active'
             AND expires_at > clock_timestamp()`,
          [descriptor.ownerDeviceId],
        );
        const globalCount = safeInteger(counts.rows[0]?.global_count, 'directory global count');
        const ownerCount = safeInteger(counts.rows[0]?.owner_count, 'directory owner count');
        if (globalCount >= input.limits.maxPublications) {
          return { ok: false, code: 'directory_full' };
        }
        if (ownerCount >= input.limits.maxPublicationsPerOwner) {
          return { ok: false, code: 'owner_full' };
        }
        await query(
          this.context,
          'insert directory publication',
          `INSERT INTO directory.publications (
             publication_id, signed_record, rids, expires_at
           ) VALUES (
             $1, $2, ARRAY[$3]::text[],
             clock_timestamp() + ($4::double precision * interval '1 millisecond')
           )`,
          [descriptor.publicationId, input.rec, input.rid, input.ttlMs],
        );
        return { ok: true };
      },
    );
  }

  async recordUnpublish(
    signed: SignedPublicationDescriptor,
    tombstoneTtlMs: number,
  ): Promise<DirectoryTakedownOutcome> {
    if (!signed?.descriptor
      || (signed.descriptor.status !== 'unpublished' && signed.descriptor.status !== 'killed')
      || !verifyPublicationOwnerSignature(signed)) {
      return 'ignored';
    }
    assertPositiveInteger(
      'Directory takedown TTL',
      tombstoneTtlMs,
      365 * 24 * 60 * 60 * 1000,
    );
    return locked(
      this.context,
      'record directory publication takedown',
      'directory.publications',
      'global-cap',
      async () => {
        const result = await query<PublicationRow>(
          this.context,
          'read directory publication for takedown',
          `SELECT ${PUBLICATION_PROJECTION}
           FROM directory.publications AS publications
           WHERE publications.publication_id = $1
             AND publications.expires_at > clock_timestamp()
           FOR UPDATE`,
          [signed.descriptor.publicationId],
        );
        const row = result.rows[0];
        if (!row) return 'ignored';
        const existing = decodePublication(row);
        if (existing.signed.descriptor.status !== 'active'
          && signed.descriptor.revision <= existing.signed.descriptor.revision) {
          return 'ignored';
        }
        if (!verifyOwnerTakedown(signed, existing.signed)) return 'ignored';
        await query(
          this.context,
          'persist directory publication takedown',
          `UPDATE directory.publications
           SET signed_record = $2,
               expires_at = clock_timestamp() + ($3::double precision * interval '1 millisecond'),
               lifecycle_version = lifecycle_version + 1,
               updated_at = clock_timestamp()
           WHERE publication_id = $1`,
          [signed.descriptor.publicationId, JSON.stringify(signed), tombstoneTtlMs],
        );
        return 'recorded';
      },
    );
  }

  async recordKill(signed: SignedDescriptorKill): Promise<void> {
    const communityId = signed?.kill?.communityId;
    assertText('Directory killed community id', communityId, 128);
    assertText('Directory kill signature', signed.signature, 4096);
    await query(
      this.context,
      'record directory community kill',
      `INSERT INTO directory.kills (community_id, payload)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (community_id) DO NOTHING`,
      [communityId, JSON.stringify(signed)],
    );
  }

  async lookupPublications(rid: string, maximumRecords: number): Promise<string[]> {
    assertRid(rid);
    assertPositiveInteger('Directory lookup bound', maximumRecords, MAX_DIRECTORY_RECORDS);
    return available('lookup live directory publications', async () => {
      const result = await query<PublicationRow>(
        this.context,
        'lookup live directory publications',
        `SELECT ${PUBLICATION_PROJECTION.replaceAll('\n', '\n             ')}
         FROM directory.publication_rids AS publication_rids
         JOIN directory.publications AS publications
           ON publications.publication_id = publication_rids.publication_id
         LEFT JOIN directory.kills AS kills
           ON kills.community_id = publications.community_id
         WHERE publication_rids.rid = $1
           AND publications.descriptor_status = 'active'
           AND publications.expires_at > clock_timestamp()
           AND kills.community_id IS NULL
         ORDER BY publications.publication_id
         LIMIT $2`,
        [rid, maximumRecords + 1],
      );
      if (result.rows.length > maximumRecords) {
        throw new Error('PostgreSQL directory lookup exceeded its hard bound.');
      }
      return result.rows.map((row) => {
        const decoded = decodePublication(row);
        if (!decoded.rids.includes(rid)) {
          throw new Error('PostgreSQL normalized directory rid does not match the publication array.');
        }
        return row.signed_record as string;
      });
    });
  }

  async listTrendingCandidates(
    category: PublicCategory | undefined,
    maximumRecords: number,
  ): Promise<DirectoryTrendingCandidate[]> {
    if (category !== undefined && !PUBLIC_CATEGORIES.has(category)) {
      throw new TypeError('Directory trending category is invalid.');
    }
    assertPositiveInteger('Directory trending bound', maximumRecords, MAX_DIRECTORY_RECORDS);
    return available('list live directory trending candidates', async () => {
      const result = await query<PublicationRow>(
        this.context,
        'list live directory trending candidates',
        `SELECT ${PUBLICATION_PROJECTION}
         FROM directory.publications AS publications
         LEFT JOIN directory.kills AS kills
           ON kills.community_id = publications.community_id
         WHERE publications.descriptor_status = 'active'
           AND publications.expires_at > clock_timestamp()
           AND kills.community_id IS NULL
           AND ($1::text IS NULL OR publications.category = $1)
         ORDER BY publications.descriptor_updated_at DESC, publications.publication_id DESC
         LIMIT $2`,
        [category ?? null, maximumRecords + 1],
      );
      if (result.rows.length > maximumRecords) {
        throw new Error('PostgreSQL directory trending scan exceeded its hard bound.');
      }
      return result.rows.map((row) => {
        const decoded = decodePublication(row);
        return {
          publicationId: decoded.signed.descriptor.publicationId,
          contentId: decoded.signed.descriptor.contentId,
          rec: row.signed_record as string,
          updatedAt: decoded.signed.descriptor.updatedAt,
        };
      });
    });
  }

  async pruneExpired(): Promise<void> {
    await locked(
      this.context,
      'prune expired directory publications',
      'directory.publications',
      'global-cap',
      async () => {
        await query(
          this.context,
          'prune expired directory publications',
          'DELETE FROM directory.publications WHERE expires_at <= clock_timestamp()',
        );
      },
    );
  }
}

export interface PostgresDirectoryHostAnnouncementStoreOptions {
  /** Decoded secret bytes. Raw client network identifiers are never persisted. */
  announcerHmacKey: Uint8Array;
}

/** PostgreSQL authority for expiring, HMAC-keyed host announcement slots. */
export class PostgresDirectoryHostAnnouncementStore implements DirectoryHostAnnouncementStore {
  private readonly announcerHmacKey: Buffer;

  constructor(
    private readonly context: PostgresStoreContext,
    options: PostgresDirectoryHostAnnouncementStoreOptions,
  ) {
    if (!(options.announcerHmacKey instanceof Uint8Array)
      || options.announcerHmacKey.byteLength < 32) {
      throw new TypeError('Directory announcer HMAC key must contain at least 32 decoded bytes.');
    }
    this.announcerHmacKey = Buffer.from(options.announcerHmacKey);
  }

  async announceHost(input: DirectoryHostAnnouncementInput): Promise<AnnounceResult> {
    assertRid(input.rid);
    assertText('Directory host client key', input.clientKey, 4096);
    assertPositiveInteger('Directory host TTL', input.ttlMs, 30 * 24 * 60 * 60 * 1000);
    assertPositiveInteger('Directory host-rid cap', input.limits.maxHostRids, MAX_DIRECTORY_RECORDS);
    assertPositiveInteger(
      'Directory announcer cap',
      input.limits.maxAnnouncersPerHostRid,
      100_000,
    );
    if (typeof input.rec !== 'string'
      || input.rec.length === 0
      || input.rec.length > input.limits.maxRecordChars
      || Buffer.byteLength(input.rec, 'utf8') > MAX_DATABASE_RECORD_BYTES) {
      return { ok: false, code: 'too_large' };
    }
    const announcerHash = this.hashClientKey(input.clientKey);
    return locked(
      this.context,
      'announce directory content host',
      'directory.host-announcements',
      'global-cap',
      async () => {
        const existing = await query<ExistsRow>(
          this.context,
          'read directory host slot',
          `SELECT EXISTS (
             SELECT 1
             FROM directory.host_announcements
             WHERE rid = $1
               AND announcer_hash = $2
               AND expires_at > clock_timestamp()
           ) AS exists`,
          [input.rid, announcerHash],
        );
        if (existing.rows[0]?.exists !== true) {
          const ridExists = await query<ExistsRow>(
            this.context,
            'read directory host rid',
            `SELECT EXISTS (
               SELECT 1
               FROM directory.host_announcements
               WHERE rid = $1 AND expires_at > clock_timestamp()
             ) AS exists`,
            [input.rid],
          );
          if (ridExists.rows[0]?.exists !== true) {
            const global = await query<CountRow>(
              this.context,
              'count directory host rids',
              `SELECT count(*)::text AS count
               FROM (
                 SELECT rid
                 FROM directory.host_announcements
                 WHERE expires_at > clock_timestamp()
                 GROUP BY rid
                 LIMIT $1
               ) AS live_rids`,
              [input.limits.maxHostRids + 1],
            );
            const globalCount = safeInteger(global.rows[0]?.count, 'directory host-rid count');
            if (globalCount >= input.limits.maxHostRids) {
              return { ok: false, code: 'registry_full' };
            }
          }
          const perRid = await query<CountRow>(
            this.context,
            'count directory host announcers',
            `SELECT count(*)::text AS count
             FROM (
               SELECT announcer_hash
               FROM directory.host_announcements
               WHERE rid = $1
                 AND expires_at > clock_timestamp()
               ORDER BY announcer_hash
               LIMIT $2
             ) AS live_announcers`,
            [input.rid, input.limits.maxAnnouncersPerHostRid + 1],
          );
          if (safeInteger(perRid.rows[0]?.count, 'directory announcer count')
            >= input.limits.maxAnnouncersPerHostRid) {
            return { ok: false, code: 'rid_full' };
          }
        }
        await query(
          this.context,
          'upsert directory host announcement',
          `INSERT INTO directory.host_announcements (
             rid, announcer_hash, opaque_record, expires_at, announced_at
           ) VALUES (
             $1, $2, $3,
             clock_timestamp() + ($4::double precision * interval '1 millisecond'),
             clock_timestamp()
           )
           ON CONFLICT (rid, announcer_hash) DO UPDATE SET
             opaque_record = EXCLUDED.opaque_record,
             expires_at = EXCLUDED.expires_at,
             announced_at = EXCLUDED.announced_at,
             lifecycle_version = directory.host_announcements.lifecycle_version + 1,
             updated_at = clock_timestamp()`,
          [input.rid, announcerHash, input.rec, input.ttlMs],
        );
        return { ok: true };
      },
    );
  }

  async lookupHosts(rid: string, maximumRecords: number): Promise<string[]> {
    assertRid(rid);
    assertPositiveInteger('Directory host lookup bound', maximumRecords, 100_000);
    return available('lookup live directory hosts', async () => {
      const result = await query<HostRow>(
        this.context,
        'lookup live directory hosts',
        `SELECT rid, announcer_hash, opaque_record, expires_at, lifecycle_version
         FROM directory.host_announcements
         WHERE rid = $1 AND expires_at > clock_timestamp()
         ORDER BY announcer_hash
         LIMIT $2`,
        [rid, maximumRecords + 1],
      );
      if (result.rows.length > maximumRecords) {
        throw new Error('PostgreSQL directory host lookup exceeded its hard bound.');
      }
      return result.rows.map((row) => this.decodeHost(row, rid).rec);
    });
  }

  async countLiveHosts(rids: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const unique = [...new Set(rids)];
    if (unique.length > MAX_DIRECTORY_RECORDS) {
      throw new RangeError('Directory host-count query exceeds its hard bound.');
    }
    for (const rid of unique) assertRid(rid);
    if (unique.length === 0) return new Map();
    const requested = new Set(unique);
    return available('count live directory hosts', async () => {
      const result = await query<HostCountRow>(
        this.context,
        'count live directory hosts',
        `SELECT rid, count(*)::text AS count
         FROM directory.host_announcements
         WHERE rid = ANY($1::text[])
           AND expires_at > clock_timestamp()
         GROUP BY rid
         ORDER BY rid`,
        [unique],
      );
      const counts = new Map<string, number>();
      for (const row of result.rows) {
        if (typeof row.rid !== 'string' || !RID_RE.test(row.rid) || !requested.has(row.rid)) {
          throw new Error('PostgreSQL directory host-count row has an invalid registry id.');
        }
        counts.set(row.rid, safeInteger(row.count, 'directory live-host count'));
      }
      return counts;
    });
  }

  async pruneExpiredHosts(): Promise<void> {
    await locked(
      this.context,
      'prune expired directory hosts',
      'directory.host-announcements',
      'global-cap',
      async () => {
        await query(
          this.context,
          'prune expired directory hosts',
          'DELETE FROM directory.host_announcements WHERE expires_at <= clock_timestamp()',
        );
      },
    );
  }

  async stats(): Promise<{ liveRids: number }> {
    return available('count live directory host rids for observability', async () => {
      const result = await query<CountRow>(
        this.context,
        'count live directory host rids for observability',
        `SELECT count(DISTINCT rid)::text AS count
         FROM directory.host_announcements
         WHERE expires_at > clock_timestamp()`,
      );
      return {
        liveRids: safeInteger(result.rows[0]?.count, 'directory live host-rid count'),
      };
    });
  }

  private hashClientKey(clientKey: string): string {
    return createHmac('sha256', this.announcerHmacKey)
      .update(clientKey, 'utf8')
      .digest('hex');
  }

  private decodeHost(row: HostRow, expectedRid: string): { rec: string; expiresAt: number } {
    if (row.rid !== expectedRid
      || typeof row.announcer_hash !== 'string'
      || !/^[0-9a-f]{64}$/u.test(row.announcer_hash)
      || typeof row.opaque_record !== 'string'
      || row.opaque_record.length === 0
      || Buffer.byteLength(row.opaque_record, 'utf8') > MAX_DATABASE_RECORD_BYTES) {
      throw new Error('PostgreSQL directory host row is invalid.');
    }
    safeInteger(row.lifecycle_version, 'directory host lifecycle version');
    return {
      rec: row.opaque_record,
      expiresAt: timestampMs(row.expires_at, 'directory host expires_at'),
    };
  }
}
