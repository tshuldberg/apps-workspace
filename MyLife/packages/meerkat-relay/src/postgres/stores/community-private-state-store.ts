import type { QueryResultRow } from 'pg';
import {
  communityDescriptorHash,
  computeMerkleRoot,
  verifyDescriptorOwnerSignature,
  verifySealedTailEntry,
  type ContentManifest,
  type FeedChallenge,
  type SealedTailEntry,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import {
  type AppendPrivateTailInput,
  type AppendPrivateTailOutcome,
  type AuthorizeAndReadPrivateStateOutcome,
  type AuthorizeAndCheckPrivateContentOutcome,
  type AuthorizePrivateRequestInput,
  type AuthorizePrivateRequestOutcome,
  type BeginPrivatePublishInput,
  type BeginPrivatePublishOutcome,
  type CommitPrivatePublishInput,
  type CommitPrivatePublishOutcome,
  type CommunityPrivateStateStore,
  type InspectPrivateChallengeOutcome,
  type IssuePrivateChallengeInput,
  type ExpiredPrivatePublishStage,
  type StoredPrivateCommunityState,
  type StoredPrivateSnapshot,
  toCommunityPrivateStateUnavailableError,
} from '../../community-private-state';
import { PostgresStoreContext } from '../store-context';

const MAX_PRIVATE_SNAPSHOTS = 1_024;
const MAX_PRIVATE_TAIL_READ = 100_000;
const MAX_RECONCILE_BATCH = 10_000;
const HEX_64 = /^[a-f0-9]{64}$/u;
const HEX_128 = /^[a-f0-9]{128}$/u;

interface StateRow extends QueryResultRow {
  community_id: unknown;
  descriptor_revision: unknown;
  descriptor_hash: unknown;
  publish_digest: unknown;
  descriptor_payload: unknown;
}

interface SnapshotRow extends QueryResultRow {
  channel_id: unknown;
  epoch: unknown;
  info_hash: unknown;
  manifest_payload: unknown;
}

interface TailRow extends QueryResultRow {
  replay_key: unknown;
  entry_payload: unknown;
  descriptor_hash: unknown;
  descriptor_revision: unknown;
  descriptor_payload: unknown;
}

interface ChallengeRow extends QueryResultRow {
  issued_at: unknown;
  expires_at: unknown;
  authority_now: unknown;
}

interface CountRow extends QueryResultRow {
  count: unknown;
}

interface StageRow extends QueryResultRow {
  community_id: unknown;
  stage_id: unknown;
  expected_descriptor_hash: unknown;
  descriptor_revision: unknown;
  descriptor_hash: unknown;
  publish_digest: unknown;
  descriptor_payload: unknown;
  snapshots_payload: unknown;
  tail_high_water_payload: unknown;
  expires_at: unknown;
  authority_now: unknown;
}

interface TimestampRow extends QueryResultRow {
  issued_at: unknown;
  expires_at: unknown;
}

interface SnapshotsPayloadRow extends QueryResultRow {
  community_id: unknown;
  stage_id: unknown;
  snapshots_payload: unknown;
}

interface TailHighWaterRow extends QueryResultRow {
  channel_id: unknown;
  tail_id: unknown;
}

function assertText(name: string, value: string, maximum: number): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new TypeError(`${name} must be between 1 and ${maximum} characters.`);
  }
}

