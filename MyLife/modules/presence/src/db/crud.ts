import type { DatabaseAdapter } from '@mylife/db';
import type {
  DailyUsage,
  AppUsage,
  Goal,
  FocusSession,
  SessionWhitelist,
  AppIntention,
  AppOpen,
  ScheduledSession,
  EarnedBadge,
  BadgeTier,
  AccountabilityPartner,
  Reward,
  RewardMilestoneType,
  CommitmentContract,
  SessionType,
  XPEntry,
} from '../types';

// ── ID generation ─────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function booleanToInteger(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

function integerToBoolean(value: number | null | undefined): boolean {
  return value === 1;
}

function safeJsonParseArray(value: string | null | undefined): string[] {
  if (value == null || value === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseDaysOfWeek(value: string): number[] {
  return value
    .split(',')
    .map((item) => parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
}

function serializeDaysOfWeek(days: number[]): string {
  return [...new Set(days)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((left, right) => left - right)
    .join(',');
}

// ── Helpers ───────────────────────────────────────────────────────────────

// ── Daily Usage CRUD ──────────────────────────────────────────────────────

export interface UpsertDailyUsageInput {
  date: string;
  total_minutes: number;
  goal_minutes?: number | null;
  goal_met?: boolean;
  pickups?: number;
  first_pickup?: string | null;
  last_pickup?: string | null;
}

export function upsertDailyUsage(db: DatabaseAdapter, input: UpsertDailyUsageInput): DailyUsage {
  const id = generateId();
  const goalMet = input.goal_met ? 1 : 0;
  db.execute(
    `INSERT INTO pr_daily_usage (id, date, total_minutes, goal_minutes, goal_met, pickups, first_pickup, last_pickup)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       total_minutes = excluded.total_minutes,
       goal_minutes = excluded.goal_minutes,
       goal_met = excluded.goal_met,
       pickups = excluded.pickups,
       first_pickup = excluded.first_pickup,
       last_pickup = excluded.last_pickup`,
    [
      id,
      input.date,
      input.total_minutes,
      input.goal_minutes ?? null,
      goalMet,
      input.pickups ?? 0,
      input.first_pickup ?? null,
      input.last_pickup ?? null,
    ],
  );
  return getDailyUsageByDate(db, input.date)!;
}

export function getDailyUsageByDate(db: DatabaseAdapter, date: string): DailyUsage | null {
  const rows = db.query<DailyUsage>('SELECT * FROM pr_daily_usage WHERE date = ?', [date]);
  return rows[0] ?? null;
}

export function getDailyUsageRange(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
  limit = 365,
): DailyUsage[] {
  return db.query<DailyUsage>(
    'SELECT * FROM pr_daily_usage WHERE date >= ? AND date <= ? ORDER BY date DESC LIMIT ?',
    [startDate, endDate, limit],
  );
}

// ── App Usage CRUD ────────────────────────────────────────────────────────

export interface CreateAppUsageInput {
  date: string;
  app_id: string;
  app_name: string;
  category?: string;
  minutes: number;
  opens?: number;
}

export function createAppUsage(db: DatabaseAdapter, input: CreateAppUsageInput): AppUsage {
  const id = generateId();
  db.execute(
    `INSERT INTO pr_app_usage (id, date, app_id, app_name, category, minutes, opens)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.date, input.app_id, input.app_name, input.category ?? 'other', input.minutes, input.opens ?? 0],
  );
  return db.query<AppUsage>('SELECT * FROM pr_app_usage WHERE id = ?', [id])[0];
}

export function getAppUsageByDate(db: DatabaseAdapter, date: string, limit = 200): AppUsage[] {
  return db.query<AppUsage>(
    'SELECT * FROM pr_app_usage WHERE date = ? ORDER BY minutes DESC LIMIT ?',
    [date, limit],
  );
}

export function getAppUsageRange(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
  limit = 1000,
): AppUsage[] {
  return db.query<AppUsage>(
    'SELECT * FROM pr_app_usage WHERE date >= ? AND date <= ? ORDER BY date DESC, minutes DESC LIMIT ?',
    [startDate, endDate, limit],
  );
}

export function getTopApps(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
  topN = 10,
): { app_name: string; category: string; total_minutes: number; total_opens: number }[] {
  return db.query(
    `SELECT app_name, category, SUM(minutes) as total_minutes, SUM(opens) as total_opens
     FROM pr_app_usage WHERE date >= ? AND date <= ?
     GROUP BY app_id ORDER BY total_minutes DESC LIMIT ?`,
    [startDate, endDate, topN],
  );
}

// ── Goals CRUD ────────────────────────────────────────────────────────────

export interface CreateGoalInput {
  daily_minutes: number;
  effective_date: string;
}

export function createGoal(db: DatabaseAdapter, input: CreateGoalInput): Goal {
  const id = generateId();
  db.execute(
    'INSERT INTO pr_goals (id, daily_minutes, effective_date) VALUES (?, ?, ?)',
    [id, input.daily_minutes, input.effective_date],
  );
  return db.query<Goal>('SELECT * FROM pr_goals WHERE id = ?', [id])[0];
}

export function getActiveGoal(db: DatabaseAdapter, asOfDate: string): Goal | null {
  const rows = db.query<Goal>(
    'SELECT * FROM pr_goals WHERE effective_date <= ? ORDER BY effective_date DESC LIMIT 1',
    [asOfDate],
  );
  return rows[0] ?? null;
}

export function getAllGoals(db: DatabaseAdapter, limit = 100): Goal[] {
  return db.query<Goal>('SELECT * FROM pr_goals ORDER BY effective_date DESC LIMIT ?', [limit]);
}

// ── Focus Sessions CRUD ───────────────────────────────────────────────────

export interface CreateFocusSessionInput {
  planned_minutes: number;
  type?: string;
}

export function createFocusSession(db: DatabaseAdapter, input: CreateFocusSessionInput): FocusSession {
  const id = generateId();
  const now = new Date().toISOString();
  db.execute(
    'INSERT INTO pr_sessions (id, start_time, planned_minutes, type) VALUES (?, ?, ?, ?)',
    [id, now, input.planned_minutes, input.type ?? 'solo'],
  );
  return db.query<FocusSession>('SELECT * FROM pr_sessions WHERE id = ?', [id])[0];
}

export function completeFocusSession(
  db: DatabaseAdapter,
  sessionId: string,
  actualMinutes: number,
  rating?: number,
): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE pr_sessions
     SET end_time = COALESCE(end_time, ?),
         actual_minutes = COALESCE(actual_minutes, ?),
         completed = 1,
         rating = COALESCE(?, rating)
     WHERE id = ?`,
    [now, actualMinutes, rating ?? null, sessionId],
  );
}

export function updateFocusSessionRating(
  db: DatabaseAdapter,
  sessionId: string,
  rating: number | null,
): void {
  db.execute('UPDATE pr_sessions SET rating = ? WHERE id = ?', [rating, sessionId]);
}

export function abandonFocusSession(db: DatabaseAdapter, sessionId: string, actualMinutes: number): void {
  const now = new Date().toISOString();
  db.execute(
    'UPDATE pr_sessions SET end_time = ?, actual_minutes = ?, completed = 0 WHERE id = ?',
    [now, actualMinutes, sessionId],
  );
}

export function getFocusSession(db: DatabaseAdapter, sessionId: string): FocusSession | null {
  const rows = db.query<FocusSession>('SELECT * FROM pr_sessions WHERE id = ?', [sessionId]);
  return rows[0] ?? null;
}

export function getFocusSessions(db: DatabaseAdapter, limit = 200): FocusSession[] {
  return db.query<FocusSession>(
    'SELECT * FROM pr_sessions ORDER BY start_time DESC LIMIT ?',
    [limit],
  );
}

export function getFocusSessionsByDate(db: DatabaseAdapter, date: string, limit = 50): FocusSession[] {
  return db.query<FocusSession>(
    "SELECT * FROM pr_sessions WHERE date(start_time) = ? ORDER BY start_time DESC LIMIT ?",
    [date, limit],
  );
}

export function deleteFocusSession(db: DatabaseAdapter, sessionId: string): void {
  db.execute('DELETE FROM pr_sessions WHERE id = ?', [sessionId]);
}

// ── Session Whitelist CRUD ────────────────────────────────────────────────

export function addToWhitelist(db: DatabaseAdapter, sessionId: string, appId: string, appName: string): void {
  const id = generateId();
  db.execute(
    'INSERT INTO pr_session_whitelist (id, session_id, app_id, app_name) VALUES (?, ?, ?, ?)',
    [id, sessionId, appId, appName],
  );
}

export function getWhitelist(db: DatabaseAdapter, sessionId: string): SessionWhitelist[] {
  return db.query<SessionWhitelist>(
    'SELECT * FROM pr_session_whitelist WHERE session_id = ?',
    [sessionId],
  );
}

// ── App Intentions CRUD ───────────────────────────────────────────────────

export interface CreateAppIntentionInput {
  app_id: string;
  app_name: string;
  daily_open_limit?: number | null;
  per_open_minutes?: number | null;
  breathing_pause?: boolean;
}

export function upsertAppIntention(db: DatabaseAdapter, input: CreateAppIntentionInput): AppIntention {
  const id = generateId();
  db.execute(
    `INSERT INTO pr_app_intentions (id, app_id, app_name, daily_open_limit, per_open_minutes, breathing_pause)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(app_id) DO UPDATE SET
       app_name = excluded.app_name,
       daily_open_limit = excluded.daily_open_limit,
       per_open_minutes = excluded.per_open_minutes,
       breathing_pause = excluded.breathing_pause`,
    [
      id,
      input.app_id,
      input.app_name,
      input.daily_open_limit ?? null,
      input.per_open_minutes ?? null,
      input.breathing_pause ? 1 : 0,
    ],
  );
  return db.query<AppIntention>('SELECT * FROM pr_app_intentions WHERE app_id = ?', [input.app_id])[0];
}

export function getAppIntention(db: DatabaseAdapter, appId: string): AppIntention | null {
  const rows = db.query<AppIntention>('SELECT * FROM pr_app_intentions WHERE app_id = ? AND active = 1', [appId]);
  return rows[0] ?? null;
}

export function getAllActiveIntentions(db: DatabaseAdapter, limit = 200): AppIntention[] {
  return db.query<AppIntention>('SELECT * FROM pr_app_intentions WHERE active = 1 ORDER BY app_name LIMIT ?', [limit]);
}

export function deactivateIntention(db: DatabaseAdapter, appId: string): void {
  db.execute('UPDATE pr_app_intentions SET active = 0 WHERE app_id = ?', [appId]);
}

export function deleteIntention(db: DatabaseAdapter, appId: string): void {
  db.execute('DELETE FROM pr_app_intentions WHERE app_id = ?', [appId]);
}

// ── App Opens CRUD ────────────────────────────────────────────────────────

export interface RecordAppOpenInput {
  date: string;
  app_id: string;
  intention_text?: string | null;
}

export function recordAppOpen(db: DatabaseAdapter, input: RecordAppOpenInput): AppOpen {
  const id = generateId();
  const now = new Date().toISOString();
  db.execute(
    'INSERT INTO pr_app_opens (id, date, app_id, opened_at, intention_text) VALUES (?, ?, ?, ?, ?)',
    [id, input.date, input.app_id, now, input.intention_text ?? null],
  );
  return db.query<AppOpen>('SELECT * FROM pr_app_opens WHERE id = ?', [id])[0];
}

export function getAppOpen(db: DatabaseAdapter, openId: string): AppOpen | null {
  const rows = db.query<AppOpen>('SELECT * FROM pr_app_opens WHERE id = ?', [openId]);
  return rows[0] ?? null;
}

export function rateAppOpen(db: DatabaseAdapter, openId: string, rating: number, reflectionNote?: string | null): void {
  db.execute(
    'UPDATE pr_app_opens SET post_rating = ?, reflection_note = COALESCE(?, reflection_note) WHERE id = ?',
    [rating, reflectionNote ?? null, openId],
  );
}

export function getAppOpensForDate(db: DatabaseAdapter, date: string, appId: string, limit = 100): AppOpen[] {
  return db.query<AppOpen>(
    'SELECT * FROM pr_app_opens WHERE date = ? AND app_id = ? ORDER BY opened_at DESC LIMIT ?',
    [date, appId, limit],
  );
}

export function countAppOpensForDate(db: DatabaseAdapter, date: string, appId: string): number {
  const result = db.query<{ count: number }>(
    'SELECT COUNT(*) as count FROM pr_app_opens WHERE date = ? AND app_id = ?',
    [date, appId],
  );
  return result[0]?.count ?? 0;
}

// ── Scheduled Sessions CRUD ──────────────────────────────────────────────

type ScheduledSessionRow = {
  id: string;
  name: string;
  start_time: string;
  duration_minutes: number;
  days_of_week: string;
  whitelist_json: string | null;
  session_type: SessionType;
  active: number;
  created_at: number;
  updated_at: number;
};

function mapScheduledSession(row: ScheduledSessionRow): ScheduledSession {
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    daysOfWeek: parseDaysOfWeek(row.days_of_week),
    whitelist: safeJsonParseArray(row.whitelist_json),
    sessionType: row.session_type,
    active: integerToBoolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateScheduledSessionInput {
  name: string;
  startTime: string;
  durationMinutes: number;
  daysOfWeek: number[];
  whitelist?: string[];
  sessionType?: SessionType;
  active?: boolean;
}

export interface UpdateScheduledSessionPatch {
  name?: string;
  startTime?: string;
  durationMinutes?: number;
  daysOfWeek?: number[];
  whitelist?: string[];
  sessionType?: SessionType;
  active?: boolean;
}

export function createScheduledSession(db: DatabaseAdapter, input: CreateScheduledSessionInput): ScheduledSession {
  const id = generateId();
  const now = Date.now();
  db.execute(
    `INSERT INTO pr_scheduled_sessions (
       id, name, start_time, duration_minutes, days_of_week, whitelist_json, session_type, active, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.startTime,
      input.durationMinutes,
      serializeDaysOfWeek(input.daysOfWeek),
      JSON.stringify(input.whitelist ?? []),
      input.sessionType ?? 'solo',
      booleanToInteger(input.active ?? true),
      now,
      now,
    ],
  );
  return mapScheduledSession(db.query<ScheduledSessionRow>('SELECT * FROM pr_scheduled_sessions WHERE id = ?', [id])[0]);
}

export function getScheduledSessions(db: DatabaseAdapter, activeOnly = false): ScheduledSession[] {
  const rows = activeOnly
    ? db.query<ScheduledSessionRow>(
      'SELECT * FROM pr_scheduled_sessions WHERE active = 1 ORDER BY start_time ASC, name ASC',
      [],
    )
    : db.query<ScheduledSessionRow>('SELECT * FROM pr_scheduled_sessions ORDER BY active DESC, start_time ASC, name ASC', []);
  return rows.map(mapScheduledSession);
}

export function updateScheduledSession(
  db: DatabaseAdapter,
  id: string,
  patch: UpdateScheduledSessionPatch,
): ScheduledSession {
  const existing = db.query<ScheduledSessionRow>('SELECT * FROM pr_scheduled_sessions WHERE id = ?', [id])[0];
  if (existing == null) {
    throw new Error('Scheduled session not found');
  }
  const merged = {
    name: patch.name ?? existing.name,
    startTime: patch.startTime ?? existing.start_time,
    durationMinutes: patch.durationMinutes ?? existing.duration_minutes,
    daysOfWeek: patch.daysOfWeek ?? parseDaysOfWeek(existing.days_of_week),
    whitelist: patch.whitelist ?? safeJsonParseArray(existing.whitelist_json),
    sessionType: patch.sessionType ?? existing.session_type,
    active: patch.active ?? integerToBoolean(existing.active),
  };
  db.execute(
    `UPDATE pr_scheduled_sessions
     SET name = ?, start_time = ?, duration_minutes = ?, days_of_week = ?, whitelist_json = ?, session_type = ?, active = ?, updated_at = ?
     WHERE id = ?`,
    [
      merged.name.trim(),
      merged.startTime,
      merged.durationMinutes,
      serializeDaysOfWeek(merged.daysOfWeek),
      JSON.stringify(merged.whitelist),
      merged.sessionType,
      booleanToInteger(merged.active),
      Date.now(),
      id,
    ],
  );
  return mapScheduledSession(db.query<ScheduledSessionRow>('SELECT * FROM pr_scheduled_sessions WHERE id = ?', [id])[0]);
}

export function deleteScheduledSession(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM pr_scheduled_sessions WHERE id = ?', [id]);
}

export function toggleScheduledSession(db: DatabaseAdapter, id: string, active: boolean): ScheduledSession {
  db.execute('UPDATE pr_scheduled_sessions SET active = ?, updated_at = ? WHERE id = ?', [
    booleanToInteger(active),
    Date.now(),
    id,
  ]);
  const row = db.query<ScheduledSessionRow>('SELECT * FROM pr_scheduled_sessions WHERE id = ?', [id])[0];
  if (row == null) {
    throw new Error('Scheduled session not found');
  }
  return mapScheduledSession(row);
}

// ── Badge Persistence CRUD ───────────────────────────────────────────────

type EarnedBadgeRow = {
  id: string;
  badge_id: string;
  category: string;
  tier: BadgeTier;
  earned_at: number;
  created_at: number;
};

function mapEarnedBadge(row: EarnedBadgeRow): EarnedBadge {
  return {
    id: row.id,
    badgeId: row.badge_id,
    category: row.category,
    tier: row.tier,
    earnedAt: row.earned_at,
    createdAt: row.created_at,
  };
}

export function recordBadgeEarned(
  db: DatabaseAdapter,
  badgeId: string,
  category: string,
  tier: BadgeTier = 'bronze',
): EarnedBadge {
  const existing = db.query<EarnedBadgeRow>('SELECT * FROM pr_badges WHERE badge_id = ?', [badgeId])[0];
  if (existing != null) {
    return mapEarnedBadge(existing);
  }
  const id = generateId();
  const now = Date.now();
  db.execute(
    `INSERT OR IGNORE INTO pr_badges (id, badge_id, category, tier, earned_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, badgeId, category, tier, now, now],
  );
  const row = db.query<EarnedBadgeRow>('SELECT * FROM pr_badges WHERE badge_id = ?', [badgeId])[0];
  if (row == null) {
    throw new Error('Failed to persist earned badge');
  }
  return mapEarnedBadge(row);
}

export function getEarnedBadges(db: DatabaseAdapter): EarnedBadge[] {
  return db.query<EarnedBadgeRow>('SELECT * FROM pr_badges ORDER BY earned_at DESC', []).map(mapEarnedBadge);
}

export function isBadgeEarned(db: DatabaseAdapter, badgeId: string): boolean {
  const row = db.query<{ count: number }>('SELECT COUNT(*) as count FROM pr_badges WHERE badge_id = ?', [badgeId])[0];
  return (row?.count ?? 0) > 0;
}

// ── Accountability Partner CRUD ──────────────────────────────────────────

type AccountabilityPartnerRow = {
  id: string;
  partner_name: string;
  share_code: string;
  active: number;
  notify_over_goal: number;
  created_at: number;
};

function mapAccountabilityPartner(row: AccountabilityPartnerRow): AccountabilityPartner {
  return {
    id: row.id,
    partnerName: row.partner_name,
    shareCode: row.share_code,
    active: integerToBoolean(row.active),
    notifyOverGoal: integerToBoolean(row.notify_over_goal),
    createdAt: row.created_at,
  };
}

export function generateShareCode(): string {
  return Array.from({ length: 8 }, () => SHARE_CODE_ALPHABET[Math.floor(Math.random() * SHARE_CODE_ALPHABET.length)]).join('');
}

export function createAccountabilityPartner(db: DatabaseAdapter, name: string): AccountabilityPartner {
  const id = generateId();
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    throw new Error('Partner name is required');
  }

  let shareCode = generateShareCode();
  while (db.query<{ count: number }>('SELECT COUNT(*) as count FROM pr_accountability_partners WHERE share_code = ?', [shareCode])[0]?.count) {
    shareCode = generateShareCode();
  }

  db.execute(
    `INSERT INTO pr_accountability_partners (id, partner_name, share_code, active, notify_over_goal, created_at)
     VALUES (?, ?, ?, 1, 1, ?)`,
    [id, trimmedName, shareCode, Date.now()],
  );
  return mapAccountabilityPartner(
    db.query<AccountabilityPartnerRow>('SELECT * FROM pr_accountability_partners WHERE id = ?', [id])[0],
  );
}

export interface UpdateAccountabilityPartnerPatch {
  partnerName?: string;
  active?: boolean;
  notifyOverGoal?: boolean;
}

export function getAccountabilityPartners(db: DatabaseAdapter, activeOnly = false): AccountabilityPartner[] {
  const rows = activeOnly
    ? db.query<AccountabilityPartnerRow>(
      'SELECT * FROM pr_accountability_partners WHERE active = 1 ORDER BY created_at DESC',
      [],
    )
    : db.query<AccountabilityPartnerRow>('SELECT * FROM pr_accountability_partners ORDER BY active DESC, created_at DESC', []);
  return rows.map(mapAccountabilityPartner);
}

export function updateAccountabilityPartner(
  db: DatabaseAdapter,
  id: string,
  patch: UpdateAccountabilityPartnerPatch,
): AccountabilityPartner {
  const existing = db.query<AccountabilityPartnerRow>('SELECT * FROM pr_accountability_partners WHERE id = ?', [id])[0];
  if (existing == null) {
    throw new Error('Accountability partner not found');
  }
  db.execute(
    `UPDATE pr_accountability_partners
     SET partner_name = ?, active = ?, notify_over_goal = ?
     WHERE id = ?`,
    [
      (patch.partnerName ?? existing.partner_name).trim(),
      booleanToInteger(patch.active ?? integerToBoolean(existing.active)),
      booleanToInteger(patch.notifyOverGoal ?? integerToBoolean(existing.notify_over_goal)),
      id,
    ],
  );
  return mapAccountabilityPartner(
    db.query<AccountabilityPartnerRow>('SELECT * FROM pr_accountability_partners WHERE id = ?', [id])[0],
  );
}

export function revokeAccountabilityPartner(db: DatabaseAdapter, id: string): void {
  db.execute('UPDATE pr_accountability_partners SET active = 0 WHERE id = ?', [id]);
}

// ── Rewards CRUD ─────────────────────────────────────────────────────────

type RewardRow = {
  id: string;
  milestone_type: RewardMilestoneType;
  milestone_value: number;
  reward_text: string;
  earned: number;
  earned_at: number | null;
  created_at: number;
};

function mapReward(row: RewardRow): Reward {
  return {
    id: row.id,
    milestoneType: row.milestone_type,
    milestoneValue: row.milestone_value,
    rewardText: row.reward_text,
    earned: integerToBoolean(row.earned),
    earnedAt: row.earned_at,
    createdAt: row.created_at,
  };
}

export interface CreateRewardInput {
  milestoneType: RewardMilestoneType;
  milestoneValue: number;
  rewardText: string;
}

export function createReward(db: DatabaseAdapter, input: CreateRewardInput): Reward {
  const id = generateId();
  const now = Date.now();
  db.execute(
    `INSERT INTO pr_rewards (id, milestone_type, milestone_value, reward_text, earned, earned_at, created_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?)`,
    [id, input.milestoneType, input.milestoneValue, input.rewardText.trim(), now],
  );
  return mapReward(db.query<RewardRow>('SELECT * FROM pr_rewards WHERE id = ?', [id])[0]);
}

export function getRewards(db: DatabaseAdapter): Reward[] {
  return db.query<RewardRow>('SELECT * FROM pr_rewards ORDER BY earned ASC, created_at DESC', []).map(mapReward);
}

export function markRewardEarned(db: DatabaseAdapter, id: string): Reward {
  const now = Date.now();
  db.execute(
    'UPDATE pr_rewards SET earned = 1, earned_at = COALESCE(earned_at, ?) WHERE id = ?',
    [now, id],
  );
  const row = db.query<RewardRow>('SELECT * FROM pr_rewards WHERE id = ?', [id])[0];
  if (row == null) {
    throw new Error('Reward not found');
  }
  return mapReward(row);
}

export function deleteReward(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM pr_rewards WHERE id = ?', [id]);
}

// ── Commitment Contracts CRUD ────────────────────────────────────────────

type CommitmentContractRow = {
  id: string;
  text: string;
  active: number;
  created_at: number;
  updated_at: number;
};

function mapCommitment(row: CommitmentContractRow): CommitmentContract {
  return {
    id: row.id,
    text: row.text,
    active: integerToBoolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCommitment(db: DatabaseAdapter, text: string): CommitmentContract {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('Commitment text is required');
  }
  const id = generateId();
  const now = Date.now();
  db.transaction(() => {
    db.execute('UPDATE pr_commitment_contracts SET active = 0 WHERE active = 1', []);
    db.execute(
      `INSERT INTO pr_commitment_contracts (id, text, active, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)`,
      [id, trimmed, now, now],
    );
  });
  return mapCommitment(db.query<CommitmentContractRow>('SELECT * FROM pr_commitment_contracts WHERE id = ?', [id])[0]);
}

export function getCommitments(db: DatabaseAdapter): CommitmentContract[] {
  return db.query<CommitmentContractRow>('SELECT * FROM pr_commitment_contracts ORDER BY updated_at DESC', []).map(mapCommitment);
}

export function getActiveCommitment(db: DatabaseAdapter): CommitmentContract | null {
  const row = db.query<CommitmentContractRow>(
    'SELECT * FROM pr_commitment_contracts WHERE active = 1 ORDER BY updated_at DESC LIMIT 1',
    [],
  )[0];
  return row == null ? null : mapCommitment(row);
}

export function updateCommitment(db: DatabaseAdapter, id: string, text: string): CommitmentContract {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('Commitment text is required');
  }
  const now = Date.now();
  db.transaction(() => {
    db.execute('UPDATE pr_commitment_contracts SET active = 0 WHERE active = 1 AND id != ?', [id]);
    db.execute(
      'UPDATE pr_commitment_contracts SET text = ?, active = 1, updated_at = ? WHERE id = ?',
      [trimmed, now, id],
    );
  });
  const row = db.query<CommitmentContractRow>('SELECT * FROM pr_commitment_contracts WHERE id = ?', [id])[0];
  if (row == null) {
    throw new Error('Commitment not found');
  }
  return mapCommitment(row);
}

export function deleteCommitment(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM pr_commitment_contracts WHERE id = ?', [id]);
}

// ── XP Log CRUD ───────────────────────────────────────────────────────────

export interface AwardXPInput {
  date: string;
  source: string;
  amount: number;
}

export function awardXP(db: DatabaseAdapter, input: AwardXPInput): XPEntry {
  const id = generateId();
  db.execute(
    'INSERT INTO pr_xp_log (id, date, source, amount) VALUES (?, ?, ?, ?)',
    [id, input.date, input.source, input.amount],
  );
  return db.query<XPEntry>('SELECT * FROM pr_xp_log WHERE id = ?', [id])[0];
}

export function getTotalXP(db: DatabaseAdapter): number {
  const result = db.query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM pr_xp_log', []);
  return result[0]?.total ?? 0;
}

export function getXPForDate(db: DatabaseAdapter, date: string): number {
  const result = db.query<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM pr_xp_log WHERE date = ?',
    [date],
  );
  return result[0]?.total ?? 0;
}

export function getXPLog(db: DatabaseAdapter, limit = 200): XPEntry[] {
  return db.query<XPEntry>('SELECT * FROM pr_xp_log ORDER BY created_at DESC LIMIT ?', [limit]);
}

// ── Settings CRUD ─��───────────────────────────────────────────────────────

export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string }>('SELECT value FROM pr_settings WHERE key = ?', [key]);
  return rows[0]?.value ?? null;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO pr_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value],
  );
}
