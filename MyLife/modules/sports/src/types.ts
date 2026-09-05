import { z } from 'zod';

/**
 * Release status placeholder for MySports.
 *
 * Kept from P0-A so the module has a stable high-level status export.
 */
export const SportsModuleStatusSchema = z.object({
  releaseState: z.literal('hidden'),
  accentColor: z.literal('#16A34A'),
});

export type SportsModuleStatus = z.infer<typeof SportsModuleStatusSchema>;

export const DEFAULT_SPORTS_MODULE_STATUS: SportsModuleStatus = {
  releaseState: 'hidden',
  accentColor: '#16A34A',
};

// ── V1 domain schemas ──────────────────────────────────────────────

/** Follow tier for a team -- how closely the user tracks it. */
export const FollowTierSchema = z.enum(['diehard', 'casual', 'occasional']);
export type FollowTier = z.infer<typeof FollowTierSchema>;

/**
 * SQLite boolean stored as INTEGER (0 or 1). Using z.union of literals
 * matches how other modules (surf, friends, sleep) represent 0/1 booleans
 * at the row level without a transform.
 */
export const SqliteBoolSchema = z.union([z.literal(0), z.literal(1)]);
export type SqliteBool = z.infer<typeof SqliteBoolSchema>;

/** Row shape for sp_teams. */
export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  league: z.string().min(1),
  sport: z.string().min(1),
  conference: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  primary_color: z.string().nullable().optional(),
  secondary_color: z.string().nullable().optional(),
  follow_tier: FollowTierSchema,
  notify_start: SqliteBoolSchema,
  notify_end: SqliteBoolSchema,
  notify_close: SqliteBoolSchema,
  notify_trades: SqliteBoolSchema,
  is_rival: SqliteBoolSchema,
  notes_md: z.string().nullable().optional(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});
export type Team = z.infer<typeof TeamSchema>;

/** Input accepted by `createTeam` (P1-A). No timestamps; defaults applied by CRUD. */
export const CreateTeamInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  league: z.string().min(1),
  sport: z.string().min(1),
  conference: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  primary_color: z.string().nullable().optional(),
  secondary_color: z.string().nullable().optional(),
  follow_tier: FollowTierSchema.optional(),
  notify_start: SqliteBoolSchema.optional(),
  notify_end: SqliteBoolSchema.optional(),
  notify_close: SqliteBoolSchema.optional(),
  notify_trades: SqliteBoolSchema.optional(),
  is_rival: SqliteBoolSchema.optional(),
  notes_md: z.string().nullable().optional(),
});
export type CreateTeamInput = z.infer<typeof CreateTeamInputSchema>;

/** Row shape for sp_settings. Simple key-value store. */
export const SettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().nullable(),
  updated_at: z.number().int().nonnegative(),
});
export type Setting = z.infer<typeof SettingSchema>;

// ── P1-A league + search domain ────────────────────────────────────

/**
 * Supported launch league IDs. Narrowed for P1-A to the five leagues
 * where we can ship team following with confidence. Additional leagues
 * ride along in later phases.
 */
export const LeagueIdSchema = z.enum(['nfl', 'nba', 'mlb', 'nhl', 'mls']);
export type LeagueId = z.infer<typeof LeagueIdSchema>;

/**
 * Static metadata for a launch league. Used by the engine to build
 * ESPN endpoint URLs and by the UI for filter chips.
 */
export const LeagueSchema = z.object({
  id: LeagueIdSchema,
  label: z.string().min(1),
  sport: z.string().min(1),
  /** ESPN sport slug, e.g. `football`, `basketball`, `baseball`, `hockey`, `soccer`. */
  espnSport: z.string().min(1),
  /** ESPN league slug, e.g. `nfl`, `nba`, `mlb`, `nhl`, `usa.1`. */
  espnLeague: z.string().min(1),
});
export type League = z.infer<typeof LeagueSchema>;

/**
 * Shape of a single team returned by the search engine. The `id` is
 * the stable `espn:{league}:{externalId}` compound so follow/unfollow
 * is idempotent across sessions.
 */