function assertPositiveInteger(name: string, value: number, maximum = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${name} must be a positive safe integer no greater than ${maximum}.`);
  }
}

function assertDigest(name: string, value: string, pattern: RegExp): void {
  if (!pattern.test(value)) throw new TypeError(`${name} is not a canonical hexadecimal digest.`);
}

function integer(value: unknown, name: string): number {
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

function timestamp(value: unknown, name: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`PostgreSQL ${name} is not a timestamp.`);
  return date.toISOString();
}

function jsonValue(value: unknown, name: string): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`PostgreSQL ${name} is not valid JSON.`);
  }
}

function jsonObject(value: unknown, name: string): Record<string, unknown> {
  const parsed = jsonValue(value, name);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`PostgreSQL ${name} is not a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function decodeIdentityState(row: StateRow): {
  descriptor: SignedCommunityDescriptor;
  descriptorHash: string;
  publishDigest: string;
} {
  if (typeof row.community_id !== 'string'
    || typeof row.descriptor_hash !== 'string'
    || typeof row.publish_digest !== 'string') {
    throw new Error('PostgreSQL private community state has invalid typed columns.');
  }
  assertDigest('Stored descriptor hash', row.descriptor_hash, HEX_128);
  assertDigest('Stored publish digest', row.publish_digest, HEX_64);
  const descriptor = jsonObject(
    row.descriptor_payload,
    'private community descriptor payload',
  ) as unknown as SignedCommunityDescriptor;
  const revision = integer(row.descriptor_revision, 'private community descriptor revision');
  if (!descriptor?.descriptor
    || descriptor.descriptor.communityId !== row.community_id
    || descriptor.descriptor.revision !== revision
    || !verifyDescriptorOwnerSignature(descriptor)
    || communityDescriptorHash(descriptor) !== row.descriptor_hash) {
    throw new Error('PostgreSQL private community descriptor payload does not match its authority columns.');
  }
  return {
    descriptor,
    descriptorHash: row.descriptor_hash,
    publishDigest: row.publish_digest,
  };
}

function decodeSnapshot(row: SnapshotRow): StoredPrivateSnapshot {
  if (typeof row.channel_id !== 'string' || row.channel_id.length === 0
    || typeof row.info_hash !== 'string' || row.info_hash.length === 0) {
    throw new Error('PostgreSQL private community snapshot has invalid typed columns.');
  }
  const epoch = integer(row.epoch, 'private community snapshot epoch');
  const manifest = jsonObject(
    row.manifest_payload,
    'private community snapshot manifest',
  ) as unknown as ContentManifest;
  if (!manifest?.infoHash
    || manifest.infoHash !== row.info_hash
    || !Array.isArray(manifest.pieces)
    || manifest.pieces.length === 0
    || computeMerkleRoot(manifest.pieces) !== manifest.merkleRoot) {
    throw new Error('PostgreSQL private community snapshot manifest is inconsistent.');
  }
  return {
    channelId: row.channel_id,
    manifest,
    record: { epoch, infoHash: row.info_hash },
  };
}

function decodeTail(row: TailRow, communityId: string): SealedTailEntry {
  if (typeof row.replay_key !== 'string' || !HEX_64.test(row.replay_key)) {
    throw new Error('PostgreSQL private community tail replay key is invalid.');
  }
  if (typeof row.descriptor_hash !== 'string' || !HEX_128.test(row.descriptor_hash)) {
    throw new Error('PostgreSQL private community tail descriptor hash is invalid.');
  }
  const descriptor = jsonObject(
    row.descriptor_payload,
    'private community tail descriptor history',
  ) as unknown as SignedCommunityDescriptor;
  const revision = integer(row.descriptor_revision, 'private community tail descriptor revision');
  if (!descriptor?.descriptor
    || descriptor.descriptor.communityId !== communityId
    || descriptor.descriptor.revision !== revision
    || !verifyDescriptorOwnerSignature(descriptor)
    || communityDescriptorHash(descriptor) !== row.descriptor_hash) {
    throw new Error('PostgreSQL private community tail descriptor history is inconsistent.');
  }
  const entry = jsonObject(row.entry_payload, 'private community tail entry') as unknown as SealedTailEntry;
  if (!entry || !verifySealedTailEntry(entry, descriptor.descriptor).ok) {
    throw new Error('PostgreSQL private community tail entry does not verify against its descriptor.');
  }
  return entry;
}

function decodeStageSnapshots(value: unknown): StoredPrivateSnapshot[] {
  const parsed = jsonValue(value, 'private community staged snapshots');
  if (!Array.isArray(parsed) || parsed.length > MAX_PRIVATE_SNAPSHOTS) {
    throw new Error('PostgreSQL private community staged snapshots are invalid or unbounded.');
  }
  return parsed.map((snapshot, index) => {
    if (typeof snapshot !== 'object' || snapshot === null) {
      throw new Error(`PostgreSQL staged snapshot ${index} is invalid.`);
    }
    const candidate = snapshot as Partial<StoredPrivateSnapshot>;
    if (typeof candidate.channelId !== 'string'
      || !candidate.manifest?.infoHash
      || !candidate.record
      || candidate.record.infoHash !== candidate.manifest.infoHash
      || !Number.isSafeInteger(candidate.record.epoch)
      || candidate.record.epoch < 0
      || computeMerkleRoot(candidate.manifest.pieces) !== candidate.manifest.merkleRoot) {
      throw new Error(`PostgreSQL staged snapshot ${index} has invalid metadata.`);
    }
    return candidate as StoredPrivateSnapshot;
  });
}

function decodeTailHighWater(value: unknown): Record<string, number> {
  const parsed = jsonObject(value, 'private publish tail high water');
  const decoded: Record<string, number> = {};
  for (const [channelId, tailId] of Object.entries(parsed)) {
    assertText('Staged tail high-water channel id', channelId, 256);
    decoded[channelId] = integer(tailId, 'private publish tail high-water id');
  }
  return decoded;
}

function count(row: CountRow | undefined, name: string): number {
  if (!row) throw new Error(`PostgreSQL ${name} count row is missing.`);
  return integer(row.count, `${name} count`);
}

/** PostgreSQL authority shared safely by every first-party CommunityNode replica. */
export class PostgresCommunityPrivateStateStore implements CommunityPrivateStateStore {
  constructor(private readonly context: PostgresStoreContext) {}

  async issueChallenge(input: IssuePrivateChallengeInput): Promise<FeedChallenge | null> {
    this.validateIssue(input);
    return this.run('issue private community challenge', () =>
      this.context.withAdvisoryTransactionLock(
        'community.private-challenge-issuance',
        'global',
        async () => {
          await this.context.query(
            'DELETE FROM community.private_challenges WHERE expires_at <= clock_timestamp()',
          );
          const existing = await this.context.query<CountRow>(
            `SELECT count(*)::bigint AS count
             FROM community.private_challenges
             WHERE community_id = $1`,
            [input.communityId],
          );
          if (count(existing.rows[0], 'private challenge') >= input.ceilingPerCommunity) {
            return null;
          }

          const alreadyTracked = await this.context.query<CountRow>(
            `SELECT count(*)::bigint AS count
             FROM (
               SELECT community_id FROM community.private_states WHERE community_id = $1
               UNION
               SELECT community_id FROM community.private_challenges WHERE community_id = $1
             ) AS tracked`,
            [input.communityId],
          );
          if (count(alreadyTracked.rows[0], 'tracked private community') === 0) {
            const unclaimed = await this.context.query<CountRow>(
              `SELECT count(DISTINCT c.community_id)::bigint AS count
               FROM community.private_challenges AS c
               LEFT JOIN community.private_states AS s USING (community_id)
               WHERE s.community_id IS NULL`,
            );
            if (count(unclaimed.rows[0], 'unclaimed private community') >= input.maxUnclaimedCommunities) {
              await this.context.query(
                `DELETE FROM community.private_challenges
                 WHERE community_id = (
                   SELECT c.community_id
                   FROM community.private_challenges AS c
                   LEFT JOIN community.private_states AS s USING (community_id)
                   WHERE s.community_id IS NULL
                   GROUP BY c.community_id
                   ORDER BY min(c.issued_at), c.community_id
                   LIMIT 1
                 )`,
              );
            }
          }

          const inserted = await this.context.query<TimestampRow>(
            `INSERT INTO community.private_challenges (
               community_id, nonce, issued_at, expires_at
             ) VALUES (
               $1, $2, clock_timestamp(),
               clock_timestamp() + $3 * INTERVAL '1 millisecond'
             )
             RETURNING issued_at, expires_at`,
            [input.communityId, input.nonce, input.ttlMs],
          );
          const row = inserted.rows[0];
          if (!row) throw new Error('PostgreSQL private challenge insert returned no row.');
          return {
            nonce: input.nonce,
            issuedAt: timestamp(row.issued_at, 'private challenge issued_at'),
            expiresAt: timestamp(row.expires_at, 'private challenge expires_at'),
          };
        },
      ));
  }

  async inspectChallenge(
    communityId: string,
    nonce: string,
    _nowMs: number,
  ): Promise<InspectPrivateChallengeOutcome> {
    this.validateCommunityAndNonce(communityId, nonce);
    return this.run('inspect private community challenge', () =>
      this.withCommunityLock(communityId, async () => {
        const challengeResult = await this.context.query<ChallengeRow>(
          `SELECT issued_at, expires_at, clock_timestamp() AS authority_now
           FROM community.private_challenges
           WHERE community_id = $1 AND nonce = $2
           FOR UPDATE`,
          [communityId, nonce],
        );
        const challenge = challengeResult.rows[0];
        if (!challenge) return { outcome: 'bad_nonce' };
        const authorityNow = timestamp(challenge.authority_now, 'private challenge authority clock');
        const expiresAt = timestamp(challenge.expires_at, 'private challenge expires_at');
        if (Date.parse(expiresAt) <= Date.parse(authorityNow)) {
          await this.context.query(
            `DELETE FROM community.private_challenges
             WHERE community_id = $1 AND nonce = $2`,
            [communityId, nonce],
          );
          return { outcome: 'expired' };
        }
        const stateResult = await this.context.query<StateRow>(
          `SELECT community_id, descriptor_revision, descriptor_hash,
                  publish_digest, descriptor_payload
           FROM community.private_states
           WHERE community_id = $1`,
          [communityId],
        );
        const stateRow = stateResult.rows[0];
        return {
          outcome: 'ready',
          context: {
            authorityNow,
            expiresAt,
            state: stateRow ? decodeIdentityState(stateRow) : null,
          },
        };
      }));
  }

  async authorizeRequest(
    input: AuthorizePrivateRequestInput,
  ): Promise<AuthorizePrivateRequestOutcome> {
    this.validateAuthorization(input);
    return this.run('authorize private community request', () =>
      this.withCommunityLock(input.communityId, () => this.authorizeLocked(input)));
  }

  async authorizeAndReadState(
    input: AuthorizePrivateRequestInput,
  ): Promise<AuthorizeAndReadPrivateStateOutcome> {
    this.validateAuthorization(input);
    return this.run('authorize and read private community state', () =>
      this.withCommunityLock(input.communityId, async () => {
        const authorization = await this.authorizeLocked(input);
        if (authorization !== 'accepted') return { outcome: authorization };
        const state = await this.readStateLocked(input.communityId);
        return state
          ? { outcome: 'accepted', state }
          : { outcome: 'state_changed' };
      }));
  }

  async authorizeAndCheckContent(
    input: AuthorizePrivateRequestInput,
    infoHash: string,
  ): Promise<AuthorizeAndCheckPrivateContentOutcome> {
    this.validateAuthorization(input);
    assertText('Private snapshot info hash', infoHash, 256);
    return this.run('authorize private community content read', () =>
      this.withCommunityLock(input.communityId, async () => {
        const authorization = await this.authorizeLocked(input);
        if (authorization !== 'accepted') return { outcome: authorization };
        const owned = await this.context.query(
          `SELECT 1 FROM community.private_snapshots
           WHERE community_id = $1 AND info_hash = $2
           LIMIT 1`,
          [input.communityId, infoHash],
        );
        return { outcome: 'accepted', owned: owned.rowCount === 1 };
      }));
  }

  async appendTail(input: AppendPrivateTailInput): Promise<AppendPrivateTailOutcome> {
    this.validateAuthorization(input);
    assertDigest('Private tail replay key', input.replayKey, HEX_64);
    assertPositiveInteger('Maximum private tail entries', input.maximumEntriesPerChannel, 100_000);
    return this.run('append private community tail', () =>
      this.withCommunityLock(input.communityId, async () => {
        const identity = await this.identityState(input.communityId);
        if (!identity || identity.descriptorHash !== input.expectedDescriptorHash) {
          return { outcome: 'state_changed' };
        }
        const replay = await this.context.query(
          `SELECT 1 FROM community.private_tail
           WHERE community_id = $1 AND replay_key = $2
           LIMIT 1`,
          [input.communityId, input.replayKey],
        );
        const tailCount = await this.context.query<CountRow>(
          `SELECT count(*)::bigint AS count
           FROM community.private_tail
           WHERE community_id = $1 AND channel_id = $2`,
          [input.communityId, input.entry.channelId],
        );
        if (replay.rowCount !== 1
          && count(tailCount.rows[0], 'private tail channel') >= input.maximumEntriesPerChannel) {
          return { outcome: 'tail_full' };
        }
        const authorization = await this.authorizeLocked(input);
        if (authorization !== 'accepted') return { outcome: authorization };
        if (replay.rowCount === 1) return { outcome: 'duplicate' };
        const inserted = await this.context.query(
          `INSERT INTO community.private_tail (
             community_id, channel_id, descriptor_hash, replay_key, entry_payload
           ) VALUES ($1, $2, $3, $4, $5::jsonb)
           ON CONFLICT (community_id, replay_key) DO NOTHING
           RETURNING tail_id`,
          [
            input.communityId,
            input.entry.channelId,
            identity.descriptorHash,
            input.replayKey,
            JSON.stringify(input.entry),
          ],
        );
        return { outcome: inserted.rowCount === 1 ? 'inserted' : 'duplicate' };
      }));
  }

  async getState(communityId: string): Promise<StoredPrivateCommunityState | null> {
    assertText('Community id', communityId, 128);
    return this.run('read private community state', () =>
      this.withCommunityLock(communityId, () => this.readStateLocked(communityId)));
  }

  async beginPublish(input: BeginPrivatePublishInput): Promise<BeginPrivatePublishOutcome> {
    this.validatePublish(input);
    return this.run('stage private community publish', () =>
      this.withCommunityLock(input.communityId, async () => {
        const active = await this.identityState(input.communityId);
        if (active?.publishDigest === input.publishDigest) {
          return { outcome: 'idempotent', stageId: input.stageId };
        }
        if ((active?.descriptorHash ?? null) !== input.expectedDescriptorHash) {
          return { outcome: 'conflict' };
        }
        const priorRevision = active?.descriptor.descriptor.revision ?? null;
        const revision = input.descriptor.descriptor.revision;
        if (priorRevision !== null && revision < priorRevision) return { outcome: 'stale' };
        if (priorRevision !== null && revision === priorRevision
          && active?.descriptorHash !== input.descriptorHash) return { outcome: 'conflict' };

        const pending = await this.context.query<StageRow>(
          `SELECT community_id, stage_id, expected_descriptor_hash,
                  descriptor_revision, descriptor_hash, publish_digest,
                  descriptor_payload, snapshots_payload, tail_high_water_payload, expires_at,
                  clock_timestamp() AS authority_now
           FROM community.private_publish_stages
           WHERE community_id = $1
           FOR UPDATE`,
          [input.communityId],
        );
        const pendingRow = pending.rows[0];
        if (pendingRow) {
          if (pendingRow.stage_id === input.stageId
            && pendingRow.publish_digest === input.publishDigest) {
            return { outcome: 'idempotent', stageId: input.stageId };
          }
          return { outcome: 'busy' };
        }

        const highWaterRows = input.snapshots.length === 0
          ? []
          : (await this.context.query<TailHighWaterRow>(
            `SELECT channel_id, max(tail_id)::bigint AS tail_id
             FROM community.private_tail
             WHERE community_id = $1 AND channel_id = ANY($2::text[])
             GROUP BY channel_id`,
            [input.communityId, input.snapshots.map((snapshot) => snapshot.channelId)],
          )).rows;
        const tailHighWater: Record<string, number> = {};
        for (const row of highWaterRows) {
          if (typeof row.channel_id !== 'string') {
            throw new Error('PostgreSQL private tail high-water channel is invalid.');
          }
          tailHighWater[row.channel_id] = integer(row.tail_id, 'private tail high-water id');
        }

        await this.context.query(
          `INSERT INTO community.private_publish_stages (
             community_id, stage_id, expected_descriptor_hash,
             descriptor_revision, descriptor_hash, publish_digest,
             descriptor_payload, snapshots_payload, tail_high_water_payload,
             created_at, expires_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb,
             $9::jsonb, clock_timestamp(),
             clock_timestamp() + $10 * INTERVAL '1 millisecond'
           )`,
          [
            input.communityId,
            input.stageId,
            input.expectedDescriptorHash,
            input.descriptor.descriptor.revision,
            input.descriptorHash,
            input.publishDigest,
            JSON.stringify(input.descriptor),
            JSON.stringify(input.snapshots),
            JSON.stringify(tailHighWater),
            input.stageTtlMs,
          ],
        );
        return { outcome: 'staged', stageId: input.stageId };
      }));
  }

  async commitPublish(input: CommitPrivatePublishInput): Promise<CommitPrivatePublishOutcome> {
    assertText('Community id', input.communityId, 128);
    assertDigest('Private publish stage id', input.stageId, HEX_64);
    assertDigest('Private publish digest', input.publishDigest, HEX_64);
    return this.run('commit private community publish', () =>
      this.withCommunityLock(input.communityId, async () => {
        const active = await this.identityState(input.communityId);
        if (active?.publishDigest === input.publishDigest) {
          return { outcome: 'idempotent', previousInfoHashes: [] };
        }
        const stageResult = await this.context.query<StageRow>(
          `SELECT community_id, stage_id, expected_descriptor_hash,
                  descriptor_revision, descriptor_hash, publish_digest,
                  descriptor_payload, snapshots_payload, tail_high_water_payload, expires_at,
                  clock_timestamp() AS authority_now
           FROM community.private_publish_stages
           WHERE community_id = $1
           FOR UPDATE`,
          [input.communityId],
        );
        const stage = stageResult.rows[0];
        if (!stage || stage.stage_id !== input.stageId || stage.publish_digest !== input.publishDigest) {
          return { outcome: 'missing' };
        }
        const expiresAt = timestamp(stage.expires_at, 'private publish stage expires_at');
        const authorityNow = timestamp(stage.authority_now, 'private publish stage authority clock');
        if (Date.parse(expiresAt) <= Date.parse(authorityNow)) {
          return { outcome: 'expired' };
        }
        const expectedHash = stage.expected_descriptor_hash;
        if (expectedHash !== null && typeof expectedHash !== 'string') {
          throw new Error('PostgreSQL private publish stage expected hash is invalid.');
        }
        if ((active?.descriptorHash ?? null) !== expectedHash) return { outcome: 'conflict' };
        if (typeof stage.descriptor_hash !== 'string'
          || typeof stage.publish_digest !== 'string'
          || typeof stage.community_id !== 'string') {
          throw new Error('PostgreSQL private publish stage typed columns are invalid.');
        }
        const descriptor = jsonObject(
          stage.descriptor_payload,
          'private publish staged descriptor',
        ) as unknown as SignedCommunityDescriptor;
        const revision = integer(stage.descriptor_revision, 'private publish staged revision');
        if (!descriptor?.descriptor
          || descriptor.descriptor.communityId !== input.communityId
          || descriptor.descriptor.revision !== revision
          || !verifyDescriptorOwnerSignature(descriptor)
          || communityDescriptorHash(descriptor) !== stage.descriptor_hash) {
          throw new Error('PostgreSQL private publish staged descriptor is inconsistent.');
        }
        const snapshots = decodeStageSnapshots(stage.snapshots_payload);
        const tailHighWater = decodeTailHighWater(stage.tail_high_water_payload);
        const previousResult = await this.context.query<SnapshotRow>(
          `SELECT channel_id, epoch, info_hash, manifest_payload
           FROM community.private_snapshots
           WHERE community_id = $1
           ORDER BY channel_id
           LIMIT $2`,
          [input.communityId, MAX_PRIVATE_SNAPSHOTS + 1],
        );
        if (previousResult.rows.length > MAX_PRIVATE_SNAPSHOTS) {
          throw new Error('PostgreSQL previous private snapshot list is unbounded.');
        }
        const previousInfoHashes = [
          ...new Set(previousResult.rows.map((row) => decodeSnapshot(row).manifest.infoHash)),
        ];

        await this.context.query(
          `INSERT INTO community.private_descriptor_history (
             community_id, descriptor_hash, descriptor_revision, descriptor_payload
           ) VALUES ($1, $2, $3, $4::jsonb)
           ON CONFLICT (community_id, descriptor_hash) DO NOTHING`,
          [input.communityId, stage.descriptor_hash, revision, JSON.stringify(descriptor)],
        );
        await this.context.query(
          `INSERT INTO community.private_states (
             community_id, descriptor_revision, descriptor_hash,
             publish_digest, descriptor_payload, lifecycle_version,
             created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5::jsonb, 1, clock_timestamp(), clock_timestamp())
           ON CONFLICT (community_id) DO UPDATE SET
             descriptor_revision = EXCLUDED.descriptor_revision,
             descriptor_hash = EXCLUDED.descriptor_hash,
             publish_digest = EXCLUDED.publish_digest,
             descriptor_payload = EXCLUDED.descriptor_payload,
             lifecycle_version = community.private_states.lifecycle_version + 1,
             updated_at = clock_timestamp()`,
          [
            input.communityId,
            revision,
            stage.descriptor_hash,
            stage.publish_digest,
            JSON.stringify(descriptor),
          ],
        );
        await this.context.query(
          'DELETE FROM community.private_snapshots WHERE community_id = $1',
          [input.communityId],
        );
        if (snapshots.length > 0) {
          const payload = snapshots.map((snapshot) => ({
            channel_id: snapshot.channelId,
            epoch: snapshot.record.epoch,
            info_hash: snapshot.manifest.infoHash,
            manifest_payload: snapshot.manifest,
          }));
          await this.context.query(
            `INSERT INTO community.private_snapshots (
               community_id, channel_id, epoch, info_hash, manifest_payload
             )
             SELECT $1, staged.channel_id, staged.epoch,
                    staged.info_hash, staged.manifest_payload
             FROM jsonb_to_recordset($2::jsonb) AS staged(
               channel_id text,
               epoch bigint,
               info_hash text,
               manifest_payload jsonb
             )`,
            [input.communityId, JSON.stringify(payload)],
          );
        }
        for (const [channelId, tailId] of Object.entries(tailHighWater)) {
          await this.context.query(
            `DELETE FROM community.private_tail
             WHERE community_id = $1 AND channel_id = $2 AND tail_id <= $3`,
            [input.communityId, channelId, tailId],
          );
        }
        await this.context.query(
          'DELETE FROM community.private_publish_stages WHERE community_id = $1',
          [input.communityId],
        );
        await this.context.query(
          `DELETE FROM community.private_descriptor_history AS history
           WHERE history.community_id = $1
             AND history.descriptor_hash <> $2
             AND NOT EXISTS (
               SELECT 1 FROM community.private_tail AS tail
               WHERE tail.community_id = history.community_id
                 AND tail.descriptor_hash = history.descriptor_hash
             )`,
          [input.communityId, stage.descriptor_hash],
        );
        return { outcome: 'committed', previousInfoHashes };
      }));
  }

  async isContentReferenced(infoHash: string): Promise<boolean> {
    assertText('Private snapshot info hash', infoHash, 256);
    return this.run('check private community content references', async () => {
      const result = await this.context.query(
        `SELECT 1 FROM community.private_snapshots
         WHERE info_hash = $1
         LIMIT 1`,
        [infoHash],
      );
      return result.rowCount === 1;
    });
  }

  async listExpiredPublishStages(
    limit: number,
    _nowMs: number,
  ): Promise<ExpiredPrivatePublishStage[]> {
    assertPositiveInteger('Private publish reconciliation limit', limit, MAX_RECONCILE_BATCH);
    return this.run('list expired private community publish stages', async () => {
      const result = await this.context.query<SnapshotsPayloadRow>(
        `SELECT community_id, stage_id, snapshots_payload
         FROM community.private_publish_stages
         WHERE expires_at <= clock_timestamp()
         ORDER BY expires_at, community_id
         LIMIT $1`,
        [limit],
      );
      return result.rows.map((row) => {
        if (typeof row.community_id !== 'string' || typeof row.stage_id !== 'string') {
          throw new Error('PostgreSQL expired private publish stage identity is invalid.');
        }
        return {
          communityId: row.community_id,
          stageId: row.stage_id,
          candidateInfoHashes: [
            ...new Set(decodeStageSnapshots(row.snapshots_payload)
              .map((snapshot) => snapshot.manifest.infoHash)),
          ],
        };
      });
    });
  }

  async completeExpiredPublishStage(
    communityId: string,
    stageId: string,
    _nowMs: number,
  ): Promise<boolean> {
    assertText('Community id', communityId, 128);
    assertDigest('Private publish stage id', stageId, HEX_64);
    return this.run('complete expired private community publish stage', () =>
      this.withCommunityLock(communityId, async () => {
        const result = await this.context.query(
          `DELETE FROM community.private_publish_stages
           WHERE community_id = $1 AND stage_id = $2
             AND expires_at <= clock_timestamp()`,
          [communityId, stageId],
        );
        return result.rowCount === 1;
      }));
  }

  async sweepExpired(_nowMs: number): Promise<void> {
    await this.run('sweep private community state', () =>
      this.context.transaction(async () => {
        await this.context.query(
          'DELETE FROM community.private_challenges WHERE expires_at <= clock_timestamp()',
        );
        await this.context.query(
          'DELETE FROM community.private_rate_hits WHERE expires_at <= clock_timestamp()',
        );
      }));
  }

  async trackedCommunityCount(_nowMs: number): Promise<number> {
    return this.run('count private community state', async () => {
      const result = await this.context.query<CountRow>(
        `SELECT count(*)::bigint AS count
         FROM (
           SELECT community_id FROM community.private_states
           UNION
           SELECT community_id
           FROM community.private_challenges
           WHERE expires_at > clock_timestamp()
         ) AS tracked`,
      );
      return count(result.rows[0], 'tracked private community');
    });
  }

  private async readStateLocked(communityId: string): Promise<StoredPrivateCommunityState | null> {
    const stateResult = await this.context.query<StateRow>(
      `SELECT community_id, descriptor_revision, descriptor_hash,
              publish_digest, descriptor_payload
       FROM community.private_states
       WHERE community_id = $1`,
      [communityId],
    );
    const stateRow = stateResult.rows[0];
    if (!stateRow) return null;
    const identity = decodeIdentityState(stateRow);
    const snapshotResult = await this.context.query<SnapshotRow>(
      `SELECT channel_id, epoch, info_hash, manifest_payload
       FROM community.private_snapshots
       WHERE community_id = $1
       ORDER BY channel_id
       LIMIT $2`,
      [communityId, MAX_PRIVATE_SNAPSHOTS + 1],
    );
    if (snapshotResult.rows.length > MAX_PRIVATE_SNAPSHOTS) {
      throw new Error('PostgreSQL private community snapshot list is unbounded.');
    }
    const tailResult = await this.context.query<TailRow>(
      `SELECT t.replay_key, t.entry_payload, t.descriptor_hash,
              h.descriptor_revision, h.descriptor_payload
       FROM community.private_tail AS t
       JOIN community.private_descriptor_history AS h
         ON h.community_id = t.community_id
        AND h.descriptor_hash = t.descriptor_hash
       WHERE t.community_id = $1
       ORDER BY t.tail_id
       LIMIT $2`,
      [communityId, MAX_PRIVATE_TAIL_READ + 1],
    );
    if (tailResult.rows.length > MAX_PRIVATE_TAIL_READ) {
      throw new Error('PostgreSQL private community tail list is unbounded.');
    }
    return {
      ...identity,
      snapshots: snapshotResult.rows.map(decodeSnapshot),
      tail: tailResult.rows.map((row) => decodeTail(row, communityId)),
    };
  }

  private async authorizeLocked(
    input: AuthorizePrivateRequestInput,
  ): Promise<AuthorizePrivateRequestOutcome> {
    const challengeResult = await this.context.query<ChallengeRow>(
      `SELECT issued_at, expires_at, clock_timestamp() AS authority_now
       FROM community.private_challenges
       WHERE community_id = $1 AND nonce = $2
       FOR UPDATE`,
      [input.communityId, input.nonce],
    );
    const challenge = challengeResult.rows[0];
    if (!challenge) return 'bad_nonce';
    const authorityNow = timestamp(challenge.authority_now, 'private authorization authority clock');
    const expiresAt = timestamp(challenge.expires_at, 'private authorization challenge expiry');
    if (Date.parse(expiresAt) <= Date.parse(authorityNow)) {
      await this.context.query(
        `DELETE FROM community.private_challenges
         WHERE community_id = $1 AND nonce = $2`,
        [input.communityId, input.nonce],
      );
      return 'expired';
    }
    const identity = await this.identityState(input.communityId);
    if ((identity?.descriptorHash ?? null) !== input.expectedDescriptorHash) return 'state_changed';

    if (input.action) {
      await this.context.query(
        `DELETE FROM community.private_rate_hits
         WHERE community_id = $1 AND principal_hash = $2
           AND action = $3 AND expires_at <= clock_timestamp()`,
        [input.communityId, input.principalHash, input.action],
      );
      const hits = await this.context.query<CountRow>(
        `SELECT count(*)::bigint AS count
         FROM community.private_rate_hits
         WHERE community_id = $1 AND principal_hash = $2
           AND action = $3 AND expires_at > clock_timestamp()`,
        [input.communityId, input.principalHash, input.action],
      );
      if (count(hits.rows[0], 'private rate window') >= (input.ceiling ?? 0)) {
        return 'rate_limited';
      }
      await this.context.query(
        `INSERT INTO community.private_rate_hits (
           community_id, principal_hash, action, occurred_at, expires_at
         ) VALUES (
           $1, $2, $3, clock_timestamp(),
           clock_timestamp() + $4 * INTERVAL '1 millisecond'
         )`,
        [input.communityId, input.principalHash, input.action, input.windowMs],
      );
    }
    if (input.consume) {
      const consumed = await this.context.query(
        `DELETE FROM community.private_challenges
         WHERE community_id = $1 AND nonce = $2`,
        [input.communityId, input.nonce],
      );
      if (consumed.rowCount !== 1) return 'bad_nonce';
    }
    return 'accepted';
  }

  private async identityState(communityId: string): Promise<ReturnType<typeof decodeIdentityState> | null> {
    const result = await this.context.query<StateRow>(
      `SELECT community_id, descriptor_revision, descriptor_hash,
              publish_digest, descriptor_payload
       FROM community.private_states
       WHERE community_id = $1`,
      [communityId],
    );
    const row = result.rows[0];
    return row ? decodeIdentityState(row) : null;
  }

  private withCommunityLock<T>(communityId: string, operation: () => Promise<T>): Promise<T> {
    return this.context.withAdvisoryTransactionLock(
      'community.private-state',
      communityId,
      operation,
    );
  }

  private validateCommunityAndNonce(communityId: string, nonce: string): void {
    assertText('Community id', communityId, 128);
    if (!/^[a-f0-9]{48}$/u.test(nonce)) {
      throw new TypeError('Private challenge nonce is not 24-byte hexadecimal.');
    }
  }

  private validateIssue(input: IssuePrivateChallengeInput): void {
    this.validateCommunityAndNonce(input.communityId, input.nonce);
    assertPositiveInteger('Challenge TTL', input.ttlMs, 24 * 60 * 60 * 1000);
    assertPositiveInteger('Challenge ceiling', input.ceilingPerCommunity, 100_000);
    assertPositiveInteger('Maximum unclaimed communities', input.maxUnclaimedCommunities, 1_000_000);
  }

  private validateAuthorization(input: AuthorizePrivateRequestInput): void {
    this.validateCommunityAndNonce(input.communityId, input.nonce);
    if (input.expectedDescriptorHash !== null) {
      assertDigest('Expected private descriptor hash', input.expectedDescriptorHash, HEX_128);
    }
    if (input.action) {
      assertDigest('Private rate principal hash', input.principalHash ?? '', HEX_64);
      assertPositiveInteger('Private rate ceiling', input.ceiling ?? 0, 100_000);
      assertPositiveInteger('Private rate window', input.windowMs ?? 0, 24 * 60 * 60 * 1000);
    }
  }

  private validatePublish(input: BeginPrivatePublishInput): void {
    assertText('Community id', input.communityId, 128);
    if (input.descriptor?.descriptor?.communityId !== input.communityId
      || !verifyDescriptorOwnerSignature(input.descriptor)
      || communityDescriptorHash(input.descriptor) !== input.descriptorHash) {
      throw new TypeError('Private publish descriptor is invalid or mismatched.');
    }
    if (input.expectedDescriptorHash !== null) {
      assertDigest('Expected private descriptor hash', input.expectedDescriptorHash, HEX_128);
    }
    assertDigest('Private descriptor hash', input.descriptorHash, HEX_128);
    assertDigest('Private publish digest', input.publishDigest, HEX_64);
    assertDigest('Private publish stage id', input.stageId, HEX_64);
    assertPositiveInteger('Private publish stage TTL', input.stageTtlMs, 24 * 60 * 60 * 1000);
    if (input.snapshots.length > MAX_PRIVATE_SNAPSHOTS) {
      throw new TypeError(`Private publish has more than ${MAX_PRIVATE_SNAPSHOTS} snapshots.`);
    }
    for (const snapshot of input.snapshots) {
      assertText('Private snapshot channel id', snapshot.channelId, 256);
      if (!snapshot.manifest?.infoHash
        || snapshot.record.infoHash !== snapshot.manifest.infoHash
        || !Number.isSafeInteger(snapshot.record.epoch)
        || snapshot.record.epoch < 0
        || computeMerkleRoot(snapshot.manifest.pieces) !== snapshot.manifest.merkleRoot) {
        throw new TypeError('Private publish snapshot metadata is invalid.');
      }
    }
  }

  private async run<T>(operation: string, callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      throw toCommunityPrivateStateUnavailableError(operation, error);
    }
  }
}
