'use server';

import { revalidatePath } from 'next/cache';
import {
  METRICS_BY_SPORT,
  addScheduleEntry,
  clearOddsCache,
  computeBetStats,
  computeCoveredDates,
  countFollowedTeams,
  createFantasyLeague,
  createRecLeague,
  createMemorabilia,
  createVenue,
  deleteAttendance,
  deleteBet,
  deleteMemorabilia,
  deleteFantasyLeague,
  deleteRecLeague,
  deleteSession,
  deleteVenue,
  detectPersonalBest,
  ensureDefaultBankroll,
  fetchCurrentOdds,
  fetchFuturesOdds,
  fetchGameDetail,
  fetchGameTimeline,
  fetchHistorySlice,
  fetchLiveScores,
  fetchStandings,
  fetchStandingsForLeagues,
  fetchTeamSchedule,
  findTeamRecord,
  followTeam,
  getAttendance,
  getAttendanceStats,
  getBankroll,
  getBet,
  getBetLimits,
  getCollectionValue,
  getFantasyLeague,
  getMemorabilia,
  getPersonalBests,
  getRecLeague,
  getSession,
  getSetting,
  getTeamById,
  getUpcomingGames,
  getVenue,
  insertBet,
  listAttendance,
  listBetLegs,
  listBets,
  listByDateRange,
  listFantasyLeagues,
  listFantasyTransactions,
  listFollowedTeams,
  listGamesForTeams,
  listMemorabilia,
  listRecLeagues,
  listSessions,
  listVenues,
  logAttendance,
  logFantasyTransaction,
  logSession,
  markVisited,
  searchTeams,
  setBucketList,
  setBetLimits,
  setSetting,
  settleBet,
  settleBetLeg,
  setTeamRival,
  sumStakesSince,
  unfollowTeam,
  updateBetNotes,
  updateFantasyLeague,
  updateAttendance,
  updateMemorabilia,
  updateRecLeague,
  updateRecLeagueRecord,
  updateSession,
  updateTeamNotifications,
  updateTeamTier,
  updateVenue,
  upsertGames,
  type Attendance,
  type AttendanceStats,
  type Bankroll,
  type Bet,
  type BetInsertInput,
  type BetLeg,
  type BetLegInsertInput,
  type BetLimits,
  type BetLimitsPatch,
  type BetResult,
  type BetStats,
  type BetType,
  type CollectionValue,
  type CreateFantasyLeagueInput,
  type CreateMemorabiliaInput,
  type CreateRecLeagueInput,
  type CreateTeamInput,
  type CreateVenueInput,
  type DetectPersonalBestResult,
  type FantasyLeague,
  type FantasyTransaction,
  type FollowTier,
  type Game,
  type GameDetail,
  type GameStatus,
  type LeagueId,
  type ListAttendanceFilters,
  type ListBetsFilters,
  type ListFantasyLeaguesFilters,
  type ListMemorabiliaFilters,
  type ListVenuesFilters,
  type LogAttendanceInput,
  type Memorabilia,
  type LogFantasyTransactionInput,
  type LogSessionInput,
  type OddsMarket,
  type OddsSnapshot,
  type ParticipationSession,
  type RecLeague,
  type ScheduleEntry,
  type StandingGroup,
  type StandingRow,
  type Team,
  type TeamSearchResult,
  type TimelineEvent,
  type UpdateAttendanceInput,
  type UpdateFantasyLeagueInput,
  type UpdateMemorabiliaInput,
  type UpdateRecLeagueInput,
  type UpdateRecLeagueRecordInput,
  type UpdateSessionInput,
  type UpdateTeamNotificationsInput,
  type UpdateVenueInput,
  type Venue,
} from '@mylife/sports';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('sports');
  return adapter;
}

function revalidateSportsPaths(teamId?: string) {
  revalidatePath('/sports');
  revalidatePath('/sports/teams');
  if (teamId) {
    revalidatePath(`/sports/team/${encodeURIComponent(teamId)}`);
  }
}

export async function sportsGetTeams(): Promise<Team[]> {
  return listFollowedTeams(db());
}

export async function sportsGetTeam(id: string): Promise<Team | null> {
  return getTeamById(db(), id);
}

export async function sportsCountFollowed(): Promise<number> {
  return countFollowedTeams(db());
}

export async function sportsFollowTeam(input: CreateTeamInput): Promise<Team> {
  const team = followTeam(db(), input);
  revalidateSportsPaths(team.id);
  return team;
}

export async function sportsUnfollowTeam(id: string): Promise<void> {
  unfollowTeam(db(), id);
  revalidateSportsPaths(id);
}

export async function sportsUpdateTier(
  id: string,
  tier: FollowTier,
): Promise<void> {
  updateTeamTier(db(), id, tier);
  revalidateSportsPaths(id);
}

export async function sportsSetRival(
  id: string,
  isRival: boolean,
): Promise<void> {
  setTeamRival(db(), id, isRival);
  revalidateSportsPaths(id);
}

export async function sportsUpdateNotifications(
  id: string,
  input: UpdateTeamNotificationsInput,
): Promise<void> {
  updateTeamNotifications(db(), id, input);
  revalidateSportsPaths(id);
}

/**
 * Proxy the engine search through a server action. The UI passes the
 * query and optional league filter; abort cancellation happens at the
 * fetch layer inside the engine.
 */
