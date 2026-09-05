import type { DatabaseAdapter } from '@mylife/db';
import type { League, LeagueMember, LeagueScore, LeagueTier } from '../leagues/types';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToLeague(row: Record<string, unknown>): League {
  return {
    id: row.id as string,
    name: row.name as string,
    seasonStart: row.season_start as string,
    seasonEnd: row.season_end as string,
    tier: row.tier as LeagueTier,
    maxMembers: row.max_members as number,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

function rowToMember(row: Record<string, unknown>): LeagueMember {
  return {
    id: row.id as string,
    leagueId: row.league_id as string,
    userId: row.user_id as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string) ?? null,
    isSelf: Boolean(row.is_self),
    joinedAt: row.joined_at as string,
  };
}

function rowToScore(row: Record<string, unknown>): LeagueScore {
  return {
    id: row.id as string,
    leagueId: row.league_id as string,
    userId: row.user_id as string,
    weekStart: row.week_start as string,
    xpEarned: (row.xp_earned as number) ?? 0,
    cardsReviewed: (row.cards_reviewed as number) ?? 0,
    streakDays: (row.streak_days as number) ?? 0,
    rank: (row.rank as number) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export function createLeague(
  db: DatabaseAdapter,
  name: string,
  tier: LeagueTier,
  seasonStart: string,
  seasonEnd: string,
): League {
  const id = createId('fl_lg');
  const now = nowIso();
  db.execute(
    `INSERT INTO fl_leagues (id, name, season_start, season_end, tier, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [id, name, seasonStart, seasonEnd, tier, now],
  );
  return { id, name, seasonStart, seasonEnd, tier, maxMembers: 30, isActive: true, createdAt: now };
}

export function addLeagueMember(
  db: DatabaseAdapter,
  leagueId: string,
  userId: string,
  displayName: string,
  isSelf = false,
): LeagueMember {
  const id = createId('fl_lm');
  const now = nowIso();
  db.execute(
    `INSERT INTO fl_league_members (id, league_id, user_id, display_name, is_self, joined_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, leagueId, userId, displayName, isSelf ? 1 : 0, now],
  );
  return { id, leagueId, userId, displayName, avatarUrl: null, isSelf, joinedAt: now };
}

export function upsertLeagueScore(
  db: DatabaseAdapter,
  leagueId: string,
  userId: string,
  weekStart: string,
  xpEarned: number,
  cardsReviewed: number,
  streakDays: number,
): LeagueScore {
  const now = nowIso();
  const id = createId('fl_ls');
  db.execute(
    `INSERT INTO fl_league_scores (id, league_id, user_id, week_start, xp_earned, cards_reviewed, streak_days, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(league_id, user_id, week_start) DO UPDATE SET
       xp_earned = excluded.xp_earned,
       cards_reviewed = excluded.cards_reviewed,
       streak_days = excluded.streak_days,
       updated_at = excluded.updated_at`,
    [id, leagueId, userId, weekStart, xpEarned, cardsReviewed, streakDays, now],
  );
  const row = db.query<Record<string, unknown>>(
    `SELECT * FROM fl_league_scores WHERE league_id = ? AND user_id = ? AND week_start = ?`,
    [leagueId, userId, weekStart],
  )[0];
  return row ? rowToScore(row) : { id, leagueId, userId, weekStart, xpEarned, cardsReviewed, streakDays, rank: null, updatedAt: now };
}

export function getLeagueById(db: DatabaseAdapter, leagueId: string): League | null {
  const row = db.query<Record<string, unknown>>(`SELECT * FROM fl_leagues WHERE id = ?`, [leagueId])[0];
  return row ? rowToLeague(row) : null;
}

export function listLeagueMembers(db: DatabaseAdapter, leagueId: string, limit = 200): LeagueMember[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM fl_league_members WHERE league_id = ? ORDER BY joined_at ASC LIMIT ?`,
    [leagueId, limit],
  ).map(rowToMember);
}

export function listLeagueScores(db: DatabaseAdapter, leagueId: string, weekStart: string, limit = 200): LeagueScore[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM fl_league_scores WHERE league_id = ? AND week_start = ? ORDER BY xp_earned DESC LIMIT ?`,
    [leagueId, weekStart, limit],
  ).map(rowToScore);
}

export function listActiveLeagues(db: DatabaseAdapter, limit = 50): League[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM fl_leagues WHERE is_active = 1 ORDER BY season_start DESC LIMIT ?`,
    [limit],
  ).map(rowToLeague);
}
