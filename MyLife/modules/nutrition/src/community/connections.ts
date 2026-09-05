import type { DatabaseAdapter } from '@mylife/db';
import type { CommunityConnection, ConnectionStatus, CommunityProfile } from './types';

// -- Connection CRUD ---------------------------------------------------------

export function sendConnectionRequest(
  db: DatabaseAdapter,
  fromProfileId: string,
  toProfileId: string,
): CommunityConnection {
  if (fromProfileId === toProfileId) {
    throw new Error("That's your own code!");
  }

  // Check target exists
  const targets = db.query('SELECT id FROM nu_community_profiles WHERE id = ?', [toProfileId]);
  if (targets.length === 0) {
    throw new Error('Profile not found');
  }

  // Check for existing connection in either direction
  const existing = db.query(
    `SELECT id, status FROM nu_community_connections
     WHERE (from_profile_id = ? AND to_profile_id = ?) OR (from_profile_id = ? AND to_profile_id = ?)`,
    [fromProfileId, toProfileId, toProfileId, fromProfileId],
  );

  if (existing.length > 0) {
    if (existing[0].status === 'blocked') {
      throw new Error('Unable to send request');
    }
    throw new Error('Request already pending');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO nu_community_connections (id, from_profile_id, to_profile_id, status, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    [id, fromProfileId, toProfileId, now, now],
  );

  const rows = db.query('SELECT * FROM nu_community_connections WHERE id = ?', [id]);
  return mapConnection(rows[0]);
}

export function acceptConnection(db: DatabaseAdapter, connectionId: string): CommunityConnection {
  db.execute(
    "UPDATE nu_community_connections SET status = 'accepted', updated_at = datetime('now') WHERE id = ?",
    [connectionId],
  );
  const rows = db.query('SELECT * FROM nu_community_connections WHERE id = ?', [connectionId]);
  return mapConnection(rows[0]);
}

export function declineConnection(db: DatabaseAdapter, connectionId: string): void {
  db.execute('DELETE FROM nu_community_connections WHERE id = ?', [connectionId]);
}

export function blockConnection(db: DatabaseAdapter, profileId: string, targetProfileId: string): void {
  const existing = db.query(
    `SELECT id FROM nu_community_connections
     WHERE (from_profile_id = ? AND to_profile_id = ?) OR (from_profile_id = ? AND to_profile_id = ?)`,
    [profileId, targetProfileId, targetProfileId, profileId],
  );

  if (existing.length > 0) {
    db.execute(
      "UPDATE nu_community_connections SET status = 'blocked', from_profile_id = ?, to_profile_id = ?, updated_at = datetime('now') WHERE id = ?",
      [profileId, targetProfileId, existing[0].id],
    );
  } else {
    db.execute(
      `INSERT INTO nu_community_connections (id, from_profile_id, to_profile_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'blocked', datetime('now'), datetime('now'))`,
      [crypto.randomUUID(), profileId, targetProfileId],
    );
  }
}

export function removeConnection(db: DatabaseAdapter, connectionId: string): void {
  db.execute('DELETE FROM nu_community_connections WHERE id = ?', [connectionId]);
}

// -- Queries -----------------------------------------------------------------

export function getAcceptedConnections(
  db: DatabaseAdapter,
  profileId: string,
  limit = 200,
): Array<CommunityConnection & { profile: Pick<CommunityProfile, 'id' | 'displayName' | 'avatarEmoji'> }> {
  const rows = db.query(
    `SELECT c.*, p.id as p_id, p.display_name as p_display_name, p.avatar_emoji as p_avatar_emoji
     FROM nu_community_connections c
     JOIN nu_community_profiles p ON (
       CASE WHEN c.from_profile_id = ? THEN c.to_profile_id ELSE c.from_profile_id END = p.id
     )
     WHERE (c.from_profile_id = ? OR c.to_profile_id = ?)
       AND c.status = 'accepted'
     ORDER BY c.updated_at DESC
     LIMIT ?`,
    [profileId, profileId, profileId, limit],
  );

  return rows.map((row) => ({
    ...mapConnection(row),
    profile: {
      id: row.p_id as string,
      displayName: row.p_display_name as string,
      avatarEmoji: row.p_avatar_emoji as string,
    },
  }));
}

export function getPendingRequests(
  db: DatabaseAdapter,
  profileId: string,
  limit = 100,
): Array<CommunityConnection & { profile: Pick<CommunityProfile, 'id' | 'displayName' | 'avatarEmoji'> }> {
  const rows = db.query(
    `SELECT c.*, p.id as p_id, p.display_name as p_display_name, p.avatar_emoji as p_avatar_emoji
     FROM nu_community_connections c
     JOIN nu_community_profiles p ON c.from_profile_id = p.id
     WHERE c.to_profile_id = ? AND c.status = 'pending'
     ORDER BY c.created_at DESC
     LIMIT ?`,
    [profileId, limit],
  );

  return rows.map((row) => ({
    ...mapConnection(row),
    profile: {
      id: row.p_id as string,
      displayName: row.p_display_name as string,
      avatarEmoji: row.p_avatar_emoji as string,
    },
  }));
}

export function getAcceptedProfileIds(db: DatabaseAdapter, profileId: string): string[] {
  const rows = db.query(
    `SELECT CASE WHEN from_profile_id = ? THEN to_profile_id ELSE from_profile_id END as connected_id
     FROM nu_community_connections
     WHERE (from_profile_id = ? OR to_profile_id = ?) AND status = 'accepted'`,
    [profileId, profileId, profileId],
  );
  return rows.map((r) => r.connected_id as string);
}

export function isBlocked(db: DatabaseAdapter, profileId: string, targetProfileId: string): boolean {
  const rows = db.query(
    `SELECT id FROM nu_community_connections
     WHERE from_profile_id = ? AND to_profile_id = ? AND status = 'blocked'`,
    [profileId, targetProfileId],
  );
  return rows.length > 0;
}

// -- Row mapper --------------------------------------------------------------

function mapConnection(row: Record<string, unknown>): CommunityConnection {
  return {
    id: row.id as string,
    fromProfileId: row.from_profile_id as string,
    toProfileId: row.to_profile_id as string,
    status: row.status as ConnectionStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
