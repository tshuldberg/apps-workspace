import { createHash } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';
import {
  verifyPublicationOwnerSignature,
  verifyPublicAbuseReport,
  verifyPublicPost,
  verifyPublicPostTombstone,
  verifyPublicPostingFreeze,
  type AcceptedPublicPost,
  type PublicPostTombstone,
  type PublicPostingFreeze,
  type SignedDescriptorKill,
  type SignedPublicAbuseReport,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import {
  type CommunityDescriptorStore,
  type DescriptorRevisionClaim,
  type HighestRevision,
  type KillStore,
  type PublicationReplaceOutcome,
  type PublicationStore,
  type PublicPostStore,
  type ReportStore,
  type StoredPublication,
  type StoredPublicationSnapshot,
} from '../../community-node';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

const MAX_PUBLICATIONS = 100_000;
const MAX_REPORTS = 10_000;
const MAX_PUBLIC_POSTS = 50_000;
const MAX_PUBLICATION_SNAPSHOTS = 10_000;
const MAX_MANIFEST_JSON_CHARS = 1024 * 1024;
const SAFE_HEX_64 = /^[a-f0-9]{64}$/iu;

interface DescriptorRow extends QueryResultRow {
  revision: unknown;
  descriptor_hash: unknown;
}

interface PublicationRow extends QueryResultRow {
  publication_id: unknown;
  descriptor_revision: unknown;
  payload: unknown;
  lifecycle_version: unknown;
}

interface KillRow extends QueryResultRow {
  community_id: unknown;
  payload: unknown;
}

interface ReportRow extends QueryResultRow {
  publication_id: unknown;
  report_key: unknown;
  reason: unknown;
  payload: unknown;
}

interface PublicPostRow extends QueryResultRow {
  post_id: unknown;
  persona_pubkey: unknown;
  accepted_at: unknown;
  payload: unknown;
}

interface TombstoneRow extends QueryResultRow {
  post_id: unknown;
  payload: unknown;
}

interface FreezeRow extends QueryResultRow {
  payload: unknown;
  lifecycle_version: unknown;
}

interface SubmitWindowRow extends QueryResultRow {
  timestamps_ms: unknown;
}

function assertText(name: string, value: string, maximum = 512): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new TypeError(`${name} must be a non-empty string no longer than ${maximum} characters.`);
  }
}

