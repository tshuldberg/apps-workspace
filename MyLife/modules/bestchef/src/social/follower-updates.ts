import type { DatabaseAdapter } from '@mylife/db';

export interface ChefSeedSubmissionInput {
  id: string;
  dishId: string;
  dishName?: string | null;
  title: string;
  description?: string | null;
  ingredients?: string[];
  tags?: string[];
  voteScore?: number;
  rank?: number | null;
  createdAt?: string;
}

export interface ChefSeedSubmission {
  id: string;
  dishId: string;
  dishName: string | null;
  title: string;
  description: string | null;
  ingredients: string[];
  tags: string[];
  voteScore: number;
  rank: number | null;
  createdAt: string;
}

export interface ChefLocalMapSnapshot {
  submissionIds: string[];
  dishIds: string[];
  dishNames: string[];
  ingredientNames: string[];
  tagIds: string[];
  updatedAt: string;
}

export interface ChefProfileSnapshotInput {
  chefId: string;
  displayName: string;
  handle: string;
  location?: string | null;
  topCuisine?: string | null;
  followerCount?: number;
  submissions?: ChefSeedSubmissionInput[];
}

export interface ChefFollowSnapshot {
  schemaVersion: 1;
  source: string;
  chef: {
    id: string;
    displayName: string;
    handle: string;
    location: string | null;
    topCuisine: string | null;
    followerCount: number;
  };
  submissions: ChefSeedSubmission[];
  localMap: ChefLocalMapSnapshot;
  capturedAt: string;
}

export interface FollowChefInput extends ChefProfileSnapshotInput {
  source?: string;
  lastSeedAt?: string | null;
  seedRevision?: number;
}

export interface FollowedChef {
  chefId: string;
  displayName: string;
  handle: string;
  location: string | null;
  topCuisine: string | null;
  followerCount: number;
  followedAt: string;
  updatedAt: string;
  lastSeedAt: string | null;
  seedRevision: number;
  cachedPayloadJson: string;
  cachedPayload: ChefFollowSnapshot | null;
}

export interface PublishFollowerUpdateInput extends ChefProfileSnapshotInput {
  bio?: string | null;
  topCuisines?: string[];
  followingCount?: number;
  totalVotes?: number;
  wins?: number;
}

export interface FollowerUpdateSeedPayload {
  schemaVersion: 1;
  chef: {
    id: string;
    displayName: string;
    handle: string;
    bio: string | null;
    location: string | null;
    topCuisines: string[];
  };
  stats: {
    followerCount: number;
    followingCount: number;
    submissionCount: number;
    totalVotes: number;
    wins: number;
  };
  submissions: ChefSeedSubmission[];
  localMap: ChefLocalMapSnapshot;
  revision: number;
  publishedAt: string;
}

export type FollowerUpdateSeedStatus = 'available' | 'superseded';