export const TeamSearchResultSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  abbreviation: z.string().nullable().optional(),
  league: LeagueIdSchema,
  sport: z.string().min(1),
  conference: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),
});
export type TeamSearchResult = z.infer<typeof TeamSearchResultSchema>;

/** Partial update to a followed team's profile fields (tier, rival, notes). */
export const UpdateTeamInputSchema = z.object({
  follow_tier: FollowTierSchema.optional(),
  is_rival: SqliteBoolSchema.optional(),
  notes_md: z.string().nullable().optional(),
});
export type UpdateTeamInput = z.infer<typeof UpdateTeamInputSchema>;

/** Partial update to a followed team's notification preferences. */
export const UpdateTeamNotificationsInputSchema = z.object({
  notify_start: SqliteBoolSchema.optional(),
  notify_end: SqliteBoolSchema.optional(),
  notify_close: SqliteBoolSchema.optional(),
  notify_trades: SqliteBoolSchema.optional(),
});
export type UpdateTeamNotificationsInput = z.infer<
  typeof UpdateTeamNotificationsInputSchema
>;

// ── P1-B live-scores domain ────────────────────────────────────────

/** High-level status for a single game. Mirrors the P1-B CHECK constraint. */
export const GameStatusSchema = z.enum(['scheduled', 'live', 'final']);
export type GameStatus = z.infer<typeof GameStatusSchema>;

/**
 * One side of a game. Team identifiers may be null if the ESPN payload
 * didn't include a resolvable team id (rare, but defensive).
 */
export const GameTeamSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().min(1),
  abbreviation: z.string().nullable().optional(),
  score: z.number().int().nullable().optional(),
});
export type GameTeam = z.infer<typeof GameTeamSchema>;

/**
 * Normalized game shape returned by the live-scores engine and persisted
 * to the sp_games cache. Times are epoch ms.
 */
export const GameSchema = z.object({
  id: z.string().min(1),
  league: LeagueIdSchema,
  sport: z.string().min(1),
  home: GameTeamSchema,
  away: GameTeamSchema,
  status: GameStatusSchema,
  period: z.string().nullable().optional(),
  clock: z.string().nullable().optional(),
  startAt: z.number().int().nonnegative(),
  venue: z.string().nullable().optional(),
  broadcast: z.string().nullable().optional(),
  updatedAt: z.number().int().nonnegative(),
});
export type Game = z.infer<typeof GameSchema>;

// ── P1-C standings domain ──────────────────────────────────────────

/**
 * One row inside a league standings table. `teamId` is the stable
 * `espn:{league}:{externalId}` compound used by followed-team storage,
 * so `findTeamRecord` can cross-reference `sp_teams.id` directly.
 */
export const StandingRowSchema = z.object({
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  teamAbbreviation: z.string().nullable(),
  wins: z.number().nonnegative(),
  losses: z.number().nonnegative(),
  ties: z.number().nonnegative(),
  /** 0..1 */
  winPct: z.number().min(0).max(1),
  gamesBack: z.number().nullable(),
  streak: z.string().nullable(),
  pointsFor: z.number().nullable(),
  pointsAgainst: z.number().nullable(),
});
export type StandingRow = z.infer<typeof StandingRowSchema>;

/**
 * One group of standings rows. `conference` and `division` mirror ESPN's
 * nesting; MLS has no divisions so `division` is null there.
 */
export const StandingGroupSchema = z.object({
  league: LeagueIdSchema,
  conference: z.string().nullable(),
  division: z.string().nullable(),
  rows: z.array(StandingRowSchema),
});
export type StandingGroup = z.infer<typeof StandingGroupSchema>;

// ── P1-D game detail domain ────────────────────────────────────────

/**
 * One period of scoring in a game. `period` is a string so box scores
 * that label periods as "1st", "OT", "SO", etc. round-trip unchanged.
 */
export const PeriodScoreSchema = z.object({
  period: z.union([z.number().int(), z.string()]),
  homeScore: z.number().int(),
  awayScore: z.number().int(),
});
export type PeriodScore = z.infer<typeof PeriodScoreSchema>;

/** Key statistical leader for a game (passing yards, points, goals, etc.). */
export const GameLeaderSchema = z.object({
  teamSide: z.enum(['home', 'away']),
  category: z.string().min(1),
  displayValue: z.string().min(1),
  athleteName: z.string().nullable().optional(),
});
export type GameLeader = z.infer<typeof GameLeaderSchema>;