export async function sportsSearchTeams(
  query: string,
  leagues?: LeagueId[],
): Promise<TeamSearchResult[]> {
  try {
    const results = await searchTeams({ query, leagues });
    return results.slice(0, 25);
  } catch (err) {
    console.error('[MySports] search failed', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// P1-B: scoreboard server actions
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function uniqueLeagues(teams: readonly Team[]): LeagueId[] {
  const seen = new Set<LeagueId>();
  for (const t of teams) {
    seen.add(t.league as LeagueId);
  }
  return Array.from(seen);
}

export interface SportsScoreboardData {
  followed: Team[];
  games: Game[];
}

/**
 * Read followed teams + their cached games for a +/- 1 day window. Does
 * NOT hit the network -- the client triggers `sportsRefreshScoreboard`
 * on mount and on visibilitychange to refresh.
 */
export async function sportsGetScoreboard(): Promise<SportsScoreboardData> {
  const adapter = db();
  const followed = listFollowedTeams(adapter);
  if (followed.length === 0) {
    return { followed, games: [] };
  }
  const now = Date.now();
  const games = listGamesForTeams(
    adapter,
    followed.map((t) => t.id),
    { since: now - DAY_MS, until: now + DAY_MS },
  );
  return { followed, games };
}

/**
 * Hit ESPN for fresh scores across the leagues of the user's followed
 * teams, upsert into sp_games, then return the refreshed scoreboard.
 *
 * Errors are swallowed so the client keeps the cached view on fetch failure.
 */
export async function sportsRefreshScoreboard(): Promise<SportsScoreboardData> {
  const adapter = db();
  const followed = listFollowedTeams(adapter);
  if (followed.length === 0) {
    return { followed, games: [] };
  }
  try {
    const leagues = uniqueLeagues(followed);
    const fresh = await fetchLiveScores({ leagues });
    upsertGames(adapter, fresh);
  } catch (err) {
    console.error('[MySports] scoreboard refresh failed', err);
  }
  const now = Date.now();
  const games = listGamesForTeams(
    adapter,
    followed.map((t) => t.id),
    { since: now - DAY_MS, until: now + DAY_MS },
  );
  revalidatePath('/sports');
  return { followed, games };
}

// ---------------------------------------------------------------------------
// P1-C: standings server actions
// ---------------------------------------------------------------------------

export async function sportsGetStandings(
  league: LeagueId,
): Promise<StandingGroup[]> {
  try {
    return await fetchStandings({ league });
  } catch (err) {
    console.error('[MySports] standings fetch failed', err);
    return [];
  }
}

export interface SportsMyRecord {
  teamId: string;
  teamName: string;
  league: string;
  row: StandingRow | null;
}

// ---------------------------------------------------------------------------
// P1-D: team schedule + combined schedule + game detail server actions
// ---------------------------------------------------------------------------

const SCHEDULE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fetch the full upcoming + recent schedule for a single followed team.
 * Uses the stored team row (sp_teams) to resolve league, fetches via ESPN,
 * and upserts the normalized games into sp_games so scoreboard + schedule
 * share the same cache.
 */
export async function sportsGetTeamSchedule(teamId: string): Promise<Game[]> {
  const adapter = db();
  const team = getTeamById(adapter, teamId);
  if (!team) return [];
  try {
    const games = await fetchTeamSchedule({
      teamId: team.id,
      league: team.league as LeagueId,
    });
    upsertGames(adapter, games);
    return games;
  } catch (err) {
    console.error('[MySports] team schedule fetch failed', err);
    return [];
  }
}

/**
 * Fetch the combined upcoming schedule across ALL followed teams for the
 * next ~30 days. Fans out across the unique set of followed team/league
 * pairs, upserts everything into sp_games, then returns a deduped +
 * sorted list.
 */
export async function sportsGetUpcoming(): Promise<Game[]> {
  const adapter = db();
  const followed = listFollowedTeams(adapter);
  if (followed.length === 0) return [];
  const results = await Promise.all(
    followed.map(async (team) => {
      try {
        return await fetchTeamSchedule({
          teamId: team.id,
          league: team.league as LeagueId,
        });
      } catch (err) {
        console.error('[MySports] team schedule fetch failed', team.id, err);
        return [] as Game[];
      }
    }),
  );
  const dedup = new Map<string, Game>();
  for (const games of results) {
    for (const g of games) {
      dedup.set(g.id, g);
    }
  }
  const merged = Array.from(dedup.values());
  upsertGames(adapter, merged);
  const now = Date.now();
  return merged
    .filter(
      (g) =>
        g.startAt >= now - SCHEDULE_WINDOW_MS &&
        g.startAt <= now + SCHEDULE_WINDOW_MS,
    )
    .sort((a, b) => a.startAt - b.startAt);
}

export async function sportsGetGameDetail(
  gameId: string,
  league: LeagueId,
): Promise<GameDetail | null> {
  try {
    return await fetchGameDetail({ gameId, league });
  } catch (err) {
    console.error('[MySports] game detail fetch failed', err);
    return null;
  }
}

/**
 * P2-B -- fetch the play-by-play timeline for a game. Status drives cache
 * TTL (live=10s, else 1hr). Returns [] on fetch failure or when ESPN
 * doesn't expose plays for this league/game.
 */
export async function sportsGetGameTimeline(
  gameId: string,
  league: LeagueId,
  status: GameStatus,
): Promise<TimelineEvent[]> {
  try {
    return await fetchGameTimeline({ gameId, league, status });
  } catch (err) {
    console.error('[MySports] game timeline fetch failed', err);
    return [];
  }
}

/**
 * P2-C -- fetch scores history for a configurable window. Reads local cache
 * via `listByDateRange`, computes covered dates, fans out per-day scoreboard
 * slices only for missing days (5-at-a-time), upserts, re-reads, and returns
 * games + followed teams. Swallows fetch failures so the UI keeps the cached
 * view.
 */
export interface SportsHistoryData {
  games: Game[];
  teams: Team[];
}

const HISTORY_MAX_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export async function sportsGetHistory(
  since: number,
  until: number,
  teamIds?: string[],
): Promise<SportsHistoryData> {
  const adapter = db();
  const followed = listFollowedTeams(adapter);
  if (followed.length === 0) return { games: [], teams: [] };

  const activeIds = teamIds && teamIds.length > 0
    ? followed
        .filter((t) =>
          teamIds.some(
            (tid) => t.id === tid || t.id.endsWith(`:${tid}`),
          ),
        )
        .map((t) => t.id)
    : followed.map((t) => t.id);
  if (activeIds.length === 0) return { games: [], teams: followed };

  // Bound window + clamp ordering.
  const lo = Math.min(since, until);
  const hi = Math.max(since, until);
  const bounded = {
    since: Math.max(lo, hi - HISTORY_MAX_WINDOW_MS),
    until: hi,
  };

  let cached: Game[] = [];
  try {
    cached = listByDateRange(adapter, activeIds, bounded);
  } catch (err) {
    console.error('[MySports] history cache read failed', err);
  }
  try {
    const covered = computeCoveredDates(cached, activeIds);
    const leagues = uniqueLeagues(followed);
    const fresh = await fetchHistorySlice({
      teamIds: activeIds,
      leagues,
      since: bounded.since,
      until: bounded.until,
      coveredDates: covered,
    });
    if (fresh.length > 0) upsertGames(adapter, fresh);
  } catch (err) {
    console.error('[MySports] history fetch failed', err);
  }
  let merged = cached;
  try {
    merged = listByDateRange(adapter, activeIds, bounded);
  } catch (err) {
    console.error('[MySports] history cache re-read failed', err);
  }
  return { games: merged, teams: followed };
}

/**
 * Return one record per followed team, fanning out standings across the
 * unique set of leagues the followed teams span. Missing standings yield a
 * null row so the UI can fall back to a dash.
 */
export async function sportsGetMyRecords(): Promise<SportsMyRecord[]> {
  const adapter = db();
  const followed = listFollowedTeams(adapter);
  if (followed.length === 0) return [];
  try {
    const leagues = Array.from(
      new Set(followed.map((t) => t.league as LeagueId)),
    );
    const byLeague = await fetchStandingsForLeagues({ leagues });
    return followed.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      league: team.league,
      row: findTeamRecord(byLeague[team.league] ?? [], team.id),
    }));
  } catch (err) {
    console.error('[MySports] my-records fetch failed', err);
    return followed.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      league: team.league,
      row: null,
    }));
  }
}

