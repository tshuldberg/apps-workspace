import type { DatabaseAdapter } from '@mylife/db';
import type {
  CommunityChallenge,
  ChallengeMember,
  LeaderboardEntry,
  ChallengeType,
  ChallengeJoinType,
  ChallengeStatus,
  ChallengeMemberRole,
} from './types';
import { createFeedItem } from './feed';

// -- Challenge CRUD ----------------------------------------------------------

export function createChallenge(
  db: DatabaseAdapter,
  creatorProfileId: string,
  input: {
    title: string;
    description?: string;
    challengeType: ChallengeType;
    targetValue?: number;
    targetUnit?: string;
    startDate: string;
    endDate: string;
    maxParticipants?: number;
    joinType?: ChallengeJoinType;
  },
): CommunityChallenge {
  const today = new Date().toISOString().slice(0, 10);
  if (input.endDate < today) {
    throw new Error('End date cannot be in the past');
  }
  if (input.startDate > input.endDate) {
    throw new Error('Start date cannot be after end date');
  }

  const id = crypto.randomUUID();
  const status: ChallengeStatus = input.startDate <= today ? 'active' : 'upcoming';

  db.transaction(() => {
    db.execute(
      `INSERT INTO nu_community_challenges (id, creator_profile_id, title, description, challenge_type, target_value, target_unit, start_date, end_date, max_participants, join_type, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        creatorProfileId,
        input.title,
        input.description ?? null,
        input.challengeType,
        input.targetValue ?? null,
        input.targetUnit ?? null,
        input.startDate,
        input.endDate,
        input.maxParticipants ?? 50,
        input.joinType ?? 'invite',
        status,
      ],
    );

    // Add creator as first member
    db.execute(
      `INSERT INTO nu_community_challenge_members (id, challenge_id, profile_id, role, current_value, joined_at)
       VALUES (?, ?, ?, 'creator', 0, datetime('now'))`,
      [crypto.randomUUID(), id, creatorProfileId],
    );

    // Create feed item
    createFeedItem(db, {
      profileId: creatorProfileId,
      activityType: 'challenge_joined',
      title: `Created challenge: ${input.title}`,
      metadata: { challengeId: id, challengeType: input.challengeType },
    });
  });

  const rows = db.query('SELECT * FROM nu_community_challenges WHERE id = ?', [id]);
  return mapChallenge(rows[0]);
}

export function joinChallenge(
  db: DatabaseAdapter,
  challengeId: string,
  profileId: string,
): ChallengeMember {
  const challenges = db.query('SELECT * FROM nu_community_challenges WHERE id = ?', [challengeId]);
  if (challenges.length === 0) throw new Error('Challenge not found');
  const challenge = challenges[0];

  if (challenge.status === 'completed' || challenge.status === 'cancelled') {
    throw new Error('Challenge is no longer active');
  }

  const existing = db.query(
    'SELECT id FROM nu_community_challenge_members WHERE challenge_id = ? AND profile_id = ?',
    [challengeId, profileId],
  );
  if (existing.length > 0) throw new Error('Already a member of this challenge');

  const countRows = db.query(
    'SELECT COUNT(*) as cnt FROM nu_community_challenge_members WHERE challenge_id = ?',
    [challengeId],
  );
  if ((countRows[0]?.cnt as number) >= (challenge.max_participants as number)) {
    throw new Error('Challenge is full');
  }

  const id = crypto.randomUUID();
  db.transaction(() => {
    db.execute(
      `INSERT INTO nu_community_challenge_members (id, challenge_id, profile_id, role, current_value, joined_at)
       VALUES (?, ?, ?, 'member', 0, datetime('now'))`,
      [id, challengeId, profileId],
    );

    createFeedItem(db, {
      profileId,
      activityType: 'challenge_joined',
      title: `Joined challenge: ${challenge.title as string}`,
      metadata: { challengeId, challengeType: challenge.challenge_type },
    });
  });

  const rows = db.query('SELECT * FROM nu_community_challenge_members WHERE id = ?', [id]);
  return mapMember(rows[0]);
}

export function updateChallengeProgress(
  db: DatabaseAdapter,
  challengeId: string,
  profileId: string,
  incrementBy: number,
): void {
  db.transaction(() => {
    db.execute(
      `UPDATE nu_community_challenge_members
       SET current_value = current_value + ?
       WHERE challenge_id = ? AND profile_id = ?`,
      [incrementBy, challengeId, profileId],
    );

    const challenges = db.query('SELECT * FROM nu_community_challenges WHERE id = ?', [challengeId]);
    if (challenges.length > 0 && challenges[0].target_value) {
      const members = db.query(
        'SELECT * FROM nu_community_challenge_members WHERE challenge_id = ? AND profile_id = ?',
        [challengeId, profileId],
      );
      if (members.length > 0 && (members[0].current_value as number) >= (challenges[0].target_value as number) && !members[0].completed_at) {
        db.execute(
          "UPDATE nu_community_challenge_members SET completed_at = datetime('now') WHERE challenge_id = ? AND profile_id = ?",
          [challengeId, profileId],
        );
        createFeedItem(db, {
          profileId,
          activityType: 'challenge_complete',
          title: `Completed challenge: ${challenges[0].title as string}`,
          metadata: { challengeId, challengeType: challenges[0].challenge_type, finalValue: members[0].current_value },
        });
      }
    }
  });
}

// -- Queries -----------------------------------------------------------------

export function getChallengeById(db: DatabaseAdapter, id: string): CommunityChallenge | null {
  const rows = db.query('SELECT * FROM nu_community_challenges WHERE id = ?', [id]);
  return rows.length > 0 ? mapChallenge(rows[0]) : null;
}

export function getActiveChallenges(db: DatabaseAdapter, profileId: string, limit = 50): CommunityChallenge[] {
  const rows = db.query(
    `SELECT ch.* FROM nu_community_challenges ch
     JOIN nu_community_challenge_members cm ON ch.id = cm.challenge_id
     WHERE cm.profile_id = ? AND ch.status IN ('upcoming', 'active')
     ORDER BY ch.start_date ASC
     LIMIT ?`,
    [profileId, limit],
  );
  return rows.map(mapChallenge);
}

export function getCompletedChallenges(db: DatabaseAdapter, profileId: string, limit = 50): CommunityChallenge[] {
  const rows = db.query(
    `SELECT ch.* FROM nu_community_challenges ch
     JOIN nu_community_challenge_members cm ON ch.id = cm.challenge_id
     WHERE cm.profile_id = ? AND ch.status = 'completed'
     ORDER BY ch.end_date DESC
     LIMIT ?`,
    [profileId, limit],
  );
  return rows.map(mapChallenge);
}

export function getChallengeLeaderboard(db: DatabaseAdapter, challengeId: string, limit = 100): LeaderboardEntry[] {
  const rows = db.query(
    `SELECT cm.*, p.display_name, p.avatar_emoji
     FROM nu_community_challenge_members cm
     JOIN nu_community_profiles p ON cm.profile_id = p.id
     WHERE cm.challenge_id = ?
     ORDER BY cm.current_value DESC, cm.joined_at ASC
     LIMIT ?`,
    [challengeId, limit],
  );

  return rows.map((row, i) => ({
    ...mapMember(row),
    displayName: row.display_name as string,
    avatarEmoji: row.avatar_emoji as string,
    rank: i + 1,
  }));
}

export function getChallengeMember(
  db: DatabaseAdapter,
  challengeId: string,
  profileId: string,
): ChallengeMember | null {
  const rows = db.query(
    'SELECT * FROM nu_community_challenge_members WHERE challenge_id = ? AND profile_id = ?',
    [challengeId, profileId],
  );
  return rows.length > 0 ? mapMember(rows[0]) : null;
}

export function transitionChallengeStatuses(db: DatabaseAdapter): void {
  const today = new Date().toISOString().slice(0, 10);
  db.execute(
    "UPDATE nu_community_challenges SET status = 'active' WHERE status = 'upcoming' AND start_date <= ?",
    [today],
  );
  db.execute(
    "UPDATE nu_community_challenges SET status = 'completed' WHERE status = 'active' AND end_date < ?",
    [today],
  );
}

export function getActiveChallengesByType(
  db: DatabaseAdapter,
  profileId: string,
  challengeType: ChallengeType,
): Array<{ challengeId: string }> {
  const rows = db.query(
    `SELECT ch.id as challenge_id
     FROM nu_community_challenges ch
     JOIN nu_community_challenge_members cm ON ch.id = cm.challenge_id
     WHERE cm.profile_id = ? AND ch.challenge_type = ? AND ch.status = 'active'
       AND cm.completed_at IS NULL`,
    [profileId, challengeType],
  );
  return rows.map((r) => ({ challengeId: r.challenge_id as string }));
}

// -- Row mappers -------------------------------------------------------------

function mapChallenge(row: Record<string, unknown>): CommunityChallenge {
  return {
    id: row.id as string,
    creatorProfileId: row.creator_profile_id as string,
    title: row.title as string,
    description: row.description as string | null,
    challengeType: row.challenge_type as ChallengeType,
    targetValue: row.target_value as number | null,
    targetUnit: row.target_unit as string | null,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    maxParticipants: row.max_participants as number,
    joinType: row.join_type as ChallengeJoinType,
    status: row.status as ChallengeStatus,
    createdAt: row.created_at as string,
  };
}

function mapMember(row: Record<string, unknown>): ChallengeMember {
  return {
    id: row.id as string,
    challengeId: row.challenge_id as string,
    profileId: row.profile_id as string,
    role: row.role as ChallengeMemberRole,
    currentValue: row.current_value as number,
    joinedAt: row.joined_at as string,
    completedAt: row.completed_at as string | null,
  };
}