/**
 * Expanded per-game payload returned by the game-detail engine. Extends
 * `Game` with period-by-period breakdown, optional leaders, and weather.
 */
export const GameDetailSchema = GameSchema.extend({
  periods: z.array(PeriodScoreSchema),
  leaders: z.array(GameLeaderSchema).nullable().optional(),
  weather: z.string().nullable().optional(),
});
export type GameDetail = z.infer<typeof GameDetailSchema>;

// ── P2-B play-by-play timeline domain ──────────────────────────────

/**
 * Generic event type for a play-by-play row. Sport-specific flavor
 * (downs, inning half, minute, power play) lives in the `description`
 * string -- the UI never branches per sport.
 */
export const TimelineEventTypeSchema = z.enum([
  'score',
  'big_play',
  'penalty',
  'substitution',
  'period_boundary',
  'timeout',
  'other',
]);
export type TimelineEventType = z.infer<typeof TimelineEventTypeSchema>;

/**
 * One normalized entry in a game's play-by-play timeline. Returned by
 * `fetchGameTimeline` and rendered by the mobile + web game detail
 * screens. `period` is a union so box scores can label periods as
 * "1st", "OT", "SO", "Top 5th", etc. without a numeric collision.
 */
export const TimelineEventSchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  period: z.union([z.number().int(), z.string()]),
  clock: z.string().nullable().optional(),
  team: z.enum(['home', 'away']).nullable(),
  type: TimelineEventTypeSchema,
  scoreValue: z.number().int().nullable().optional(),
  description: z.string().min(1),
  isScoring: z.boolean(),
  awayScoreAfter: z.number().int().nullable().optional(),
  homeScoreAfter: z.number().int().nullable().optional(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

/**
 * Helper -- returns true for timeline events that the UI should emphasize
 * (score or big_play). Used by mobile + web game detail to tint the row
 * with the sports accent color.
 */
export function isMajorEvent(ev: TimelineEvent): boolean {
  return ev.type === 'score' || ev.type === 'big_play';
}

// ── V4 betting journal + bankroll domain ───────────────────────────

/**
 * Bet kind stored on the parent sp_bets row. `parlay` is a multi-leg
 * bet whose legs live in sp_bet_legs; all other values are singles.
 */
export const BetTypeSchema = z.enum([
  'moneyline',
  'spread',
  'total',
  'prop',
  'parlay',
  'future',
]);
export type BetType = z.infer<typeof BetTypeSchema>;

/**
 * Result of a settled bet (or `pending` when still unresolved). Mirrors
 * the CHECK constraint on sp_bets.result and sp_bet_legs.result.
 */
export const BetResultSchema = z.enum([
  'pending',
  'won',
  'lost',
  'push',
  'void',
]);
export type BetResult = z.infer<typeof BetResultSchema>;

/**
 * Parlay leg kind. Parlays cannot nest, so this is a strict subset of
 * BetType with `parlay` and `future` removed.
 */
export const BetLegTypeSchema = z.enum([
  'moneyline',
  'spread',
  'total',
  'prop',
]);
export type BetLegType = z.infer<typeof BetLegTypeSchema>;

/** Row shape for sp_bets. All timestamps are epoch milliseconds. */
export const BetSchema = z.object({
  id: z.string().min(1),
  sport: z.string().min(1),
  league: z.string().min(1),
  game_id: z.string().nullable(),
  team_id: z.string().nullable(),
  bet_type: BetTypeSchema,
  description: z.string().min(1),
  sportsbook: z.string().min(1),
  odds_american: z.number().int(),
  stake_cents: z.number().int().nonnegative(),
  potential_payout_cents: z.number().int().nonnegative(),
  units: z.number().nonnegative(),
  result: BetResultSchema,
  profit_loss_cents: z.number().int(),
  placed_at: z.number().int().nonnegative(),
  settled_at: z.number().int().nonnegative().nullable(),
  notes_md: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});
export type Bet = z.infer<typeof BetSchema>;

/** Row shape for sp_bet_legs. */
export const BetLegSchema = z.object({
  id: z.string().min(1),
  bet_id: z.string().min(1),
  leg_index: z.number().int().nonnegative(),
  game_id: z.string().nullable(),
  team_id: z.string().nullable(),
  description: z.string().min(1),
  odds_american: z.number().int(),
  leg_type: BetLegTypeSchema,
  result: BetResultSchema,
  settled_at: z.number().int().nonnegative().nullable(),
  created_at: z.number().int().nonnegative(),
});
export type BetLeg = z.infer<typeof BetLegSchema>;

// ── V5 fantasy leagues + transactions domain ───────────────────────

/**
 * Supported fantasy platforms. `custom` is the escape hatch for
 * commissioner-run leagues that don't fit the big five hosts.
 */
export const FantasyPlatformSchema = z.enum([
  'espn',
  'yahoo',
  'sleeper',
  'nfl',
  'cbs',
  'custom',
]);
export type FantasyPlatform = z.infer<typeof FantasyPlatformSchema>;

/** Fantasy scoring / roster format. Mirrors the CHECK on sp_fantasy_leagues.format. */
export const FantasyFormatSchema = z.enum([
  'redraft',
  'dynasty',
  'keeper',
  'bestball',
]);
export type FantasyFormat = z.infer<typeof FantasyFormatSchema>;

/**
 * Transaction kind. Mirrors the CHECK on sp_fantasy_transactions.type.
 * `draft` rows log one pick at a time; trades pair players_in + players_out.
 */
export const FantasyTransactionTypeSchema = z.enum([
  'draft',
  'trade',
  'waiver_add',
  'waiver_drop',
  'fa_add',
]);
export type FantasyTransactionType = z.infer<
  typeof FantasyTransactionTypeSchema
>;

/**
 * One player entry inside a roster or transaction payload. `team` is
 * optional so commissioner-run leagues without NFL team affiliation
 * (dynasty rookie drafts, IDP-only leagues) don't need to fabricate one.
 */
export const FantasyPlayerSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),
  team: z.string().nullable().optional(),
});
export type FantasyPlayer = z.infer<typeof FantasyPlayerSchema>;