function assertRevision(revision: number, name = 'revision'): void {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer.`);
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

function jsonObject(value: unknown, name: string): Record<string, unknown> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new Error(`PostgreSQL ${name} contains invalid JSON.`);
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`PostgreSQL ${name} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function reportKey(report: SignedPublicAbuseReport): string {
  return createHash('sha256').update(report.signature, 'utf8').digest('hex');
}

/**
 * The public-post block enforcement key. MUST match the file adapter's marker exactly
 * (sha256 of the lowercased persona pubkey, hex) so a block enforces identically on both
 * backends and a file-mode block imports as the same row.
 */
function blockedPersonaHash(personaPubkey: string): string {
  return createHash('sha256').update(personaPubkey.toLowerCase(), 'utf8').digest('hex');
}

function decodePublication(row: PublicationRow): StoredPublication {
  if (typeof row.publication_id !== 'string') {
    throw new Error('PostgreSQL community publication has an invalid publication_id.');
  }
  const revision = safeInteger(row.descriptor_revision, 'community publication revision');
  safeInteger(row.lifecycle_version, 'community publication lifecycle version');
  const payload = jsonObject(row.payload, 'community publication payload');
  const signed = payload.signed as SignedPublicationDescriptor | undefined;
  const snapshots = payload.snapshots as unknown;
  if (!signed?.descriptor
    || signed.descriptor.publicationId !== row.publication_id
    || signed.descriptor.revision !== revision
    || !verifyPublicationOwnerSignature(signed)) {
    throw new Error('PostgreSQL community publication columns and signed payload do not match.');
  }
  if (!Array.isArray(snapshots) || snapshots.length > MAX_PUBLICATION_SNAPSHOTS) {
    throw new Error('PostgreSQL community publication snapshots are invalid or unbounded.');
  }
  const decodedSnapshots = snapshots.map((snapshot, index): StoredPublicationSnapshot => {
    if (typeof snapshot !== 'object' || snapshot === null) {
      throw new Error(`PostgreSQL community publication snapshot ${index} is invalid.`);
    }
    const candidate = snapshot as Partial<StoredPublicationSnapshot>;
    if (typeof candidate.channelId !== 'string' || candidate.channelId.length === 0
      || typeof candidate.epoch !== 'number'
      || !Number.isSafeInteger(candidate.epoch) || candidate.epoch < 0
      || typeof candidate.manifestJson !== 'string'
      || candidate.manifestJson.length === 0
      || candidate.manifestJson.length > MAX_MANIFEST_JSON_CHARS) {
      throw new Error(`PostgreSQL community publication snapshot ${index} has invalid fields.`);
    }
    jsonObject(candidate.manifestJson, `community publication snapshot ${index} manifest`);
    return {
      channelId: candidate.channelId,
      epoch: candidate.epoch,
      manifestJson: candidate.manifestJson,
    };
  });
  return { signed, snapshots: decodedSnapshots };
}

function encodePublication(publicationId: string, record: StoredPublication): string {
  assertText('Publication id', publicationId, 128);
  if (record.signed?.descriptor?.publicationId !== publicationId
    || !verifyPublicationOwnerSignature(record.signed)) {
    throw new TypeError('Publication payload must contain a valid owner-signed matching descriptor.');
  }
  assertRevision(record.signed.descriptor.revision, 'Publication revision');
  if (!Array.isArray(record.snapshots) || record.snapshots.length > MAX_PUBLICATION_SNAPSHOTS) {
    throw new RangeError('Publication snapshot count exceeds the PostgreSQL bound.');
  }
  for (const snapshot of record.snapshots) {
    assertText('Publication snapshot channel id', snapshot.channelId, 128);
    assertRevision(snapshot.epoch, 'Publication snapshot epoch');
    assertText('Publication snapshot manifest', snapshot.manifestJson, MAX_MANIFEST_JSON_CHARS);
    jsonObject(snapshot.manifestJson, 'publication snapshot manifest');
  }
  return JSON.stringify(record);
}

function decodeKill(row: KillRow): SignedDescriptorKill {
  if (typeof row.community_id !== 'string') {
    throw new Error('PostgreSQL community kill has an invalid community_id.');
  }
  const payload = jsonObject(row.payload, 'community kill payload') as unknown as SignedDescriptorKill;
  if (!payload.kill || payload.kill.communityId !== row.community_id
    || typeof payload.signature !== 'string') {
    throw new Error('PostgreSQL community kill columns and signed payload do not match.');
  }
  return payload;
}

function decodeReport(row: ReportRow): SignedPublicAbuseReport {
  if (typeof row.publication_id !== 'string' || typeof row.report_key !== 'string') {
    throw new Error('PostgreSQL community report has invalid identity columns.');
  }
  const payload = jsonObject(row.payload, 'community report payload') as unknown as SignedPublicAbuseReport;
  if (!verifyPublicAbuseReport(payload)
    || payload.report.publicationId !== row.publication_id
    || reportKey(payload) !== row.report_key
    || payload.report.reason !== row.reason) {
    throw new Error('PostgreSQL community report columns and signed payload do not match.');
  }
  return payload;
}

function validateAcceptedPost(publicationId: string, accepted: AcceptedPublicPost): void {
  if (!accepted?.receipt || verifyPublicPost(
    accepted,
    accepted.receipt.nodeKeyHex,
    { publicationId },
  ) !== 'ok') {
    throw new TypeError('Accepted public post is not a valid dual-signed publication record.');
  }
}

function decodeAcceptedPost(publicationId: string, row: PublicPostRow): AcceptedPublicPost {
  const accepted = jsonObject(row.payload, 'accepted public post payload') as unknown as AcceptedPublicPost;
  validateAcceptedPost(publicationId, accepted);
  if (accepted.post.postId !== row.post_id
    || accepted.post.personaPubkey !== row.persona_pubkey
    || timestampMs(row.accepted_at, 'accepted public post accepted_at')
      !== timestampMs(accepted.receipt.acceptedAt, 'accepted public post payload acceptedAt')) {
    throw new Error('PostgreSQL accepted public post columns and signed payload do not match.');
  }
  return accepted;
}

function validateTombstone(publicationId: string, tombstone: PublicPostTombstone): void {
  if (tombstone?.publicationId !== publicationId
    || !verifyPublicPostTombstone(tombstone, [tombstone.signerKeyHex])) {
    throw new TypeError('Public post tombstone is not a valid matching signed record.');
  }
}

function decodeTombstone(publicationId: string, row: TombstoneRow): PublicPostTombstone {
  const tombstone = jsonObject(row.payload, 'public post tombstone payload') as unknown as PublicPostTombstone;
  validateTombstone(publicationId, tombstone);
  if (tombstone.postId !== row.post_id) {
    throw new Error('PostgreSQL public post tombstone columns and signed payload do not match.');
  }
  return tombstone;
}

function validateFreeze(publicationId: string, freeze: PublicPostingFreeze): void {
  if (freeze?.publicationId !== publicationId
    || !verifyPublicPostingFreeze(freeze, [freeze.signerKeyHex])) {
    throw new TypeError('Public posting freeze is not a valid matching signed record.');
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

export class PostgresCommunityDescriptorStore implements CommunityDescriptorStore {
  constructor(private readonly context: PostgresStoreContext) {}

  async getHighestRevision(communityId: string): Promise<HighestRevision | null> {
    assertText('Community id', communityId, 128);
    const result = await query<DescriptorRow>(
      this.context,
      'get community descriptor revision',
      `SELECT revision, descriptor_hash
       FROM community.descriptor_revisions
       WHERE community_id = $1`,
      [communityId],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (typeof row.descriptor_hash !== 'string' || row.descriptor_hash.length === 0) {
      throw new Error('PostgreSQL community descriptor hash is invalid.');
    }
    return {
      revision: safeInteger(row.revision, 'community descriptor revision'),
      descriptorHash: row.descriptor_hash,
    };
  }

  async claimRevision(
    communityId: string,
    revision: number,
    descriptorHash: string,
  ): Promise<DescriptorRevisionClaim> {
    assertText('Community id', communityId, 128);
    assertRevision(revision, 'Community descriptor revision');
    assertText('Community descriptor hash', descriptorHash, 256);
    return locked(
      this.context,
      'claim community descriptor revision',
      'community.descriptor-revision',
      communityId,
      async () => {
        const prior = await this.getHighestRevision(communityId);
        if (prior) {
          if (revision < prior.revision) return 'stale';
          if (revision === prior.revision) {
            return descriptorHash === prior.descriptorHash ? 'idempotent' : 'conflict';
          }
          const updated = await query(
            this.context,
            'advance community descriptor revision',
            `UPDATE community.descriptor_revisions
             SET revision = $2, descriptor_hash = $3, updated_at = clock_timestamp()
             WHERE community_id = $1 AND revision = $4`,
            [communityId, revision, descriptorHash, prior.revision],
          );
          if (updated.rowCount !== 1) {
            throw new Error('PostgreSQL community descriptor revision changed during its lock.');
          }
          return 'inserted';
        }
        await query(
          this.context,
          'insert community descriptor revision',
          `INSERT INTO community.descriptor_revisions (
             community_id, revision, descriptor_hash
           ) VALUES ($1, $2, $3)`,
          [communityId, revision, descriptorHash],
        );
        return 'inserted';
      },
    );
  }

  async recordRevision(communityId: string, revision: number, descriptorHash: string): Promise<void> {
    await this.claimRevision(communityId, revision, descriptorHash);
  }
}

export class PostgresPublicationStore implements PublicationStore {
  constructor(private readonly context: PostgresStoreContext) {}

  withPublicationWriteLock<T>(publicationId: string, operation: () => Promise<T>): Promise<T> {
    assertText('Publication id', publicationId, 128);
    return locked(
      this.context,
      'lock community publication',
      'community.publication',
      publicationId,
      operation,
    );
  }

  async get(publicationId: string): Promise<StoredPublication | null> {
    assertText('Publication id', publicationId, 128);
    const result = await query<PublicationRow>(
      this.context,
      'get community publication',
      `SELECT publication_id, descriptor_revision, payload, lifecycle_version
       FROM community.publications
       WHERE publication_id = $1`,
      [publicationId],
    );
    return result.rows[0] ? decodePublication(result.rows[0]) : null;
  }

  async put(publicationId: string, record: StoredPublication): Promise<void> {
    const payload = encodePublication(publicationId, record);
    await this.withPublicationWriteLock(publicationId, async () => {
      await query(
        this.context,
        'put community publication',
        `INSERT INTO community.publications (
           publication_id, descriptor_revision, payload
         ) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (publication_id) DO UPDATE SET
           descriptor_revision = EXCLUDED.descriptor_revision,
           payload = EXCLUDED.payload,
           lifecycle_version = community.publications.lifecycle_version + 1,
           updated_at = clock_timestamp()`,
        [publicationId, record.signed.descriptor.revision, payload],
      );
    });
  }

  async replace(
    publicationId: string,
    expectedRevision: number | null,
    record: StoredPublication,
  ): Promise<PublicationReplaceOutcome> {
    const payload = encodePublication(publicationId, record);
    if (expectedRevision !== null) assertRevision(expectedRevision, 'Expected publication revision');
    if (expectedRevision === null) {
      const inserted = await query(
        this.context,
        'insert community publication replacement',
        `INSERT INTO community.publications (
           publication_id, descriptor_revision, payload
         ) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (publication_id) DO NOTHING`,
        [publicationId, record.signed.descriptor.revision, payload],
      );
      return inserted.rowCount === 1 ? 'inserted' : 'conflict';
    }
    const updated = await query(
      this.context,
      'replace community publication',
      `UPDATE community.publications
       SET descriptor_revision = $3,
           payload = $4::jsonb,
           lifecycle_version = lifecycle_version + 1,
           updated_at = clock_timestamp()
       WHERE publication_id = $1 AND descriptor_revision = $2`,
      [publicationId, expectedRevision, record.signed.descriptor.revision, payload],
    );
    return updated.rowCount === 1 ? 'updated' : 'conflict';
  }

  async list(): Promise<StoredPublication[]> {
    const result = await query<PublicationRow>(
      this.context,
      'list community publications',
      `SELECT publication_id, descriptor_revision, payload, lifecycle_version
       FROM community.publications
       ORDER BY publication_id
       LIMIT $1`,
      [MAX_PUBLICATIONS + 1],
    );
    if (result.rows.length > MAX_PUBLICATIONS) {
      throw new Error('PostgreSQL community publication scan exceeded its hard bound.');
    }
    return result.rows.map(decodePublication);
  }
}

export class PostgresKillStore implements KillStore {
  constructor(private readonly context: PostgresStoreContext) {}

  async recordKill(signed: SignedDescriptorKill): Promise<void> {
    const communityId = signed?.kill?.communityId;
    assertText('Killed community id', communityId, 128);
    if (typeof signed.signature !== 'string' || signed.signature.length === 0) {
      throw new TypeError('Signed descriptor kill must contain a signature.');
    }
    await query(
      this.context,
      'record community kill',
      `INSERT INTO community.kills (community_id, payload)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (community_id) DO NOTHING`,
      [communityId, JSON.stringify(signed)],
    );
  }

  async isKilled(communityId: string): Promise<boolean> {
    assertText('Community id', communityId, 128);
    const result = await query(
      this.context,
      'read live community kill',
      'SELECT 1 FROM community.kills WHERE community_id = $1',
      [communityId],
    );
    return result.rowCount === 1;
  }

  async loadKilledCommunityIds(): Promise<string[]> {
    const result = await query<KillRow>(
      this.context,
      'list community kills',
      `SELECT community_id, payload
       FROM community.kills
       ORDER BY community_id
       LIMIT $1`,
      [MAX_PUBLICATIONS + 1],
    );
    if (result.rows.length > MAX_PUBLICATIONS) {
      throw new Error('PostgreSQL community kill scan exceeded its hard bound.');
    }
    return result.rows.map((row) => decodeKill(row).kill.communityId);
  }
}

export class PostgresReportStore implements ReportStore {
  constructor(private readonly context: PostgresStoreContext) {}

  async get(publicationId: string): Promise<SignedPublicAbuseReport[] | null> {
    assertText('Publication id', publicationId, 128);
    const result = await query<ReportRow>(
      this.context,
      'get community reports',
      `SELECT publication_id, report_key, reason, payload
       FROM community.reports
       WHERE publication_id = $1
       ORDER BY received_at, report_key
       LIMIT $2`,
      [publicationId, MAX_REPORTS + 1],
    );
    if (result.rows.length > MAX_REPORTS) {
      throw new Error('PostgreSQL community report scan exceeded its hard bound.');
    }
    return result.rows.length === 0 ? null : result.rows.map(decodeReport);
  }

  async put(publicationId: string, reports: SignedPublicAbuseReport[]): Promise<void> {
    assertText('Publication id', publicationId, 128);
    if (!Array.isArray(reports) || reports.length > MAX_REPORTS) {
      throw new RangeError('Community report replacement exceeds its hard bound.');
    }
    for (const report of reports) {
      if (!verifyPublicAbuseReport(report) || report.report.publicationId !== publicationId) {
        throw new TypeError('Community report replacement contains an invalid signed report.');
      }
    }
    await locked(
      this.context,
      'replace community reports',
      'community.reports',
      publicationId,
      async () => {
        await query(
          this.context,
          'delete community report replacement',
          'DELETE FROM community.reports WHERE publication_id = $1',
          [publicationId],
        );
        for (const report of reports) {
          await this.insertReport(publicationId, report);
        }
      },
    );
  }

  async appendCapped(
    publicationId: string,
    report: SignedPublicAbuseReport,
    maximumReports: number,
  ): Promise<void> {
    assertText('Publication id', publicationId, 128);
    if (!verifyPublicAbuseReport(report) || report.report.publicationId !== publicationId) {
      throw new TypeError('Community report append requires a valid matching signed report.');
    }
    if (!Number.isSafeInteger(maximumReports) || maximumReports <= 0 || maximumReports > MAX_REPORTS) {
      throw new RangeError(`Community report cap must be between 1 and ${MAX_REPORTS}.`);
    }
    await locked(
      this.context,
      'append capped community report',
      'community.reports',
      publicationId,
      async () => {
        await this.insertReport(publicationId, report);
        await query(
          this.context,
          'prune capped community reports',
          `WITH excess AS (
             SELECT GREATEST(count(*)::integer - $2::integer, 0) AS count
             FROM community.reports
             WHERE publication_id = $1
           ), victims AS (
             SELECT report_key
             FROM community.reports
             WHERE publication_id = $1
             ORDER BY
               CASE WHEN reason IN ('csam', 'illegal') THEN 1 ELSE 0 END,
               received_at,
               report_key
             LIMIT (SELECT count FROM excess)
           )
           DELETE FROM community.reports
           WHERE publication_id = $1
             AND report_key IN (SELECT report_key FROM victims)`,
          [publicationId, maximumReports],
        );
      },
    );
  }

  private async insertReport(
    publicationId: string,
    report: SignedPublicAbuseReport,
  ): Promise<void> {
    await query(
      this.context,
      'insert community report',
      `INSERT INTO community.reports (
         publication_id, report_key, reason, payload
       ) VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (publication_id, report_key) DO NOTHING`,
      [publicationId, reportKey(report), report.report.reason, JSON.stringify(report)],
    );
  }
}

export class PostgresPublicPostStore implements PublicPostStore {
  constructor(private readonly context: PostgresStoreContext) {}

  withPublicationWriteLock<T>(publicationId: string, operation: () => Promise<T>): Promise<T> {
    assertText('Publication id', publicationId, 128);
    return locked(
      this.context,
      'lock public post publication',
      'community.public-posts',
      publicationId,
      operation,
    );
  }

  async isPersonaBlocked(personaPubkey: string): Promise<boolean> {
    this.validatePersona(personaPubkey);
    // Enforcement keys on sha256(lower(pubkey)) so blocks imported from the file
    // adapter (which stores only that hash) enforce identically. The raw pubkey is
    // still hashed at runtime, so no runtime call path changes.
    const result = await query(
      this.context,
      'read blocked public-post persona',
      'SELECT 1 FROM community.blocked_personas WHERE persona_pubkey_hash = $1',
      [blockedPersonaHash(personaPubkey)],
    );
    return result.rowCount === 1;
  }

  async blockPersona(personaPubkey: string): Promise<void> {
    this.validatePersona(personaPubkey);
    // Store both the raw pubkey (known at runtime, kept for audit/reversibility) and the
    // hash (the enforcement key). Conflict is on the hash so a re-block is idempotent and
    // a hash-only imported row is never duplicated by a later runtime block.
    await query(
      this.context,
      'block public-post persona',
      `INSERT INTO community.blocked_personas (persona_pubkey, persona_pubkey_hash)
       VALUES ($1, $2)
       ON CONFLICT (persona_pubkey_hash) DO NOTHING`,
      [personaPubkey.toLowerCase(), blockedPersonaHash(personaPubkey)],
    );
  }

  async listPosts(publicationId: string): Promise<AcceptedPublicPost[]> {
    assertText('Publication id', publicationId, 128);
    const result = await query<PublicPostRow>(
      this.context,
      'list accepted public posts',
      `SELECT post_id, persona_pubkey, accepted_at, payload
       FROM community.public_posts
       WHERE publication_id = $1
       ORDER BY accepted_at, post_id
       LIMIT $2`,
      [publicationId, MAX_PUBLIC_POSTS + 1],
    );
    if (result.rows.length > MAX_PUBLIC_POSTS) {
      throw new Error('PostgreSQL accepted public post scan exceeded its hard bound.');
    }
    return result.rows.map((row) => decodeAcceptedPost(publicationId, row));
  }

  async putPosts(publicationId: string, posts: AcceptedPublicPost[]): Promise<void> {
    assertText('Publication id', publicationId, 128);
    if (!Array.isArray(posts) || posts.length > MAX_PUBLIC_POSTS) {
      throw new RangeError('Accepted public post replacement exceeds its hard bound.');
    }
    for (const post of posts) validateAcceptedPost(publicationId, post);
    await query(
      this.context,
      'replace accepted public posts',
      `WITH deleted AS (
         DELETE FROM community.public_posts WHERE publication_id = $1
       )
       INSERT INTO community.public_posts (
         publication_id, post_id, persona_pubkey, accepted_at, payload
       )
       SELECT
         $1,
         item -> 'post' ->> 'postId',
         item -> 'post' ->> 'personaPubkey',
         (item -> 'receipt' ->> 'acceptedAt')::timestamptz,
         item
       FROM jsonb_array_elements($2::jsonb) AS item`,
      [publicationId, JSON.stringify(posts)],
    );
  }

  async listTombstones(publicationId: string): Promise<PublicPostTombstone[]> {
    assertText('Publication id', publicationId, 128);
    const result = await query<TombstoneRow>(
      this.context,
      'list public post tombstones',
      `SELECT post_id, payload
       FROM community.public_post_tombstones
       WHERE publication_id = $1
       ORDER BY post_id
       LIMIT $2`,
      [publicationId, MAX_PUBLIC_POSTS + 1],
    );
    if (result.rows.length > MAX_PUBLIC_POSTS) {
      throw new Error('PostgreSQL public post tombstone scan exceeded its hard bound.');
    }
    return result.rows.map((row) => decodeTombstone(publicationId, row));
  }

  async putTombstones(publicationId: string, tombstones: PublicPostTombstone[]): Promise<void> {
    assertText('Publication id', publicationId, 128);
    if (!Array.isArray(tombstones) || tombstones.length > MAX_PUBLIC_POSTS) {
      throw new RangeError('Public post tombstone replacement exceeds its hard bound.');
    }
    for (const tombstone of tombstones) validateTombstone(publicationId, tombstone);
    await query(
      this.context,
      'append public post tombstones',
      `INSERT INTO community.public_post_tombstones (publication_id, post_id, payload)
       SELECT $1, item ->> 'postId', item
       FROM jsonb_array_elements($2::jsonb) AS item
       ON CONFLICT (publication_id, post_id) DO NOTHING`,
      [publicationId, JSON.stringify(tombstones)],
    );
  }

  async getFreeze(publicationId: string): Promise<PublicPostingFreeze | null> {
    assertText('Publication id', publicationId, 128);
    const result = await query<FreezeRow>(
      this.context,
      'get public posting freeze',
      `SELECT payload, lifecycle_version
       FROM community.publication_freezes
       WHERE publication_id = $1`,
      [publicationId],
    );
    const row = result.rows[0];
    if (!row) return null;
    safeInteger(row.lifecycle_version, 'public posting freeze lifecycle version');
    const freeze = jsonObject(row.payload, 'public posting freeze payload') as unknown as PublicPostingFreeze;
    validateFreeze(publicationId, freeze);
    return freeze;
  }

  async putFreeze(publicationId: string, freeze: PublicPostingFreeze): Promise<void> {
    assertText('Publication id', publicationId, 128);
    validateFreeze(publicationId, freeze);
    await query(
      this.context,
      'put public posting freeze',
      `INSERT INTO community.publication_freezes (publication_id, payload)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (publication_id) DO UPDATE SET
         payload = EXCLUDED.payload,
         lifecycle_version = community.publication_freezes.lifecycle_version + 1,
         updated_at = clock_timestamp()`,
      [publicationId, JSON.stringify(freeze)],
    );
  }

  async listSubmits(publicationId: string, personaKey: string): Promise<number[]> {
    assertText('Publication id', publicationId, 128);
    this.validatePersona(personaKey);
    const result = await query<SubmitWindowRow>(
      this.context,
      'list public post submit window',
      `SELECT timestamps_ms
       FROM community.public_submit_windows
       WHERE publication_id = $1 AND persona_key = $2`,
      [publicationId, personaKey.toLowerCase()],
    );
    const raw = result.rows[0]?.timestamps_ms;
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      throw new Error('PostgreSQL public post submit window is not an array.');
    }
    return raw.map((timestamp) => safeInteger(timestamp, 'public post submit timestamp'));
  }

  async putSubmits(
    publicationId: string,
    personaKey: string,
    timestampsMs: number[],
  ): Promise<void> {
    assertText('Publication id', publicationId, 128);
    this.validatePersona(personaKey);
    if (!Array.isArray(timestampsMs) || timestampsMs.length > 10_000) {
      throw new RangeError('Public post submit window exceeds its hard bound.');
    }
    for (const timestamp of timestampsMs) safeInteger(timestamp, 'public post submit timestamp');
    if (timestampsMs.length === 0) {
      await query(
        this.context,
        'delete public post submit window',
        `DELETE FROM community.public_submit_windows
         WHERE publication_id = $1 AND persona_key = $2`,
        [publicationId, personaKey.toLowerCase()],
      );
      return;
    }
    await query(
      this.context,
      'put public post submit window',
      `INSERT INTO community.public_submit_windows (
         publication_id, persona_key, timestamps_ms
       ) VALUES ($1, $2, $3::bigint[])
       ON CONFLICT (publication_id, persona_key) DO UPDATE SET
         timestamps_ms = EXCLUDED.timestamps_ms,
         updated_at = clock_timestamp()`,
      [publicationId, personaKey.toLowerCase(), timestampsMs],
    );
  }

  private validatePersona(personaPubkey: string): void {
    if (typeof personaPubkey !== 'string' || !SAFE_HEX_64.test(personaPubkey)) {
      throw new TypeError('Public post persona key must be a 64-character hexadecimal key.');
    }
  }
}
