/**
 * Community Challenge CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface CommunityChallenge {
  id: string;
  name: string;
  description: string;
  challenge_type: 'books_count' | 'pages_count' | 'themed' | 'genre_diversity' | 'author_diversity';
  target_value: number;
  target_unit: 'books' | 'pages' | 'genres' | 'authors';
  time_frame: 'monthly' | 'quarterly' | 'yearly' | 'seasonal' | 'custom';
  start_date: string;
  end_date: string;
  theme_prompt: string | null;
  theme_tags: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  is_preset: number;
  participant_count: number;
  source: 'local' | 'community';
  created_at: string;
  updated_at: string;
}

export interface CommunityChallengeInsert {
  name: string;
  description: string;
  challenge_type: CommunityChallenge['challenge_type'];
  target_value: number;
  target_unit: CommunityChallenge['target_unit'];
  time_frame: CommunityChallenge['time_frame'];
  start_date: string;
  end_date: string;
  theme_prompt?: string | null;
  theme_tags?: string | null;
  difficulty?: CommunityChallenge['difficulty'];
  is_preset?: number;
  source?: CommunityChallenge['source'];
}

export interface CommunityParticipation {
  id: string;
  challenge_id: string;
  status: 'active' | 'completed' | 'abandoned';
  joined_at: string;
  completed_at: string | null;
  current_value: number;
  notes: string | null;
}

// ── Challenge CRUD ──

export function getCommunityChallenge(
  db: DatabaseAdapter,
  id: string,
): CommunityChallenge | null {
  const rows = db.query<CommunityChallenge>(
    `SELECT * FROM bk_community_challenges WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getAllCommunityChallenge(db: DatabaseAdapter): CommunityChallenge[] {
  return db.query<CommunityChallenge>(
    `SELECT * FROM bk_community_challenges ORDER BY start_date`,
  );
}

export function getPresetChallenges(db: DatabaseAdapter): CommunityChallenge[] {
  return db.query<CommunityChallenge>(
    `SELECT * FROM bk_community_challenges WHERE is_preset = 1 ORDER BY start_date`,
  );
}

export function createCommunityChallenge(
  db: DatabaseAdapter,
  id: string,
  input: CommunityChallengeInsert,
): CommunityChallenge {
  const now = new Date().toISOString();
  const challenge: CommunityChallenge = {
    id,
    name: input.name,
    description: input.description,
    challenge_type: input.challenge_type,
    target_value: input.target_value,
    target_unit: input.target_unit,
    time_frame: input.time_frame,
    start_date: input.start_date,
    end_date: input.end_date,
    theme_prompt: input.theme_prompt ?? null,
    theme_tags: input.theme_tags ?? null,
    difficulty: input.difficulty ?? 'medium',
    is_preset: input.is_preset ?? 0,
    participant_count: 0,
    source: input.source ?? 'local',
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bk_community_challenges (id, name, description, challenge_type, target_value,
       target_unit, time_frame, start_date, end_date, theme_prompt, theme_tags,
       difficulty, is_preset, participant_count, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      challenge.id, challenge.name, challenge.description, challenge.challenge_type,
      challenge.target_value, challenge.target_unit, challenge.time_frame,
      challenge.start_date, challenge.end_date, challenge.theme_prompt,
      challenge.theme_tags, challenge.difficulty, challenge.is_preset,
      challenge.participant_count, challenge.source, challenge.created_at,
      challenge.updated_at,
    ],
  );

  return challenge;
}

export function deleteCommunityChallenge(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_community_challenges WHERE id = ?`, [id]);
}

// ── Participation CRUD ──

export function joinChallenge(
  db: DatabaseAdapter,
  id: string,
  challengeId: string,
): CommunityParticipation {
  const now = new Date().toISOString();
  const participation: CommunityParticipation = {
    id,
    challenge_id: challengeId,
    status: 'active',
    joined_at: now,
    completed_at: null,
    current_value: 0,
    notes: null,
  };

  db.transaction(() => {
    db.execute(
      `INSERT INTO bk_community_challenge_participation (id, challenge_id, status, joined_at, completed_at, current_value, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        participation.id, participation.challenge_id, participation.status,
        participation.joined_at, participation.completed_at, participation.current_value,
        participation.notes,
      ],
    );

    // Increment participant count on the challenge
    db.execute(
      `UPDATE bk_community_challenges SET participant_count = participant_count + 1, updated_at = ? WHERE id = ?`,
      [now, challengeId],
    );
  });

  return participation;
}

export function getParticipation(
  db: DatabaseAdapter,
  participationId: string,
): CommunityParticipation | null {
  const rows = db.query<CommunityParticipation>(
    `SELECT * FROM bk_community_challenge_participation WHERE id = ?`,
    [participationId],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getActiveParticipations(db: DatabaseAdapter): CommunityParticipation[] {
  return db.query<CommunityParticipation>(
    `SELECT * FROM bk_community_challenge_participation WHERE status = 'active'`,
  );
}

export function getAllParticipations(db: DatabaseAdapter): CommunityParticipation[] {
  return db.query<CommunityParticipation>(
    `SELECT * FROM bk_community_challenge_participation ORDER BY joined_at DESC`,
  );
}

export function updateParticipationProgress(
  db: DatabaseAdapter,
  participationId: string,
  newValue: number,
): void {
  db.execute(
    `UPDATE bk_community_challenge_participation SET current_value = ? WHERE id = ?`,
    [newValue, participationId],
  );
}

export function completeParticipation(db: DatabaseAdapter, participationId: string): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE bk_community_challenge_participation SET status = 'completed', completed_at = ? WHERE id = ?`,
    [now, participationId],
  );
}

export function abandonParticipation(db: DatabaseAdapter, participationId: string): void {
  db.execute(
    `UPDATE bk_community_challenge_participation SET status = 'abandoned' WHERE id = ?`,
    [participationId],
  );
}