/**
 * Row shape for sp_fantasy_leagues. `roster_json` is parsed into `roster`
 * by the CRUD layer on read (JSON.parse + Zod array parse).
 */
export const FantasyLeagueSchema = z.object({
  id: z.string().min(1),
  platform: FantasyPlatformSchema,
  sport: z.string().min(1),
  league_name: z.string().min(1),
  season: z.string().min(1),
  format: FantasyFormatSchema,
  team_name: z.string().min(1),
  roster: z.array(FantasyPlayerSchema),
  record_wins: z.number().int().nonnegative(),
  record_losses: z.number().int().nonnegative(),
  record_ties: z.number().int().nonnegative(),
  points_for: z.number(),
  points_against: z.number(),
  standings_position: z.number().int().nullable(),
  buy_in_cents: z.number().int().nullable(),
  prize_cents: z.number().int().nullable(),
  notes_md: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});
export type FantasyLeague = z.infer<typeof FantasyLeagueSchema>;

/**
 * Row shape for sp_fantasy_transactions. `players_in_json` and
 * `players_out_json` are parsed into arrays by the CRUD layer on read.
 */
export const FantasyTransactionSchema = z.object({
  id: z.string().min(1),
  league_id: z.string().min(1),
  type: FantasyTransactionTypeSchema,
  players_in: z.array(FantasyPlayerSchema),
  players_out: z.array(FantasyPlayerSchema),
  description: z.string().min(1),
  reasoning_md: z.string().nullable(),
  happened_at: z.number().int().nonnegative(),
  created_at: z.number().int().nonnegative(),
});
export type FantasyTransaction = z.infer<typeof FantasyTransactionSchema>;

/** Row shape for sp_bankroll. One row per bookkeeping profile. */
export const BankrollSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  starting_cents: z.number().int(),
  current_cents: z.number().int(),
  unit_size_cents: z.number().int().nonnegative(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});
export type Bankroll = z.infer<typeof BankrollSchema>;

// ── V6 participation sessions + rec leagues domain ─────────────────