// ---------------------------------------------------------------------------
// P3-C: betting dashboard + CRUD + responsible-gambling limits
// ---------------------------------------------------------------------------

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LIMIT_CENTS = 1_000_000;

function revalidateBettingPaths(betId?: string) {
  revalidatePath('/sports');
  revalidatePath('/sports/betting');
  revalidatePath('/sports/betting/log');
  revalidatePath('/sports/betting/parlay');
  revalidatePath('/sports/betting/history');
  revalidatePath('/sports/betting/analytics');
  if (betId) revalidatePath(`/sports/bet/${encodeURIComponent(betId)}`);
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface SportsBettingDashboardData {
  bankroll: Bankroll;
  pending: Bet[];
  recent: Bet[];
  stats: BetStats;
  limits: BetLimits;
  dailySpentCents: number;
  weeklySpentCents: number;
}

/**
 * One-shot dashboard read. Pending bets (result='pending', last 20) plus
 * the 10 most-recent settled bets plus aggregate stats across everything
 * we've ever logged. Also surfaces today + this-week spend for the
 * responsible-gambling banners.
 */
export async function sportsGetBettingDashboard(): Promise<SportsBettingDashboardData> {
  const adapter = db();
  const bankroll = ensureDefaultBankroll(adapter);
  const limits = getBetLimits(adapter);
  const pending = listBets(adapter, { result: 'pending', limit: 20 });
  // For "recent" we want settled only -- cheapest way is to list + filter in memory
  // since the typical volume per user is tiny (hundreds of rows).
  const recentAll = listBets(adapter, { limit: 30 });
  const recent = recentAll.filter((b) => b.result !== 'pending').slice(0, 10);
  const all = listBets(adapter, { limit: 500 });
  const stats = computeBetStats(all);
  const dailySpentCents = sumStakesSince(adapter, startOfTodayMs());
  const weeklySpentCents = sumStakesSince(adapter, Date.now() - WEEK_MS);
  return {
    bankroll,
    pending,
    recent,
    stats,
    limits,
    dailySpentCents,
    weeklySpentCents,
  };
}

export async function sportsCreateBet(
  input: BetInsertInput,
  legs?: BetLegInsertInput[],
): Promise<Bet> {
  const bet = insertBet(db(), input, legs ?? []);
  revalidateBettingPaths(bet.id);
  return bet;
}

export async function sportsSettleBet(
  id: string,
  result: BetResult,
): Promise<Bet> {
  const bet = settleBet(db(), id, result);
  revalidateBettingPaths(id);
  return bet;
}

export async function sportsSettleBetLeg(
  legId: string,
  result: BetResult,
): Promise<{ leg: BetLeg; parent: Bet | null }> {
  const adapter = db();
  const leg = settleBetLeg(adapter, legId, result);
  const parent = getBet(adapter, leg.bet_id);
  revalidateBettingPaths(leg.bet_id);
  return { leg, parent };
}

export async function sportsDeleteBet(id: string): Promise<void> {
  deleteBet(db(), id);
  revalidateBettingPaths(id);
}

export async function sportsUpdateBetNotes(
  id: string,
  notes: string | null,
): Promise<void> {
  updateBetNotes(db(), id, notes);
  revalidateBettingPaths(id);
}

export async function sportsGetBet(
  id: string,
): Promise<{ bet: Bet; legs: BetLeg[] } | null> {
  const adapter = db();
  const bet = getBet(adapter, id);
  if (!bet) return null;
  const legs = listBetLegs(adapter, id);
  return { bet, legs };
}

export async function sportsListBets(
  filters: ListBetsFilters = {},
): Promise<Bet[]> {
  return listBets(db(), filters);
}

export async function sportsGetBettingLimits(): Promise<BetLimits> {
  return getBetLimits(db());
}

export async function sportsSetBettingLimits(
  patch: BetLimitsPatch,
): Promise<BetLimits> {
  // Sanity-cap daily/weekly to avoid accidental giant-limit typos.
  const sanitized: BetLimitsPatch = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'daily_cents')) {
    sanitized.daily_cents =
      patch.daily_cents === null || patch.daily_cents === undefined
        ? patch.daily_cents ?? null
        : Math.min(Math.max(0, Math.round(patch.daily_cents)), MAX_LIMIT_CENTS);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'weekly_cents')) {
    sanitized.weekly_cents =
      patch.weekly_cents === null || patch.weekly_cents === undefined
        ? patch.weekly_cents ?? null
        : Math.min(Math.max(0, Math.round(patch.weekly_cents)), MAX_LIMIT_CENTS);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'cooldown_until')) {
    sanitized.cooldown_until = patch.cooldown_until ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'unit_size_cents')) {
    sanitized.unit_size_cents = patch.unit_size_cents;
  }
  setBetLimits(db(), sanitized);
  revalidateBettingPaths();
  return getBetLimits(db());
}

