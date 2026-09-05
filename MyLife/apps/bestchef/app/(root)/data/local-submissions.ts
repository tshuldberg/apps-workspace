import type { DatabaseAdapter } from '@mylife/db';
import type { DemoComment, DemoSubmission } from './demo';
import { getUgcLanguage } from './app-language';

const SUBMISSIONS_TABLE = 'rc_bestchef_submissions';
const COMMENTS_TABLE = 'rc_bestchef_comments';
const VOTES_TABLE = 'rc_bestchef_votes';
const REPORTS_TABLE = 'rc_bestchef_reports';
const BLOCKS_TABLE = 'rc_bestchef_blocks';
const LOCAL_SOCIAL_MIGRATION_KEY = 'bestchef_social_tables_migrated';
const MODERATION_TABLES_KEY = 'bestchef_moderation_tables_migrated';
const LEGACY_SUBMISSIONS_KEY = 'local_submissions';
const LEGACY_COMMENTS_KEY = 'local_comments';
const LEGACY_VOTES_KEY = 'local_votes';

type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

interface BestChefSyncDatabaseAdapter extends DatabaseAdapter {
  recordSyncChange?: (
    table: string,
    operation: SyncOperation,
    rowId: string,
    data: Record<string, unknown> | null,
  ) => void;
  syncDeviceId?: string;
  syncDisplayName?: string;
}

interface SubmissionRow {
  id: string;
  dish_id: string;
  dish_name: string;
  title: string;
  description: string;
  ingredients_json: string;
  instructions_json: string;
  photo_uri: string | null;
  videos_json: string;
  chef_id: string;
  chef_name: string;
  chef_handle: string;
  vote_score: number;
  rank: number | null;
  photo_verified: number;
  language: string | null;
  created_at: string;
  updated_at: string;
}

interface CommentRow {
  id: string;
  submission_id: string;
  author_id: string;
  author_name: string;
  author_handle: string;
  text: string;
  comment_type: DemoComment['type'];
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

interface VoteRow {
  id: string;
  submission_id: string;
  voter_id: string;
  tier: number;
  created_at: string;
  updated_at: string;
}

export interface LocalSubmission {
  id: string;
  dishId: string;
  dishName: string;
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  photoUri: string | null;
  videos: { uri: string; type: string }[];
  /** Authoring-time UGC language tag; null on pre-V31 rows. */
  language: string | null;
  createdAt: string;
}

export interface LocalComment {
  id: string;
  submissionId: string;
  text: string;
  createdAt: string;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toIsoDay(value: string): string {
  return value.includes('T') ? value.split('T')[0] ?? value : value;
}

function parseJsonArray<T>(value: string | null | undefined, fallback: T[] = []): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonObject<T extends Record<string, unknown>>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as T
      : null;
  } catch {
    return null;
  }
}