/**
 * Kind of personal sports activity logged in `sp_participation_sessions`.
 * Mirrors the CHECK constraint on the activity column.
 */
export const ActivityTypeSchema = z.enum([
  'game',
  'practice',
  'pickup',
  'training',
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

/**
 * Self-reported mood score, 1..5. Stored as INTEGER in SQLite and
 * NULL when the user skips the prompt.
 */
export const MoodSchema = z.number().int().min(1).max(5);
export type Mood = z.infer<typeof MoodSchema>;

/**
 * Flexible per-sport stat payload. Keys are sport-specific metric names
 * (e.g. `points`, `rebounds`, `distance_meters`, `pace_seconds_per_km`)
 * and values are numeric. The engine uses `METRICS_BY_SPORT` to decide
 * which keys count for personal-best detection.
 */
export const SessionStatsSchema = z.record(z.number());
export type SessionStats = z.infer<typeof SessionStatsSchema>;

/**
 * One entry in a rec league's schedule. `starts_at` is epoch ms;
 * `result` is null until the game is played (and can remain null for
 * practices or cancelled games).
 */
export const ScheduleEntrySchema = z.object({
  opponent: z.string().min(1),
  starts_at: z.number().int().nonnegative(),
  location: z.string().nullable().optional(),
  result: z.enum(['won', 'lost', 'tied']).nullable().optional(),
});
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

/**
 * Row shape for sp_participation_sessions. JSON columns
 * (teammates_json, stats_json, photo_ids_json) are parsed by the CRUD
 * layer on read and re-serialized on write. `personal_best` is a
 * derived boolean set by the personal-bests engine at insert time.
 */
export const ParticipationSessionSchema = z.object({
  id: z.string().min(1),
  sport: z.string().min(1),
  activity: ActivityTypeSchema,
  started_at: z.number().int().nonnegative(),
  duration_minutes: z.number().int().nonnegative().nullable(),
  location: z.string().nullable(),
  teammates: z.array(z.string()),
  stats: SessionStatsSchema,
  personal_best: z.boolean(),
  mood_before: MoodSchema.nullable(),
  mood_after: MoodSchema.nullable(),
  injury_notes: z.string().nullable(),
  notes_md: z.string().nullable(),
  photo_ids: z.array(z.string()),
  created_at: z.number().int().nonnegative(),
});
export type ParticipationSession = z.infer<typeof ParticipationSessionSchema>;

/**
 * Row shape for sp_rec_leagues. Personal rec leagues the user plays in
 * (pickup softball, bar-league volleyball, etc.). `schedule_json` and
 * `roster_json` parse into typed arrays on read.
 */
export const RecLeagueSchema = z.object({
  id: z.string().min(1),
  sport: z.string().min(1),
  league_name: z.string().min(1),
  team_name: z.string().min(1),
  season: z.string().min(1),
  schedule: z.array(ScheduleEntrySchema),
  roster: z.array(z.string()),
  record_wins: z.number().int().nonnegative(),
  record_losses: z.number().int().nonnegative(),
  record_ties: z.number().int().nonnegative(),
  notes_md: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});
export type RecLeague = z.infer<typeof RecLeagueSchema>;

// ── V7 events + venues + memorabilia domain ────────────────────────

/**
 * Self-reported rating 1..5 for an attendance or venue record. NULL
 * when the user hasn't rated yet.
 */
export const StarRatingSchema = z.number().int().min(1).max(5);
export type StarRating = z.infer<typeof StarRatingSchema>;

/**
 * Row shape for sp_attendance -- one record per game the user attended.
 * `game_id` and `venue_id` are nullable soft refs; `venue_name` is the
 * denormalized human label so attendance rows survive sp_games pruning
 * and work for venues missing from the sp_venues registry.
 */
export const AttendanceSchema = z.object({
  id: z.string().min(1),
  game_id: z.string().nullable(),
  venue_id: z.string().nullable(),
  venue_name: z.string().min(1),
  section: z.string().nullable(),
  row_label: z.string().nullable(),
  seat: z.string().nullable(),
  companions: z.array(z.string()),
  cost_cents: z.number().int().nonnegative(),
  tailgate_notes_md: z.string().nullable(),
  parking_notes_md: z.string().nullable(),
  rating: StarRatingSchema.nullable(),
  notes_md: z.string().nullable(),
  photo_ids: z.array(z.string()),
  attended_at: z.number().int().nonnegative(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});
export type Attendance = z.infer<typeof AttendanceSchema>;

/**
 * Row shape for sp_venues -- stadium registry + bucket list. The
 * `visited` and `bucket_list` flags are SqliteBool (0/1). `capacity`
 * and coordinates are optional because pre-seed lists may be partial.
 */
export const VenueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  city: z.string().nullable(),
  country: z.string().nullable(),
  sport: z.string().nullable(),
  team: z.string().nullable(),
  capacity: z.number().int().nonnegative().nullable(),
  visited: SqliteBoolSchema,
  first_visit_at: z.number().int().nonnegative().nullable(),
  last_visit_at: z.number().int().nonnegative().nullable(),
  rating: StarRatingSchema.nullable(),
  bucket_list: SqliteBoolSchema,
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  notes_md: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});
export type Venue = z.infer<typeof VenueSchema>;

/**
 * Memorabilia category. Mirrors the CHECK constraint on
 * sp_memorabilia.item_type.
 */
export const MemorabiliaTypeSchema = z.enum([
  'card',
  'jersey',
  'signed',
  'ticket',
  'ball',
  'hat',
  'other',
]);
export type MemorabiliaType = z.infer<typeof MemorabiliaTypeSchema>;

/**
 * Row shape for sp_memorabilia -- collection tracker. `purchase_price_cents`
 * and `estimated_value_cents` default to 0 so appreciation math is always
 * well-defined. `acquired_at` is optional because gifts and hand-me-downs
 * may not carry a known date.
 */
export const MemorabiliaSchema = z.object({
  id: z.string().min(1),
  item_type: MemorabiliaTypeSchema,
  description: z.string().min(1),
  sport: z.string().nullable(),
  team: z.string().nullable(),
  player: z.string().nullable(),
  acquired_at: z.number().int().nonnegative().nullable(),
  purchase_price_cents: z.number().int().nonnegative(),
  estimated_value_cents: z.number().int().nonnegative(),
  photo_ids: z.array(z.string()),
  notes_md: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});
export type Memorabilia = z.infer<typeof MemorabiliaSchema>;

// ── V8 predictions domain ──────────────────────────────────────────

/**
 * Category of a logged prediction. Mirrors the CHECK constraint on
 * sp_predictions.category. `over_under` covers season-win-total picks;
 * `custom` is the escape hatch for anything that doesn't fit the named
 * award or league slots.
 */
export const PredictionCategorySchema = z.enum([
  'champion',
  'mvp',
  'roty',
  'division',
  'conference',
  'player_of_year',
  'over_under',
  'custom',
]);
export type PredictionCategory = z.infer<typeof PredictionCategorySchema>;

/**
 * Row shape for sp_predictions. `was_correct` is stored as INTEGER 0/1/NULL
 * on SQLite but surfaced as boolean/null in the domain type via a transform
 * that the CRUD layer runs on read. `confidence` is optional 1..5.
 *
 * `locks_at` is the optional immutability fence: once `Date.now() > locks_at`
 * and `settled_at` is still NULL, only `notes_md` can be mutated. Settled
 * predictions freeze everything except notes_md + re-settlement.
 */
export const PredictionSchema = z.object({
  id: z.string().min(1),
  category: PredictionCategorySchema,
  sport: z.string().nullable(),
  league: z.string().nullable(),
  season: z.string().min(1),
  prediction_text: z.string().min(1),
  reasoning_md: z.string().nullable(),
  confidence: z.number().int().min(1).max(5).nullable(),
  predicted_at: z.number().int().nonnegative(),
  locks_at: z.number().int().nonnegative().nullable(),
  settled_at: z.number().int().nonnegative().nullable(),
  was_correct: z
    .union([z.literal(0), z.literal(1), z.null()])
    .transform((v) => (v === null ? null : v === 1))
    .pipe(z.union([z.boolean(), z.null()])),
  result_text: z.string().nullable(),
  notes_md: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});
export type Prediction = z.infer<typeof PredictionSchema>;
