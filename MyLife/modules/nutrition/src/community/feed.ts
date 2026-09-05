import type { DatabaseAdapter } from '@mylife/db';
import type { CommunityFeedItem, FeedItemWithProfile, ActivityType, ProfileVisibility } from './types';
import { ACTIVITY_SHARING_MAP } from './types';
import { getAcceptedProfileIds } from './connections';

// -- Feed write --------------------------------------------------------------

export function createFeedItem(
  db: DatabaseAdapter,
  input: {
    profileId: string;
    activityType: ActivityType;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
    visibility?: ProfileVisibility;
  },
): CommunityFeedItem {
  const id = crypto.randomUUID();

  db.execute(
    `INSERT INTO nu_community_feed (id, profile_id, activity_type, title, body, metadata_json, visibility, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      id,
      input.profileId,
      input.activityType,
      input.title,
      input.body ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.visibility ?? 'connections',
    ],
  );

  const rows = db.query('SELECT * FROM nu_community_feed WHERE id = ?', [id]);
  return mapFeedItem(rows[0]);
}

// -- Feed read (with privacy filtering) --------------------------------------

export function getFeed(
  db: DatabaseAdapter,
  profileId: string,
  limit = 50,
  offset = 0,
): FeedItemWithProfile[] {
  const connectedIds = getAcceptedProfileIds(db, profileId);
  if (connectedIds.length === 0) return [];

  const placeholders = connectedIds.map(() => '?').join(', ');

  const rows = db.query(
    `SELECT f.*, p.display_name, p.avatar_emoji,
            p.share_streaks, p.share_goals, p.share_calories, p.share_macros, p.share_weight
     FROM nu_community_feed f
     JOIN nu_community_profiles p ON f.profile_id = p.id
     WHERE f.profile_id IN (${placeholders})
       AND f.visibility IN ('connections', 'public')
     ORDER BY f.created_at DESC
     LIMIT ? OFFSET ?`,
    [...connectedIds, limit, offset],
  );

  return rows
    .filter((row) => {
      const activityType = row.activity_type as ActivityType;
      const sharingKey = ACTIVITY_SHARING_MAP[activityType];
      if (sharingKey === null) return true;
      // Map camelCase sharing key to snake_case column name
      const columnMap: Record<string, string> = {
        shareStreaks: 'share_streaks',
        shareGoals: 'share_goals',
        shareCalories: 'share_calories',
        shareMacros: 'share_macros',
        shareWeight: 'share_weight',
      };
      return (row[columnMap[sharingKey]] as number) === 1;
    })
    .map((row) => ({
      ...mapFeedItem(row),
      displayName: row.display_name as string,
      avatarEmoji: row.avatar_emoji as string,
    }));
}

export function getOwnFeed(
  db: DatabaseAdapter,
  profileId: string,
  limit = 50,
): FeedItemWithProfile[] {
  const rows = db.query(
    `SELECT f.*, p.display_name, p.avatar_emoji
     FROM nu_community_feed f
     JOIN nu_community_profiles p ON f.profile_id = p.id
     WHERE f.profile_id = ?
     ORDER BY f.created_at DESC
     LIMIT ?`,
    [profileId, limit],
  );

  return rows.map((row) => ({
    ...mapFeedItem(row),
    displayName: row.display_name as string,
    avatarEmoji: row.avatar_emoji as string,
  }));
}

// -- Cheer -------------------------------------------------------------------

export function cheerFeedItem(db: DatabaseAdapter, feedItemId: string): void {
  db.execute(
    "UPDATE nu_community_feed SET metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.cheered', 1) WHERE id = ?",
    [feedItemId],
  );
}

export function uncheerFeedItem(db: DatabaseAdapter, feedItemId: string): void {
  db.execute(
    "UPDATE nu_community_feed SET metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.cheered', 0) WHERE id = ?",
    [feedItemId],
  );
}

// -- Row mapper --------------------------------------------------------------

function mapFeedItem(row: Record<string, unknown>): CommunityFeedItem {
  const metadata = row.metadata_json ? JSON.parse(row.metadata_json as string) : null;
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    activityType: row.activity_type as ActivityType,
    title: row.title as string,
    body: row.body as string | null,
    metadataJson: row.metadata_json as string | null,
    visibility: row.visibility as ProfileVisibility,
    cheered: metadata?.cheered === 1,
    createdAt: row.created_at as string,
  };
}