export interface SportsBetAllowance {
  allowed: boolean;
  reason?: 'cooldown' | 'daily' | 'weekly';
  spentCents: number;
  limitCents: number | null;
}

/**
 * Check whether a proposed stake would trip a responsible-gambling guard.
 * `cooldown` is a hard block (UI hides log CTAs + blocks save). `daily`
 * and `weekly` are soft-blocks -- UI surfaces an "override" confirm sheet
 * and the user can still save if they choose.
 */
export async function sportsCheckBetAllowance(
  proposedStakeCents: number,
): Promise<SportsBetAllowance> {
  const adapter = db();
  const limits = getBetLimits(adapter);
  const now = Date.now();
  if (limits.cooldown_until !== null && limits.cooldown_until > now) {
    return {
      allowed: false,
      reason: 'cooldown',
      spentCents: 0,
      limitCents: null,
    };
  }
  const dailySpent = sumStakesSince(adapter, startOfTodayMs());
  if (
    limits.daily_cents !== null &&
    dailySpent + proposedStakeCents > limits.daily_cents
  ) {
    return {
      allowed: false,
      reason: 'daily',
      spentCents: dailySpent,
      limitCents: limits.daily_cents,
    };
  }
  const weeklySpent = sumStakesSince(adapter, now - WEEK_MS);
  if (
    limits.weekly_cents !== null &&
    weeklySpent + proposedStakeCents > limits.weekly_cents
  ) {
    return {
      allowed: false,
      reason: 'weekly',
      spentCents: weeklySpent,
      limitCents: limits.weekly_cents,
    };
  }
  return {
    allowed: true,
    spentCents: dailySpent,
    limitCents: limits.daily_cents,
  };
}

export async function sportsGetBankroll(): Promise<Bankroll> {
  const adapter = db();
  return getBankroll(adapter, 'default') ?? ensureDefaultBankroll(adapter);
}

// ---------------------------------------------------------------------------
// P3-D: Odds API key + futures/props current odds
// ---------------------------------------------------------------------------

const ODDS_API_KEY_SETTING = 'odds_api_key';

export async function sportsGetOddsApiKeyStatus(): Promise<{
  hasKey: boolean;
}> {
  try {
    const value = getSetting(db(), ODDS_API_KEY_SETTING);
    return { hasKey: value !== null && value !== '' };
  } catch {
    return { hasKey: false };
  }
}

export async function sportsSetOddsApiKey(key: string | null): Promise<void> {
  const trimmed = key === null ? null : key.trim();
  setSetting(db(), ODDS_API_KEY_SETTING, trimmed === '' ? null : trimmed);
  clearOddsCache();
  revalidatePath('/sports/betting');
  revalidatePath('/sports/betting/futures');
  revalidatePath('/sports/betting/props');
  revalidatePath('/sports/settings');
}

/**
 * Pre-fetch current outrights for the futures page. Returns `null` on any
 * degraded condition (missing key, non-2xx, malformed, timeout). The UI
 * handles `null` by rendering taken-only rows + a muted footer.
 *
 * Bounds fetch latency with an 8s AbortController so a slow Odds API
 * response never blocks the page render.
 */