function getSetting(db: DatabaseAdapter, key: string): string | null {
  try {
    const rows = db.query<{ value: string }>(
      `SELECT value FROM rc_settings WHERE key = ?`,
      [key],
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  try {
    db.execute(
      `INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`,
      [key, value],
    );
  } catch {
    // Settings are a compatibility cache; table-backed social data still works without it.
  }
}

function getLegacySubmissions(db: DatabaseAdapter): LocalSubmission[] {
  return parseJsonArray<LocalSubmission>(getSetting(db, LEGACY_SUBMISSIONS_KEY));
}

function getLegacyComments(db: DatabaseAdapter): LocalComment[] {
  return parseJsonArray<LocalComment>(getSetting(db, LEGACY_COMMENTS_KEY));
}

function getLegacyVotes(db: DatabaseAdapter): Record<string, number> {
  return parseJsonObject<Record<string, number>>(getSetting(db, LEGACY_VOTES_KEY)) ?? {};
}

function hasSocialTables(db: DatabaseAdapter): boolean {
  try {
    db.query(`SELECT id FROM ${SUBMISSIONS_TABLE} LIMIT 1`);
    db.query(`SELECT id FROM ${COMMENTS_TABLE} LIMIT 1`);
    db.query(`SELECT id FROM ${VOTES_TABLE} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

function getLocalChef(db: DatabaseAdapter): {
  chefId: string;
  chefName: string;
  chefHandle: string;
} {
  const syncDb = db as BestChefSyncDatabaseAdapter;
  const deviceId = syncDb.syncDeviceId ?? 'local';
  const savedName = getSetting(db, 'profile_display_name');
  const savedHandle = getSetting(db, 'profile_handle');
  const suffix = deviceId === 'local' ? 'me' : deviceId.slice(0, 8).toLowerCase();

  return {
    chefId: deviceId,
    chefName: savedName?.trim() || 'You',
    chefHandle: savedHandle?.trim().replace(/^@/, '') || suffix,
  };
}

function recordSyncChange(
  db: DatabaseAdapter,
  table: string,
  operation: SyncOperation,
  rowId: string,
  data: Record<string, unknown> | null,
): void {
  try {
    (db as BestChefSyncDatabaseAdapter).recordSyncChange?.(table, operation, rowId, data);
  } catch {
    // Local writes must not fail if the sync engine is temporarily unavailable.
  }
}

function writeSubmissionRow(db: DatabaseAdapter, row: SubmissionRow, operation: SyncOperation): void {
  db.execute(
    `INSERT OR REPLACE INTO ${SUBMISSIONS_TABLE} (
      id, dish_id, dish_name, title, description, ingredients_json,
      instructions_json, photo_uri, videos_json, chef_id, chef_name,
      chef_handle, vote_score, rank, photo_verified, language, created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.dish_id,
      row.dish_name,
      row.title,
      row.description,
      row.ingredients_json,
      row.instructions_json,
      row.photo_uri,
      row.videos_json,
      row.chef_id,
      row.chef_name,
      row.chef_handle,
      row.vote_score,
      row.rank,
      row.photo_verified,
      row.language,
      row.created_at,
      row.updated_at,
    ],
  );
  recordSyncChange(db, SUBMISSIONS_TABLE, operation, row.id, rowToRecord(row));
}

function writeCommentRow(db: DatabaseAdapter, row: CommentRow, operation: SyncOperation): void {
  db.execute(
    `INSERT OR REPLACE INTO ${COMMENTS_TABLE} (
      id, submission_id, author_id, author_name, author_handle, text,
      comment_type, helpful_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.submission_id,
      row.author_id,
      row.author_name,
      row.author_handle,
      row.text,
      row.comment_type,
      row.helpful_count,
      row.created_at,
      row.updated_at,
    ],
  );
  recordSyncChange(db, COMMENTS_TABLE, operation, row.id, rowToRecord(row));
}

function writeVoteRow(db: DatabaseAdapter, row: VoteRow, operation: SyncOperation): void {
  db.execute(
    `INSERT INTO ${VOTES_TABLE} (
      id, submission_id, voter_id, tier, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(submission_id, voter_id) DO UPDATE SET
      tier = excluded.tier,
      updated_at = excluded.updated_at`,
    [
      row.id,
      row.submission_id,
      row.voter_id,
      row.tier,
      row.created_at,
      row.updated_at,
    ],
  );
  recordSyncChange(db, VOTES_TABLE, operation, row.id, rowToRecord(row));
}

function rowToRecord<T extends object>(row: T): Record<string, unknown> {
  return { ...row } as Record<string, unknown>;
}

function ensureLegacyRowsMigrated(db: DatabaseAdapter): void {
  if (getSetting(db, LOCAL_SOCIAL_MIGRATION_KEY) === '1') return;
  if (!hasSocialTables(db)) return;

  const now = new Date().toISOString();
  const chef = getLocalChef(db);

  try {
    db.transaction(() => {
      for (const submission of getLegacySubmissions(db)) {
        const createdAt = submission.createdAt || now;
        writeSubmissionRow(
          db,
          {
            id: submission.id,
            dish_id: submission.dishId,
            dish_name: submission.dishName,
            title: submission.title,
            description: submission.description,
            ingredients_json: JSON.stringify(submission.ingredients),
            instructions_json: JSON.stringify(submission.instructions),
            photo_uri: submission.photoUri,
            videos_json: JSON.stringify(submission.videos),
            chef_id: chef.chefId,
            chef_name: chef.chefName,
            chef_handle: chef.chefHandle,
            language: submission.language ?? null,
            vote_score: 0,
            rank: null,
            photo_verified: 0,
            created_at: createdAt,
            updated_at: now,
          },
          'INSERT',
        );
      }

      for (const comment of getLegacyComments(db)) {
        const createdAt = comment.createdAt || now;
        writeCommentRow(
          db,
          {
            id: comment.id,
            submission_id: comment.submissionId,
            author_id: chef.chefId,
            author_name: chef.chefName,
            author_handle: chef.chefHandle,
            text: comment.text,
            comment_type: 'comment',
            helpful_count: 0,
            created_at: createdAt,
            updated_at: now,
          },
          'INSERT',
        );
      }

      const votes = getLegacyVotes(db);
      for (const [submissionId, tier] of Object.entries(votes)) {
        if (!Number.isFinite(tier)) continue;
        writeVoteRow(
          db,
          {
            id: `${submissionId}:${chef.chefId}`,
            submission_id: submissionId,
            voter_id: chef.chefId,
            tier,
            created_at: now,
            updated_at: now,
          },
          'INSERT',
        );
      }

      setSetting(db, LOCAL_SOCIAL_MIGRATION_KEY, '1');
    });
  } catch {
    // Leave the compatibility JSON in place; reads will still fall back below.
  }
}

function getSubmissionRows(db: DatabaseAdapter, sql: string, params: unknown[] = []): SubmissionRow[] {
  ensureLegacyRowsMigrated(db);
  try {
    return db.query<SubmissionRow>(sql, params);
  } catch {
    return [];
  }
}

function mapSubmissionRow(row: SubmissionRow, index: number): DemoSubmission {
  return {
    id: row.id,
    dishId: row.dish_id,
    chefId: row.chef_id,
    chefName: row.chef_name,
    chefHandle: row.chef_handle,
    title: row.title,
    description: row.description,
    photoUrl: row.photo_uri ?? undefined,
    voteScore: row.vote_score,
    rank: row.rank ?? index + 1,
    photoVerified: row.photo_verified === 1,
    createdAt: toIsoDay(row.created_at),
    tags: [],
    ingredients: parseJsonArray<string>(row.ingredients_json),
    steps: parseJsonArray<string>(row.instructions_json),
  };
}

function mapLegacySubmission(submission: LocalSubmission, index: number): DemoSubmission {
  return {
    id: submission.id,
    dishId: submission.dishId,
    chefId: 'local',
    chefName: 'You',
    chefHandle: 'me',
    title: submission.title,
    description: submission.description,
    photoUrl: submission.photoUri ?? undefined,
    voteScore: 0,
    rank: index + 1,
    photoVerified: false,
    createdAt: toIsoDay(submission.createdAt),
    tags: [],
    ingredients: submission.ingredients,
    steps: submission.instructions,
  };
}

export function addLocalSubmission(
  db: DatabaseAdapter,
  sub: Omit<LocalSubmission, 'id' | 'createdAt' | 'language'> & { language?: string | null },
): LocalSubmission {
  ensureLegacyRowsMigrated(db);

  const now = new Date().toISOString();
  const chef = getLocalChef(db);
  const entry: LocalSubmission = {
    ...sub,
    // Stamp the authoring-time UGC language; the cloud alias bridge
    // prefers this over the app language at alias time (plan 33 Phase 3.3).
    language: sub.language ?? getUgcLanguage(),
    id: createId('local'),
    createdAt: now,
  };

  try {
    writeSubmissionRow(
      db,
      {
        id: entry.id,
        dish_id: entry.dishId,
        dish_name: entry.dishName,
        title: entry.title,
        description: entry.description,
        ingredients_json: JSON.stringify(entry.ingredients),
        instructions_json: JSON.stringify(entry.instructions),
        photo_uri: entry.photoUri,
        videos_json: JSON.stringify(entry.videos),
        chef_id: chef.chefId,
        chef_name: chef.chefName,
        chef_handle: chef.chefHandle,
        vote_score: 0,
        rank: null,
        photo_verified: 0,
        language: entry.language,
        created_at: entry.createdAt,
        updated_at: now,
      },
      'INSERT',
    );
  } catch {
    const store = getLegacySubmissions(db);
    store.push(entry);
    setSetting(db, LEGACY_SUBMISSIONS_KEY, JSON.stringify(store));
  }

  return entry;
}

export function getLocalSubmissionsForDish(db: DatabaseAdapter, dishId: string): DemoSubmission[] {
  const rows = getSubmissionRows(
    db,
    `SELECT * FROM ${SUBMISSIONS_TABLE}
     WHERE dish_id = ?
     ORDER BY vote_score DESC, created_at DESC`,
    [dishId],
  );
  if (rows.length > 0) return rows.map(mapSubmissionRow);

  return getLegacySubmissions(db)
    .filter((submission) => submission.dishId === dishId)
    .map(mapLegacySubmission);
}

export function getLocalSubmission(db: DatabaseAdapter, submissionId: string): LocalSubmission | null {
  const rows = getSubmissionRows(
    db,
    `SELECT * FROM ${SUBMISSIONS_TABLE} WHERE id = ? LIMIT 1`,
    [submissionId],
  );

  const row = rows[0];
  if (row) {
    return {
      id: row.id,
      dishId: row.dish_id,
      dishName: row.dish_name,
      title: row.title,
      description: row.description,
      ingredients: parseJsonArray<string>(row.ingredients_json),
      instructions: parseJsonArray<string>(row.instructions_json),
      photoUri: row.photo_uri,
      videos: parseJsonArray<{ uri: string; type: string }>(row.videos_json),
      language: row.language ?? null,
      createdAt: row.created_at,
    };
  }

  return getLegacySubmissions(db).find((submission) => submission.id === submissionId) ?? null;
}

export function saveVote(db: DatabaseAdapter, submissionId: string, tier: number): void {
  ensureLegacyRowsMigrated(db);
  const now = new Date().toISOString();
  const chef = getLocalChef(db);
  const previous = getVote(db, submissionId);
  const operation: SyncOperation = previous === null ? 'INSERT' : 'UPDATE';

  try {
    writeVoteRow(
      db,
      {
        id: `${submissionId}:${chef.chefId}`,
        submission_id: submissionId,
        voter_id: chef.chefId,
        tier,
        created_at: now,
        updated_at: now,
      },
      operation,
    );

    const delta = tier - (previous ?? 0);
    db.execute(
      `UPDATE ${SUBMISSIONS_TABLE}
       SET vote_score = vote_score + ?, updated_at = ?
       WHERE id = ?`,
      [delta, now, submissionId],
    );
    const rows = db.query<SubmissionRow>(
      `SELECT * FROM ${SUBMISSIONS_TABLE} WHERE id = ? LIMIT 1`,
      [submissionId],
    );
    if (rows[0]) {
      recordSyncChange(db, SUBMISSIONS_TABLE, 'UPDATE', submissionId, rowToRecord(rows[0]));
    }
  } catch {
    const votes = getLegacyVotes(db);
    votes[submissionId] = tier;
    setSetting(db, LEGACY_VOTES_KEY, JSON.stringify(votes));
  }
}

export function getVote(db: DatabaseAdapter, submissionId: string): number | null {
  ensureLegacyRowsMigrated(db);
  const chef = getLocalChef(db);

  try {
    const rows = db.query<{ tier: number }>(
      `SELECT tier FROM ${VOTES_TABLE} WHERE submission_id = ? AND voter_id = ? LIMIT 1`,
      [submissionId, chef.chefId],
    );
    return rows[0]?.tier ?? null;
  } catch {
    const votes = getLegacyVotes(db);
    return votes[submissionId] ?? null;
  }
}

export function addLocalComment(db: DatabaseAdapter, submissionId: string, text: string): LocalComment {
  ensureLegacyRowsMigrated(db);
  const now = new Date().toISOString();
  const chef = getLocalChef(db);
  const comment: LocalComment = {
    id: createId('comment'),
    submissionId,
    text: text.trim(),
    createdAt: now,
  };

  try {
    writeCommentRow(
      db,
      {
        id: comment.id,
        submission_id: comment.submissionId,
        author_id: chef.chefId,
        author_name: chef.chefName,
        author_handle: chef.chefHandle,
        text: comment.text,
        comment_type: 'comment',
        helpful_count: 0,
        created_at: comment.createdAt,
        updated_at: now,
      },
      'INSERT',
    );
  } catch {
    const comments = getLegacyComments(db);
    comments.push(comment);
    setSetting(db, LEGACY_COMMENTS_KEY, JSON.stringify(comments));
  }

  return comment;
}

export function getLocalComments(db: DatabaseAdapter, submissionId: string): DemoComment[] {
  ensureLegacyRowsMigrated(db);

  try {
    const rows = db.query<CommentRow>(
      `SELECT * FROM ${COMMENTS_TABLE}
       WHERE submission_id = ?
       ORDER BY created_at DESC`,
      [submissionId],
    );
    return rows.map((row) => ({
      id: row.id,
      submissionId: row.submission_id,
      authorName: row.author_name,
      authorHandle: row.author_handle,
      text: row.text,
      type: row.comment_type,
      helpfulCount: row.helpful_count,
      createdAt: toIsoDay(row.created_at),
    }));
  } catch {
    return getLegacyComments(db)
      .filter((comment) => comment.submissionId === submissionId)
      .map((comment) => ({
        id: comment.id,
        submissionId: comment.submissionId,
        authorName: 'You',
        authorHandle: 'me',
        text: comment.text,
        type: 'comment',
        helpfulCount: 0,
        createdAt: toIsoDay(comment.createdAt),
      }));
  }
}

export function getAllLocalSubmissions(db: DatabaseAdapter): DemoSubmission[] {
  const rows = getSubmissionRows(
    db,
    `SELECT * FROM ${SUBMISSIONS_TABLE}
     ORDER BY created_at DESC`,
  );
  if (rows.length > 0) return rows.map(mapSubmissionRow);

  return getLegacySubmissions(db).map(mapLegacySubmission);
}

export interface LocalChefStats {
  submissions: number;
  votesCast: number;
  voteScoreReceived: number;
  wins: number;
}

export function getLocalChefStats(db: DatabaseAdapter): LocalChefStats {
  const submissions = getAllLocalSubmissions(db);
  const submissionCount = submissions.length;
  const voteScoreReceived = submissions.reduce(
    (sum, submission) => sum + (submission.voteScore ?? 0),
    0,
  );
  const wins = submissions.filter((submission) => submission.rank === 1).length;

  let votesCast = 0;
  try {
    ensureLegacyRowsMigrated(db);
    const chef = getLocalChef(db);
    const rows = db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${VOTES_TABLE} WHERE voter_id = ?`,
      [chef.chefId],
    );
    votesCast = rows[0]?.count ?? 0;
  } catch {
    const legacyVotes = getLegacyVotes(db);
    votesCast = Object.keys(legacyVotes).length;
  }

  return {
    submissions: submissionCount,
    votesCast,
    voteScoreReceived,
    wins,
  };
}

// ---------------------------------------------------------------------------
// Moderation: reports + user blocks (App Store UGC compliance)
// ---------------------------------------------------------------------------

export type ReportTargetKind = 'submission' | 'comment' | 'chef' | 'vote_proof';

export interface ReportContentInput {
  targetKind: ReportTargetKind;
  targetId: string;
  reason: string;
  reporterId: string;
}

export interface BlockedUserRow {
  id: string;
  blockerId: string;
  blockedHandle: string;
  createdAt: string;
}

interface ReportRow {
  id: string;
  target_kind: string;
  target_id: string;
  reporter_id: string;
  reason: string;
  created_at: number;
  status: string;
}

interface BlockRow {
  id: string;
  blocker_id: string;
  blocked_handle: string;
  created_at: number;
}

function ensureModerationTables(db: DatabaseAdapter): boolean {
  try {
    db.execute(
      `CREATE TABLE IF NOT EXISTS ${REPORTS_TABLE} (
        id TEXT PRIMARY KEY,
        target_kind TEXT NOT NULL,
        target_id TEXT NOT NULL,
        reporter_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      )`,
    );
    db.execute(
      `CREATE TABLE IF NOT EXISTS ${BLOCKS_TABLE} (
        id TEXT PRIMARY KEY,
        blocker_id TEXT NOT NULL,
        blocked_handle TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(blocker_id, blocked_handle)
      )`,
    );
    setSetting(db, MODERATION_TABLES_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, '').toLowerCase();
}

export function reportContent(
  db: DatabaseAdapter,
  input: ReportContentInput,
): { id: string; createdAt: number } {
  ensureModerationTables(db);
  const now = Date.now();
  const id = createId('report');
  const row: ReportRow = {
    id,
    target_kind: input.targetKind,
    target_id: input.targetId,
    reporter_id: input.reporterId,
    reason: input.reason,
    created_at: now,
    status: 'pending',
  };
  try {
    db.execute(
      `INSERT INTO ${REPORTS_TABLE} (
        id, target_kind, target_id, reporter_id, reason, created_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.target_kind,
        row.target_id,
        row.reporter_id,
        row.reason,
        row.created_at,
        row.status,
      ],
    );
    recordSyncChange(db, REPORTS_TABLE, 'INSERT', row.id, rowToRecord(row));
  } catch {
    // Swallow errors — moderation is best-effort local persistence.
  }
  return { id, createdAt: now };
}

export function blockUser(
  db: DatabaseAdapter,
  params: { blockerId: string; blockedHandle: string },
): BlockedUserRow | null {
  ensureModerationTables(db);
  const handle = normalizeHandle(params.blockedHandle);
  if (!handle) return null;
  const now = Date.now();
  const id = createId('block');
  const row: BlockRow = {
    id,
    blocker_id: params.blockerId,
    blocked_handle: handle,
    created_at: now,
  };
  try {
    db.execute(
      `INSERT OR IGNORE INTO ${BLOCKS_TABLE} (
        id, blocker_id, blocked_handle, created_at
      ) VALUES (?, ?, ?, ?)`,
      [row.id, row.blocker_id, row.blocked_handle, row.created_at],
    );
    recordSyncChange(db, BLOCKS_TABLE, 'INSERT', row.id, rowToRecord(row));
  } catch {
    return null;
  }
  return {
    id,
    blockerId: params.blockerId,
    blockedHandle: handle,
    createdAt: new Date(now).toISOString(),
  };
}

export function unblockUser(
  db: DatabaseAdapter,
  params: { blockerId: string; blockedHandle: string },
): void {
  ensureModerationTables(db);
  const handle = normalizeHandle(params.blockedHandle);
  if (!handle) return;
  try {
    const rows = db.query<{ id: string }>(
      `SELECT id FROM ${BLOCKS_TABLE} WHERE blocker_id = ? AND blocked_handle = ?`,
      [params.blockerId, handle],
    );
    db.execute(
      `DELETE FROM ${BLOCKS_TABLE} WHERE blocker_id = ? AND blocked_handle = ?`,
      [params.blockerId, handle],
    );
    for (const deleted of rows) {
      recordSyncChange(db, BLOCKS_TABLE, 'DELETE', deleted.id, null);
    }
  } catch {
    // Best-effort.
  }
}

export function isBlocked(
  db: DatabaseAdapter,
  blockerId: string,
  handle: string,
): boolean {
  ensureModerationTables(db);
  const normalized = normalizeHandle(handle);
  if (!normalized) return false;
  try {
    const rows = db.query<{ id: string }>(
      `SELECT id FROM ${BLOCKS_TABLE}
       WHERE blocker_id = ? AND blocked_handle = ? LIMIT 1`,
      [blockerId, normalized],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

export function listBlocked(db: DatabaseAdapter, blockerId: string): BlockedUserRow[] {
  ensureModerationTables(db);
  try {
    const rows = db.query<BlockRow>(
      `SELECT * FROM ${BLOCKS_TABLE}
       WHERE blocker_id = ?
       ORDER BY created_at DESC`,
      [blockerId],
    );
    return rows.map((row) => ({
      id: row.id,
      blockerId: row.blocker_id,
      blockedHandle: row.blocked_handle,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}

export function isContentFromBlockedUser(
  db: DatabaseAdapter,
  viewerId: string,
  authorHandle: string,
): boolean {
  return isBlocked(db, viewerId, authorHandle);
}