export interface FollowerUpdateSeed {
  id: string;
  chefId: string;
  displayName: string;
  handle: string;
  revision: number;
  followerCount: number;
  payloadJson: string;
  payload: FollowerUpdateSeedPayload | null;
  status: FollowerUpdateSeedStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

interface FollowedChefRow {
  chef_id: string;
  display_name: string;
  handle: string;
  location: string | null;
  top_cuisine: string | null;
  follower_count: number;
  followed_at: string;
  updated_at: string;
  last_seed_at: string | null;
  seed_revision: number;
  cached_payload_json: string;
}

interface FollowerUpdateSeedRow {
  id: string;
  chef_id: string;
  display_name: string;
  handle: string;
  revision: number;
  follower_count: number;
  payload_json: string;
  status: FollowerUpdateSeedStatus;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

function toIso(now?: Date | string): string {
  if (typeof now === 'string') return now;
  return (now ?? new Date()).toISOString();
}

function normalizeRequiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeHandle(handle: string): string {
  return normalizeRequiredText(handle.replace(/^@+/, ''), 'handle');
}

function nonNegativeInt(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (!seen.has(key)) seen.set(key, normalized);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function normalizeSubmission(input: ChefSeedSubmissionInput, capturedAt: string): ChefSeedSubmission {
  return {
    id: normalizeRequiredText(input.id, 'submission id'),
    dishId: normalizeRequiredText(input.dishId, 'dish id'),
    dishName: nullableText(input.dishName),
    title: normalizeRequiredText(input.title, 'submission title'),
    description: nullableText(input.description),
    ingredients: uniqueSorted(input.ingredients ?? []),
    tags: uniqueSorted(input.tags ?? []),
    voteScore: nonNegativeInt(input.voteScore),
    rank: input.rank === undefined ? null : input.rank,
    createdAt: input.createdAt ?? capturedAt,
  };
}

function normalizeSubmissions(
  input: ChefSeedSubmissionInput[] | undefined,
  capturedAt: string,
): ChefSeedSubmission[] {
  return (input ?? []).map((submission) => normalizeSubmission(submission, capturedAt));
}

export function buildChefLocalMap(
  submissions: ChefSeedSubmission[],
  updatedAt: string,
): ChefLocalMapSnapshot {
  return {
    submissionIds: uniqueSorted(submissions.map((submission) => submission.id)),
    dishIds: uniqueSorted(submissions.map((submission) => submission.dishId)),
    dishNames: uniqueSorted(submissions.map((submission) => submission.dishName)),
    ingredientNames: uniqueSorted(submissions.flatMap((submission) => submission.ingredients)),
    tagIds: uniqueSorted(submissions.flatMap((submission) => submission.tags)),
    updatedAt,
  };
}

export function buildChefFollowSnapshot(
  input: ChefProfileSnapshotInput & { source?: string },
  capturedAt: string,
): ChefFollowSnapshot {
  const submissions = normalizeSubmissions(input.submissions, capturedAt);
  return {
    schemaVersion: 1,
    source: input.source ?? 'bestchef_local',
    chef: {
      id: normalizeRequiredText(input.chefId, 'chef id'),
      displayName: normalizeRequiredText(input.displayName, 'display name'),
      handle: normalizeHandle(input.handle),
      location: nullableText(input.location),
      topCuisine: nullableText(input.topCuisine),
      followerCount: nonNegativeInt(input.followerCount),
    },
    submissions,
    localMap: buildChefLocalMap(submissions, capturedAt),
    capturedAt,
  };
}

export function buildFollowerUpdateSeedPayload(
  input: PublishFollowerUpdateInput,
  revision: number,
  publishedAt: string,
): FollowerUpdateSeedPayload {
  const submissions = normalizeSubmissions(input.submissions, publishedAt);
  const topCuisines = uniqueSorted([
    ...(input.topCuisines ?? []),
    input.topCuisine,
  ]);

  return {
    schemaVersion: 1,
    chef: {
      id: normalizeRequiredText(input.chefId, 'chef id'),
      displayName: normalizeRequiredText(input.displayName, 'display name'),
      handle: normalizeHandle(input.handle),
      bio: nullableText(input.bio),
      location: nullableText(input.location),
      topCuisines,
    },
    stats: {
      followerCount: nonNegativeInt(input.followerCount),
      followingCount: nonNegativeInt(input.followingCount),
      submissionCount: submissions.length,
      totalVotes: nonNegativeInt(input.totalVotes),
      wins: nonNegativeInt(input.wins),
    },
    submissions,
    localMap: buildChefLocalMap(submissions, publishedAt),
    revision,
    publishedAt,
  };
}

function parseJson<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function mapFollowedChef(row: FollowedChefRow): FollowedChef {
  return {
    chefId: row.chef_id,
    displayName: row.display_name,
    handle: row.handle,
    location: row.location,
    topCuisine: row.top_cuisine,
    followerCount: row.follower_count,
    followedAt: row.followed_at,
    updatedAt: row.updated_at,
    lastSeedAt: row.last_seed_at,
    seedRevision: row.seed_revision,
    cachedPayloadJson: row.cached_payload_json,
    cachedPayload: parseJson<ChefFollowSnapshot>(row.cached_payload_json),
  };
}

function mapFollowerUpdateSeed(row: FollowerUpdateSeedRow): FollowerUpdateSeed {
  return {
    id: row.id,
    chefId: row.chef_id,
    displayName: row.display_name,
    handle: row.handle,
    revision: row.revision,
    followerCount: row.follower_count,
    payloadJson: row.payload_json,
    payload: parseJson<FollowerUpdateSeedPayload>(row.payload_json),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

export function getFollowedChef(db: DatabaseAdapter, chefId: string): FollowedChef | null {
  const rows = db.query<FollowedChefRow>(
    `SELECT * FROM rc_chef_follows WHERE chef_id = ?`,
    [chefId],
  );
  return rows[0] ? mapFollowedChef(rows[0]) : null;
}

export function listFollowedChefs(db: DatabaseAdapter): FollowedChef[] {
  return db
    .query<FollowedChefRow>(
      `SELECT * FROM rc_chef_follows ORDER BY updated_at DESC, followed_at DESC`,
    )
    .map(mapFollowedChef);
}

export function isFollowingChef(db: DatabaseAdapter, chefId: string): boolean {
  return getFollowedChef(db, chefId) !== null;
}

export function countFollowedChefs(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM rc_chef_follows`,
  );
  return rows[0]?.count ?? 0;
}

export function followChef(
  db: DatabaseAdapter,
  input: FollowChefInput,
  now?: Date | string,
): FollowedChef {
  const capturedAt = toIso(now);
  const existing = getFollowedChef(db, input.chefId);
  const snapshot = buildChefFollowSnapshot(input, capturedAt);
  const seedRevision = input.seedRevision ?? existing?.seedRevision ?? 0;

  db.execute(
    `INSERT OR REPLACE INTO rc_chef_follows (
      chef_id, display_name, handle, location, top_cuisine, follower_count,
      followed_at, updated_at, last_seed_at, seed_revision, cached_payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshot.chef.id,
      snapshot.chef.displayName,
      snapshot.chef.handle,
      snapshot.chef.location,
      snapshot.chef.topCuisine,
      snapshot.chef.followerCount,
      existing?.followedAt ?? capturedAt,
      capturedAt,
      input.lastSeedAt ?? existing?.lastSeedAt ?? null,
      seedRevision,
      JSON.stringify(snapshot),
    ],
  );

  return getFollowedChef(db, snapshot.chef.id)!;
}

export function unfollowChef(db: DatabaseAdapter, chefId: string): void {
  db.execute(`DELETE FROM rc_chef_follows WHERE chef_id = ?`, [chefId]);
}

function nextFollowerSeedRevision(db: DatabaseAdapter, chefId: string): number {
  const rows = db.query<{ revision: number | null }>(
    `SELECT MAX(revision) as revision FROM rc_follower_update_seeds WHERE chef_id = ?`,
    [chefId],
  );
  return (rows[0]?.revision ?? 0) + 1;
}

function makeFollowerSeedId(chefId: string, revision: number): string {
  const safeChefId = chefId.replace(/[^A-Za-z0-9_-]/g, '_');
  return `follower-seed-${safeChefId}-${revision}`;
}

export function publishFollowerUpdateSeed(
  db: DatabaseAdapter,
  input: PublishFollowerUpdateInput,
  now?: Date | string,
): FollowerUpdateSeed {
  const publishedAt = toIso(now);
  const chefId = normalizeRequiredText(input.chefId, 'chef id');
  const revision = nextFollowerSeedRevision(db, chefId);
  const payload = buildFollowerUpdateSeedPayload(input, revision, publishedAt);
  const id = makeFollowerSeedId(payload.chef.id, revision);

  db.transaction(() => {
    db.execute(
      `UPDATE rc_follower_update_seeds
       SET status = 'superseded', updated_at = ?
       WHERE chef_id = ? AND status = 'available'`,
      [publishedAt, payload.chef.id],
    );
    db.execute(
      `INSERT INTO rc_follower_update_seeds (
        id, chef_id, display_name, handle, revision, follower_count,
        payload_json, status, created_at, updated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?)`,
      [
        id,
        payload.chef.id,
        payload.chef.displayName,
        payload.chef.handle,
        revision,
        payload.stats.followerCount,
        JSON.stringify(payload),
        publishedAt,
        publishedAt,
        null,
      ],
    );
  });

  return getFollowerUpdateSeed(db, id)!;
}

function getSeedPayload(seed: FollowerUpdateSeed | FollowerUpdateSeedPayload): FollowerUpdateSeedPayload {
  if ('payload' in seed) {
    if (!seed.payload) throw new Error('Follower update seed payload is invalid.');
    return seed.payload;
  }
  return seed;
}

export function applyFollowerUpdateSeed(
  db: DatabaseAdapter,
  seed: FollowerUpdateSeed | FollowerUpdateSeedPayload,
  now?: Date | string,
): FollowedChef {
  const payload = getSeedPayload(seed);
  const appliedAt = toIso(now);
  const existing = getFollowedChef(db, payload.chef.id);
  const snapshot = buildChefFollowSnapshot(
    {
      chefId: payload.chef.id,
      displayName: payload.chef.displayName,
      handle: payload.chef.handle,
      location: payload.chef.location,
      topCuisine: payload.chef.topCuisines[0] ?? null,
      followerCount: payload.stats.followerCount,
      submissions: payload.submissions,
      source: 'bestchef_follower_update_seed',
    },
    payload.publishedAt,
  );

  db.execute(
    `INSERT OR REPLACE INTO rc_chef_follows (
      chef_id, display_name, handle, location, top_cuisine, follower_count,
      followed_at, updated_at, last_seed_at, seed_revision, cached_payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshot.chef.id,
      snapshot.chef.displayName,
      snapshot.chef.handle,
      snapshot.chef.location,
      snapshot.chef.topCuisine,
      snapshot.chef.followerCount,
      existing?.followedAt ?? appliedAt,
      appliedAt,
      payload.publishedAt,
      payload.revision,
      JSON.stringify(snapshot),
    ],
  );

  return getFollowedChef(db, payload.chef.id)!;
}

export function getFollowerUpdateSeed(
  db: DatabaseAdapter,
  id: string,
): FollowerUpdateSeed | null {
  const rows = db.query<FollowerUpdateSeedRow>(
    `SELECT * FROM rc_follower_update_seeds WHERE id = ?`,
    [id],
  );
  return rows[0] ? mapFollowerUpdateSeed(rows[0]) : null;
}

export function getLatestFollowerUpdateSeed(
  db: DatabaseAdapter,
  chefId: string,
): FollowerUpdateSeed | null {
  const rows = db.query<FollowerUpdateSeedRow>(
    `SELECT * FROM rc_follower_update_seeds
     WHERE chef_id = ?
     ORDER BY revision DESC
     LIMIT 1`,
    [chefId],
  );
  return rows[0] ? mapFollowerUpdateSeed(rows[0]) : null;
}

export function listFollowerUpdateSeeds(
  db: DatabaseAdapter,
  chefId?: string,
): FollowerUpdateSeed[] {
  const rows = chefId
    ? db.query<FollowerUpdateSeedRow>(
      `SELECT * FROM rc_follower_update_seeds
       WHERE chef_id = ?
       ORDER BY revision DESC`,
      [chefId],
    )
    : db.query<FollowerUpdateSeedRow>(
      `SELECT * FROM rc_follower_update_seeds
       ORDER BY updated_at DESC, revision DESC`,
    );

  return rows.map(mapFollowerUpdateSeed);
}