export async function sportsFetchCurrentOddsForFutures(
  league: LeagueId,
): Promise<OddsSnapshot[] | null> {
  let apiKey: string | null = null;
  try {
    apiKey = getSetting(db(), ODDS_API_KEY_SETTING);
  } catch {
    apiKey = null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetchFuturesOdds({
      league,
      apiKey,
      signal: controller.signal,
    });
  } catch (err) {
    console.error('[MySports] futures odds fetch failed', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sportsFetchCurrentOdds(
  league: LeagueId,
  market: Exclude<OddsMarket, 'outrights'>,
): Promise<OddsSnapshot[] | null> {
  let apiKey: string | null = null;
  try {
    apiKey = getSetting(db(), ODDS_API_KEY_SETTING);
  } catch {
    apiKey = null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetchCurrentOdds({
      league,
      market,
      apiKey,
      signal: controller.signal,
    });
  } catch (err) {
    console.error('[MySports] current odds fetch failed', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface SportsFuturesData {
  pending: Bet[];
  settled: Bet[];
  currentOddsByLeague: Record<string, OddsSnapshot[] | null>;
  hasKey: boolean;
}

function normalizeLeagueId(raw: string): LeagueId | null {
  const lo = raw.toLowerCase();
  if (
    lo === 'nfl' ||
    lo === 'nba' ||
    lo === 'mlb' ||
    lo === 'nhl' ||
    lo === 'mls'
  )
    return lo;
  return null;
}

export async function sportsGetFutures(): Promise<SportsFuturesData> {
  const adapter = db();
  const all = listBets(adapter, { bet_type: 'future', limit: 200 });
  const pending = all.filter((b) => b.result === 'pending');
  const settled = all.filter((b) => b.result !== 'pending');
  const { hasKey } = await sportsGetOddsApiKeyStatus();
  const leagues = new Set<LeagueId>();
  for (const b of pending) {
    const lid = normalizeLeagueId(b.league);
    if (lid) leagues.add(lid);
  }
  const results = await Promise.all(
    Array.from(leagues).map(async (lid) => {
      const snaps = await sportsFetchCurrentOddsForFutures(lid);
      return [lid, snaps] as const;
    }),
  );
  const currentOddsByLeague: Record<string, OddsSnapshot[] | null> = {};
  for (const [lid, snaps] of results) currentOddsByLeague[lid] = snaps;
  return { pending, settled, currentOddsByLeague, hasKey };
}

export interface SportsPropsData {
  groups: Array<{ gameId: string | null; items: Bet[] }>;
}

export async function sportsGetProps(): Promise<SportsPropsData> {
  const adapter = db();
  const all = listBets(adapter, { bet_type: 'prop', limit: 200 });
  const buckets = new Map<string | null, Bet[]>();
  for (const b of all) {
    const key = b.game_id;
    const list = buckets.get(key) ?? [];
    list.push(b);
    buckets.set(key, list);
  }
  const groups = Array.from(buckets.entries())
    .map(([gameId, items]) => ({
      gameId,
      items: items.sort((a, b) => b.placed_at - a.placed_at),
    }))
    .sort((a, b) => b.items[0].placed_at - a.items[0].placed_at);
  return { groups };
}

// ---------------------------------------------------------------------------
// P4-B: fantasy leagues MVP
// ---------------------------------------------------------------------------

function revalidateFantasyPaths(leagueId?: string) {
  revalidatePath('/sports/fantasy');
  if (leagueId) {
    revalidatePath(`/sports/fantasy/${encodeURIComponent(leagueId)}`);
  }
}

export async function sportsListFantasyLeagues(
  filters: ListFantasyLeaguesFilters = {},
): Promise<FantasyLeague[]> {
  return listFantasyLeagues(db(), filters);
}

export interface SportsFantasyLeagueDetail {
  league: FantasyLeague;
  transactions: FantasyTransaction[];
}

export async function sportsGetFantasyLeague(
  id: string,
): Promise<SportsFantasyLeagueDetail | null> {
  const adapter = db();
  const league = getFantasyLeague(adapter, id);
  if (!league) return null;
  const transactions = listFantasyTransactions(adapter, id).slice(0, 10);
  return { league, transactions };
}

export async function sportsCreateFantasyLeague(
  input: CreateFantasyLeagueInput,
): Promise<FantasyLeague> {
  const league = createFantasyLeague(db(), input);
  revalidateFantasyPaths(league.id);
  return league;
}

export async function sportsUpdateFantasyLeague(
  id: string,
  patch: UpdateFantasyLeagueInput,
): Promise<FantasyLeague | null> {
  const league = updateFantasyLeague(db(), id, patch);
  revalidateFantasyPaths(id);
  return league;
}

export async function sportsDeleteFantasyLeague(
  id: string,
): Promise<{ ok: true }> {
  deleteFantasyLeague(db(), id);
  revalidateFantasyPaths();
  return { ok: true };
}

export async function sportsLogFantasyTransaction(
  input: LogFantasyTransactionInput,
): Promise<FantasyTransaction> {
  const tx = logFantasyTransaction(db(), input);
  revalidateFantasyPaths(input.league_id);
  return tx;
}

// ---------------------------------------------------------------------------
// P5-B: personal play sessions (list + log + detail)
// ---------------------------------------------------------------------------

function revalidatePlayPaths(sessionId?: string) {
  revalidatePath('/sports/play');
  revalidatePath('/sports/play/log');
  if (sessionId) {
    revalidatePath(`/sports/play/${encodeURIComponent(sessionId)}`);
  }
}

export interface SportsPersonalBestEntry {
  sport: string;
  count: number;
  latest: ParticipationSession;
}

export async function sportsListRecentSessions(
  limit = 20,
): Promise<
  | { ok: true; sessions: ParticipationSession[] }
  | { ok: false; error: string }
> {
  try {
    const sessions = listSessions(db(), { limit });
    return { ok: true, sessions };
  } catch (err) {
    console.error('[MySports] list recent sessions failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to list sessions',
    };
  }
}

export async function sportsGetPersonalBestsAcrossSports(): Promise<
  | { ok: true; entries: SportsPersonalBestEntry[] }
  | { ok: false; error: string }
> {
  try {
    const adapter = db();
    // Pull a wide window of recent sessions and derive distinct sports
    // locally. Cheap at personal-journal volumes (hundreds of rows max).
    const recent = listSessions(adapter, { limit: 500 });
    const sports = Array.from(new Set(recent.map((s) => s.sport)));
    const entries: SportsPersonalBestEntry[] = [];
    for (const sport of sports) {
      const pbs = getPersonalBests(adapter, sport);
      if (pbs.length === 0) continue;
      entries.push({ sport, count: pbs.length, latest: pbs[0] });
    }
    entries.sort((a, b) => b.latest.started_at - a.latest.started_at);
    return { ok: true, entries };
  } catch (err) {
    console.error('[MySports] get PBs across sports failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to load PBs',
    };
  }
}

export async function sportsGetSession(
  id: string,
): Promise<
  | {
      ok: true;
      session: ParticipationSession;
      siblings: ParticipationSession[];
      pb: DetectPersonalBestResult;
    }
  | { ok: false; error: string }
> {
  try {
    const adapter = db();
    const session = getSession(adapter, id);
    if (!session) {
      return { ok: false, error: 'Session not found' };
    }
    const allForSport = listSessions(adapter, { sport: session.sport });
    const siblings = allForSport.filter((s) => s.id !== session.id);
    const pb = detectPersonalBest(
      session,
      siblings,
      METRICS_BY_SPORT[session.sport] ?? [],
    );
    return { ok: true, session, siblings, pb };
  } catch (err) {
    console.error('[MySports] get session failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to load session',
    };
  }
}

export async function sportsLogSession(
  input: LogSessionInput,
): Promise<
  | { ok: true; id: string; pb: DetectPersonalBestResult }
  | { ok: false; error: string }
> {
  try {
    const adapter = db();
    const prior = listSessions(adapter, { sport: input.sport });
    const stats = input.stats ?? {};
    // Draft the session shape detectPersonalBest expects (stats + sport).
    const draft: ParticipationSession = {
      id: 'draft',
      sport: input.sport,
      activity: input.activity,
      started_at: input.started_at ?? Date.now(),
      duration_minutes: input.duration_minutes ?? null,
      location: input.location ?? null,
      teammates: input.teammates ? [...input.teammates] : [],
      stats: { ...stats },
      personal_best: false,
      mood_before: input.mood_before ?? null,
      mood_after: input.mood_after ?? null,
      injury_notes: input.injury_notes ?? null,
      notes_md: input.notes_md ?? null,
      photo_ids: input.photo_ids ? [...input.photo_ids] : [],
      created_at: Date.now(),
    };
    const pb = detectPersonalBest(
      draft,
      prior,
      METRICS_BY_SPORT[input.sport] ?? [],
    );
    const saved = logSession(adapter, input);
    revalidatePlayPaths(saved.id);
    return { ok: true, id: saved.id, pb };
  } catch (err) {
    console.error('[MySports] log session failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to log session',
    };
  }
}

export async function sportsUpdateSession(
  id: string,
  patch: UpdateSessionInput,
): Promise<
  | { ok: true; session: ParticipationSession }
  | { ok: false; error: string }
> {
  try {
    const updated = updateSession(db(), id, patch);
    if (!updated) {
      return { ok: false, error: 'Session not found' };
    }
    revalidatePlayPaths(id);
    return { ok: true, session: updated };
  } catch (err) {
    console.error('[MySports] update session failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update session',
    };
  }
}

export async function sportsDeleteSession(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const removed = deleteSession(db(), id);
    if (!removed) {
      return { ok: false, error: 'Session not found' };
    }
    revalidatePath('/sports/play');
    return { ok: true };
  } catch (err) {
    console.error('[MySports] delete session failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to delete session',
    };
  }
}

// ---------------------------------------------------------------------------
// P5-C: rec leagues (list + add + detail with schedule + record)
// ---------------------------------------------------------------------------

function revalidateLeaguePaths(leagueId?: string) {
  revalidatePath('/sports/play');
  revalidatePath('/sports/play/leagues');
  if (leagueId) {
    revalidatePath(`/sports/play/leagues/${encodeURIComponent(leagueId)}`);
  }
}

export interface SportsUpcomingRecGame {
  league: RecLeague;
  entry: ScheduleEntry;
}

export async function sportsListRecLeagues(): Promise<
  { ok: true; leagues: RecLeague[] } | { ok: false; error: string }
> {
  try {
    const leagues = listRecLeagues(db());
    return { ok: true, leagues };
  } catch (err) {
    console.error('[MySports] list rec leagues failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to list rec leagues',
    };
  }
}

export async function sportsGetRecLeague(
  id: string,
): Promise<
  { ok: true; league: RecLeague } | { ok: false; error: string }
> {
  try {
    const league = getRecLeague(db(), id);
    if (!league) return { ok: false, error: 'League not found' };
    return { ok: true, league };
  } catch (err) {
    console.error('[MySports] get rec league failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to load league',
    };
  }
}

export async function sportsCreateRecLeague(
  input: CreateRecLeagueInput,
): Promise<
  { ok: true; league: RecLeague } | { ok: false; error: string }
> {
  try {
    const league = createRecLeague(db(), input);
    revalidateLeaguePaths(league.id);
    return { ok: true, league };
  } catch (err) {
    console.error('[MySports] create rec league failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to create league',
    };
  }
}

export async function sportsUpdateRecLeagueRecord(
  id: string,
  patch: Partial<UpdateRecLeagueRecordInput>,
): Promise<
  { ok: true; league: RecLeague } | { ok: false; error: string }
> {
  try {
    const existing = getRecLeague(db(), id);
    if (!existing) return { ok: false, error: 'League not found' };
    const next = updateRecLeagueRecord(db(), id, {
      wins: patch.wins ?? existing.record_wins,
      losses: patch.losses ?? existing.record_losses,
      ties: patch.ties ?? existing.record_ties,
    });
    if (!next) return { ok: false, error: 'League not found' };
    revalidateLeaguePaths(id);
    return { ok: true, league: next };
  } catch (err) {
    console.error('[MySports] update rec league record failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update record',
    };
  }
}

export async function sportsAddScheduleEntry(
  leagueId: string,
  entry: ScheduleEntry,
): Promise<
  { ok: true; league: RecLeague } | { ok: false; error: string }
> {
  try {
    const next = addScheduleEntry(db(), leagueId, entry);
    if (!next) return { ok: false, error: 'League not found' };
    revalidateLeaguePaths(leagueId);
    return { ok: true, league: next };
  } catch (err) {
    console.error('[MySports] add schedule entry failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to add game',
    };
  }
}

export async function sportsUpdateRecLeague(
  id: string,
  patch: UpdateRecLeagueInput,
): Promise<
  { ok: true; league: RecLeague } | { ok: false; error: string }
> {
  try {
    const next = updateRecLeague(db(), id, patch);
    if (!next) return { ok: false, error: 'League not found' };
    revalidateLeaguePaths(id);
    return { ok: true, league: next };
  } catch (err) {
    console.error('[MySports] update rec league failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update league',
    };
  }
}

export async function sportsDeleteRecLeague(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const removed = deleteRecLeague(db(), id);
    if (!removed) return { ok: false, error: 'League not found' };
    revalidatePath('/sports/play/leagues');
    revalidatePath('/sports/play');
    return { ok: true };
  } catch (err) {
    console.error('[MySports] delete rec league failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to delete league',
    };
  }
}

export async function sportsGetUpcomingRecGames(
  sinceMs: number,
  limit = 5,
): Promise<
  { ok: true; games: SportsUpcomingRecGame[] } | { ok: false; error: string }
> {
  try {
    const adapter = db();
    const leagues = listRecLeagues(adapter);
    const games: SportsUpcomingRecGame[] = [];
    for (const league of leagues) {
      const entries = getUpcomingGames(adapter, league.id, sinceMs);
      for (const entry of entries) {
        games.push({ league, entry });
      }
    }
    games.sort((a, b) => a.entry.starts_at - b.entry.starts_at);
    return { ok: true, games: games.slice(0, Math.max(1, limit)) };
  } catch (err) {
    console.error('[MySports] get upcoming rec games failed', err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Failed to load upcoming games',
    };
  }
}

// ---------------------------------------------------------------------------
// P6-B: attendance + venues (list + log + detail, bucket-list toggle)
// ---------------------------------------------------------------------------

function revalidateEventsPaths(attendanceId?: string) {
  revalidatePath('/sports/events');
  if (attendanceId) {
    revalidatePath(`/sports/events/${encodeURIComponent(attendanceId)}`);
  }
}

function revalidateVenuesPaths(venueId?: string) {
  revalidatePath('/sports/events');
  revalidatePath('/sports/events/venues');
  if (venueId) {
    revalidatePath(`/sports/events/venues/${encodeURIComponent(venueId)}`);
  }
}

export async function sportsListAttendance(
  filters: ListAttendanceFilters = {},
): Promise<
  { ok: true; rows: Attendance[] } | { ok: false; error: string }
> {
  try {
    const rows = listAttendance(db(), filters);
    return { ok: true, rows };
  } catch (err) {
    console.error('[MySports] list attendance failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to list attendance',
    };
  }
}

export async function sportsGetAttendance(
  id: string,
): Promise<
  { ok: true; row: Attendance } | { ok: false; error: string }
> {
  try {
    const row = getAttendance(db(), id);
    if (!row) return { ok: false, error: 'Attendance not found' };
    return { ok: true, row };
  } catch (err) {
    console.error('[MySports] get attendance failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to load attendance',
    };
  }
}

export async function sportsLogAttendance(
  input: LogAttendanceInput,
): Promise<
  { ok: true; row: Attendance } | { ok: false; error: string }
> {
  try {
    const row = logAttendance(db(), input);
    revalidateEventsPaths(row.id);
    return { ok: true, row };
  } catch (err) {
    console.error('[MySports] log attendance failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to log attendance',
    };
  }
}

export async function sportsUpdateAttendance(
  id: string,
  patch: UpdateAttendanceInput,
): Promise<
  { ok: true; row: Attendance } | { ok: false; error: string }
> {
  try {
    const row = updateAttendance(db(), id, patch);
    if (!row) return { ok: false, error: 'Attendance not found' };
    revalidateEventsPaths(id);
    return { ok: true, row };
  } catch (err) {
    console.error('[MySports] update attendance failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update attendance',
    };
  }
}

export async function sportsDeleteAttendance(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const removed = deleteAttendance(db(), id);
    if (!removed) return { ok: false, error: 'Attendance not found' };
    revalidatePath('/sports/events');
    return { ok: true };
  } catch (err) {
    console.error('[MySports] delete attendance failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to delete attendance',
    };
  }
}

export async function sportsGetAttendanceStats(
  filters: { year?: number } = {},
): Promise<
  { ok: true; stats: AttendanceStats } | { ok: false; error: string }
> {
  try {
    const stats = getAttendanceStats(db(), filters);
    return { ok: true, stats };
  } catch (err) {
    console.error('[MySports] get attendance stats failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to load stats',
    };
  }
}

export async function sportsListVenues(
  filters: ListVenuesFilters = {},
): Promise<
  { ok: true; venues: Venue[] } | { ok: false; error: string }
> {
  try {
    const venues = listVenues(db(), filters);
    return { ok: true, venues };
  } catch (err) {
    console.error('[MySports] list venues failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to list venues',
    };
  }
}

export async function sportsGetVenue(
  id: string,
): Promise<{ ok: true; venue: Venue } | { ok: false; error: string }> {
  try {
    const venue = getVenue(db(), id);
    if (!venue) return { ok: false, error: 'Venue not found' };
    return { ok: true, venue };
  } catch (err) {
    console.error('[MySports] get venue failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to load venue',
    };
  }
}

export async function sportsCreateVenue(
  input: CreateVenueInput,
): Promise<{ ok: true; venue: Venue } | { ok: false; error: string }> {
  try {
    const venue = createVenue(db(), input);
    revalidateVenuesPaths(venue.id);
    return { ok: true, venue };
  } catch (err) {
    console.error('[MySports] create venue failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to create venue',
    };
  }
}

export async function sportsUpdateVenue(
  id: string,
  patch: UpdateVenueInput,
): Promise<{ ok: true; venue: Venue } | { ok: false; error: string }> {
  try {
    const venue = updateVenue(db(), id, patch);
    if (!venue) return { ok: false, error: 'Venue not found' };
    revalidateVenuesPaths(id);
    return { ok: true, venue };
  } catch (err) {
    console.error('[MySports] update venue failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update venue',
    };
  }
}

export async function sportsMarkVenueVisited(
  id: string,
  attendedAtMs: number,
): Promise<{ ok: true; venue: Venue } | { ok: false; error: string }> {
  try {
    const venue = markVisited(db(), id, attendedAtMs);
    if (!venue) return { ok: false, error: 'Venue not found' };
    revalidateVenuesPaths(id);
    return { ok: true, venue };
  } catch (err) {
    console.error('[MySports] mark venue visited failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to mark visited',
    };
  }
}

export async function sportsSetVenueBucketList(
  id: string,
  bucket: boolean,
): Promise<{ ok: true; venue: Venue } | { ok: false; error: string }> {
  try {
    const venue = setBucketList(db(), id, bucket);
    if (!venue) return { ok: false, error: 'Venue not found' };
    revalidateVenuesPaths(id);
    return { ok: true, venue };
  } catch (err) {
    console.error('[MySports] set venue bucket list failed', err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Failed to toggle bucket list',
    };
  }
}

export async function sportsDeleteVenue(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const removed = deleteVenue(db(), id);
    if (!removed) return { ok: false, error: 'Venue not found' };
    revalidatePath('/sports/events/venues');
    revalidatePath('/sports/events');
    return { ok: true };
  } catch (err) {
    console.error('[MySports] delete venue failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to delete venue',
    };
  }
}

// ---------------------------------------------------------------------------
// P6-C: memorabilia + watch-party attendance variant
// ---------------------------------------------------------------------------

function revalidateMemorabiliaPaths(memorabiliaId?: string) {
  revalidatePath('/sports/events');
  revalidatePath('/sports/events/memorabilia');
  if (memorabiliaId) {
    revalidatePath(
      `/sports/events/memorabilia/${encodeURIComponent(memorabiliaId)}`,
    );
  }
}

export async function sportsListMemorabilia(
  filters: ListMemorabiliaFilters = {},
): Promise<
  { ok: true; rows: Memorabilia[] } | { ok: false; error: string }
> {
  try {
    const rows = listMemorabilia(db(), filters);
    return { ok: true, rows };
  } catch (err) {
    console.error('[MySports] list memorabilia failed', err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Failed to list memorabilia',
    };
  }
}

export async function sportsGetMemorabilia(
  id: string,
): Promise<{ ok: true; row: Memorabilia } | { ok: false; error: string }> {
  try {
    const row = getMemorabilia(db(), id);
    if (!row) return { ok: false, error: 'Memorabilia not found' };
    return { ok: true, row };
  } catch (err) {
    console.error('[MySports] get memorabilia failed', err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Failed to load memorabilia',
    };
  }
}

export async function sportsCreateMemorabilia(
  input: CreateMemorabiliaInput,
): Promise<{ ok: true; row: Memorabilia } | { ok: false; error: string }> {
  try {
    const row = createMemorabilia(db(), input);
    revalidateMemorabiliaPaths(row.id);
    return { ok: true, row };
  } catch (err) {
    console.error('[MySports] create memorabilia failed', err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Failed to create memorabilia',
    };
  }
}

export async function sportsUpdateMemorabilia(
  id: string,
  patch: UpdateMemorabiliaInput,
): Promise<{ ok: true; row: Memorabilia } | { ok: false; error: string }> {
  try {
    const row = updateMemorabilia(db(), id, patch);
    if (!row) return { ok: false, error: 'Memorabilia not found' };
    revalidateMemorabiliaPaths(id);
    return { ok: true, row };
  } catch (err) {
    console.error('[MySports] update memorabilia failed', err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Failed to update memorabilia',
    };
  }
}

export async function sportsDeleteMemorabilia(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const removed = deleteMemorabilia(db(), id);
    if (!removed) return { ok: false, error: 'Memorabilia not found' };
    revalidateMemorabiliaPaths();
    return { ok: true };
  } catch (err) {
    console.error('[MySports] delete memorabilia failed', err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Failed to delete memorabilia',
    };
  }
}

export async function sportsGetCollectionValue(): Promise<
  { ok: true; value: CollectionValue } | { ok: false; error: string }
> {
  try {
    const value = getCollectionValue(db());
    return { ok: true, value };
  } catch (err) {
    console.error('[MySports] get collection value failed', err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Failed to load collection value',
    };
  }
}

/**
 * Watch parties are a lightweight variant of attendance with no seat info
 * (section + row_label + seat all null). Wraps sportsListAttendance and
 * filters server-side.
 */
export async function sportsListWatchParties(
  filters: { limit?: number; sinceMs?: number } = {},
): Promise<
  { ok: true; rows: Attendance[] } | { ok: false; error: string }
> {
  try {
    const all = listAttendance(db(), {
      // Fetch a wider window since we're filtering in memory.
      limit: filters.limit !== undefined ? filters.limit * 4 : 400,
      sinceMs: filters.sinceMs,
    });
    const rows = all.filter(
      (r) => r.section === null && r.row_label === null && r.seat === null,
    );
    return {
      ok: true,
      rows: filters.limit !== undefined ? rows.slice(0, filters.limit) : rows,
    };
  } catch (err) {
    console.error('[MySports] list watch parties failed', err);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Failed to list watch parties',
    };
  }
}
