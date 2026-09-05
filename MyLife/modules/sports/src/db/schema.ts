/**
 * SQLite schema for the MySports module.
 *
 * Table names use the `sp_` prefix to avoid collisions in the shared hub
 * database. Booleans are stored as INTEGER (0/1). Timestamps are stored as
 * INTEGER epoch milliseconds. Primary keys are TEXT (external stable IDs or
 * UUIDs).
 */

// ── V1 Tables ──────────────────────────────────────────────────────

export const V1_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS sp_teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    league TEXT NOT NULL,
    sport TEXT NOT NULL,
    conference TEXT,
    division TEXT,
    logo_url TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    follow_tier TEXT NOT NULL DEFAULT 'casual' CHECK (follow_tier IN ('diehard','casual','occasional')),
    notify_start INTEGER NOT NULL DEFAULT 1,
    notify_end INTEGER NOT NULL DEFAULT 1,
    notify_close INTEGER NOT NULL DEFAULT 0,
    notify_trades INTEGER NOT NULL DEFAULT 0,
    is_rival INTEGER NOT NULL DEFAULT 0,
    notes_md TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sp_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER NOT NULL
  )`,
];

// ── V1 Indexes ─────────────────────────────────────────────────────

export const V1_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_sp_teams_league ON sp_teams(league)`,
  `CREATE INDEX IF NOT EXISTS idx_sp_teams_sport ON sp_teams(sport)`,
  `CREATE INDEX IF NOT EXISTS idx_sp_teams_tier ON sp_teams(follow_tier)`,
  `CREATE INDEX IF NOT EXISTS idx_sp_teams_rival ON sp_teams(is_rival) WHERE is_rival = 1`,
];

// ── V2 Tables (live-scores cache) ──────────────────────────────────
//
// Additive only. Does NOT include attendance columns -- those land in
// P6 when the "I attended" surface ships.

export const V2_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS sp_games (
    id TEXT PRIMARY KEY,
    league TEXT NOT NULL,
    sport TEXT NOT NULL,
    home_team_id TEXT,
    home_team_name TEXT NOT NULL,
    home_score INTEGER,
    away_team_id TEXT,
    away_team_name TEXT NOT NULL,
    away_score INTEGER,
    start_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled','live','final')),
    period TEXT,
    clock TEXT,
    venue TEXT,
    broadcast TEXT,
    updated_at INTEGER NOT NULL
  )`,
];

export const V2_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sp_games_start_at_idx ON sp_games(start_at)`,
  `CREATE INDEX IF NOT EXISTS sp_games_status_idx ON sp_games(status)`,
  `CREATE INDEX IF NOT EXISTS sp_games_team_idx ON sp_games(home_team_id, away_team_id)`,
];

// ── V3 Tables (local notification log) ─────────────────────────────
//
// Additive only. One row per dispatched local notification. The
// composite unique index gives the rule engine a cheap dedupe primitive
// via `INSERT OR IGNORE`, so the same (team, game, event_type) can't
// fire twice even after a cold start.

export const V3_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS sp_notifications_log (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    game_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('start','final','close','overtime','rival_loss','trade')),
    fired_at INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    payload_json TEXT
  )`,
];

export const V3_INDEXES: string[] = [
  `CREATE UNIQUE INDEX IF NOT EXISTS sp_notifications_log_dedupe_idx
    ON sp_notifications_log(team_id, game_id, event_type)`,
  `CREATE INDEX IF NOT EXISTS sp_notifications_log_fired_at_idx
    ON sp_notifications_log(fired_at DESC)`,
];

// ── V4 Tables (betting journal + bankroll) ─────────────────────────
//
// Additive only. Three normalized tables for the betting journal:
//   * sp_bets          -- parent row (single or parlay)
//   * sp_bet_legs      -- normalized parlay legs, cascade-deleted
//   * sp_bankroll      -- single-row-per-profile bookkeeping tracker
//
// Design decisions:
//   * odds_american is the canonical storage format. Conversion happens
//     in the engine layer (bet-analytics.ts), not via an odds_format column.
//   * No FK to sp_games or sp_teams -- bets outlive ESPN cache pruning.
//     Referential integrity is enforced at the app layer.
//   * sp_bankroll stores NO computed columns (no total_wagered_cents,
//     total_won_cents, roi_percent). Those are computed from sp_bets on
//     read in the analytics engine to avoid denormalization drift.
//   * SQLite booleans: none in this schema. All state is enum strings or
//     ms-epoch timestamps.

export const V4_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS sp_bets (
    id TEXT PRIMARY KEY,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    game_id TEXT,
    team_id TEXT,
    bet_type TEXT NOT NULL CHECK (bet_type IN ('moneyline','spread','total','prop','parlay','future')),
    description TEXT NOT NULL,
    sportsbook TEXT NOT NULL,
    odds_american INTEGER NOT NULL,
    stake_cents INTEGER NOT NULL,
    potential_payout_cents INTEGER NOT NULL,
    units REAL NOT NULL,
    result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','won','lost','push','void')),
    profit_loss_cents INTEGER NOT NULL DEFAULT 0,
    placed_at INTEGER NOT NULL,
    settled_at INTEGER,
    notes_md TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sp_bet_legs (
    id TEXT PRIMARY KEY,
    bet_id TEXT NOT NULL REFERENCES sp_bets(id) ON DELETE CASCADE,
    leg_index INTEGER NOT NULL,
    game_id TEXT,
    team_id TEXT,
    description TEXT NOT NULL,
    odds_american INTEGER NOT NULL,
    leg_type TEXT NOT NULL CHECK (leg_type IN ('moneyline','spread','total','prop')),
    result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','won','lost','push','void')),
    settled_at INTEGER,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sp_bankroll (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    starting_cents INTEGER NOT NULL,
    current_cents INTEGER NOT NULL,
    unit_size_cents INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];

export const V4_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sp_bets_placed_at_idx ON sp_bets(placed_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sp_bets_result_placed_at_idx ON sp_bets(result, placed_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sp_bets_game_id_idx ON sp_bets(game_id)`,
  `CREATE INDEX IF NOT EXISTS sp_bets_sport_league_idx ON sp_bets(sport, league)`,
  `CREATE INDEX IF NOT EXISTS sp_bet_legs_bet_id_idx ON sp_bet_legs(bet_id)`,
];

// ── V5 Tables (fantasy leagues + transactions) ─────────────────────
//
// Additive only. Two normalized tables for multi-platform fantasy:
//   * sp_fantasy_leagues       -- one row per fantasy league-season
//   * sp_fantasy_transactions  -- draft picks, trades, waiver moves, fa adds
//
// Design decisions:
//   * No external OAuth in this phase -- `platform` is just a label.
//     CSV import + manual entry only. Projections engine lives in a
//     later phase.
//   * `season` is TEXT so '2025-26' (NBA/NHL) round-trips alongside '2026' (NFL/MLB/MLS).
//   * Roster + trade payloads are JSON arrays of `{ name, position, team? }`.
//     The CRUD layer parses + validates via Zod on read. Denormalizing
//     rosters into their own table is a later decision -- for P4-A,
//     fantasy is read-heavy journal content, not a query surface.
//   * Transactions cascade on league delete (ON DELETE CASCADE).
//   * Performance notes ride on the league row's notes_md for now.
//     A dedicated sp_fantasy_matchups table with per-week notes_md
//     is the right home if/when weekly matchup tracking ships.

export const V5_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS sp_fantasy_leagues (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('espn','yahoo','sleeper','nfl','cbs','custom')),
    sport TEXT NOT NULL,
    league_name TEXT NOT NULL,
    season TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('redraft','dynasty','keeper','bestball')),
    team_name TEXT NOT NULL,
    roster_json TEXT NOT NULL DEFAULT '[]',
    record_wins INTEGER NOT NULL DEFAULT 0,
    record_losses INTEGER NOT NULL DEFAULT 0,
    record_ties INTEGER NOT NULL DEFAULT 0,
    points_for REAL NOT NULL DEFAULT 0,
    points_against REAL NOT NULL DEFAULT 0,
    standings_position INTEGER,
    buy_in_cents INTEGER,
    prize_cents INTEGER,
    notes_md TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sp_fantasy_transactions (
    id TEXT PRIMARY KEY,
    league_id TEXT NOT NULL REFERENCES sp_fantasy_leagues(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('draft','trade','waiver_add','waiver_drop','fa_add')),
    players_in_json TEXT NOT NULL DEFAULT '[]',
    players_out_json TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL,
    reasoning_md TEXT,
    happened_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
];

export const V5_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sp_fantasy_leagues_platform_season ON sp_fantasy_leagues(platform, season)`,
  `CREATE INDEX IF NOT EXISTS sp_fantasy_leagues_sport ON sp_fantasy_leagues(sport)`,
  `CREATE INDEX IF NOT EXISTS sp_fantasy_transactions_league ON sp_fantasy_transactions(league_id, happened_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sp_fantasy_transactions_type ON sp_fantasy_transactions(type)`,
];

// ── V6 Tables (personal participation + rec leagues) ───────────────
//
// Additive only. Two independent tables for the personal sports surface:
//   * sp_participation_sessions -- a session journal (game/practice/pickup/training)
//   * sp_rec_leagues            -- amateur/rec leagues the user plays in
//
// Design decisions:
//   * `sport` is free-form lowercase text (NOT LeagueId) -- this is
//     personal sport, not pro league cache. Canonical values come from
//     METRICS_BY_SPORT in the engine but the column stays flexible.
//   * `started_at` (not `date`) keeps the epoch-ms convention used
//     everywhere else in the module.
//   * teammates/stats/photo_ids are JSON blobs, parsed + validated via
//     Zod in the CRUD layer on read. photo_ids is a plain string array
//     with NO FK -- cross-module photo linkage is P6 territory.
//   * `personal_best` is stored as INTEGER 0/1 and set by the engine on
//     insert. A partial index on personal_best=1 makes the PB showcase
//     query cheap even as the session journal grows.
//   * mood_before/mood_after are NULLable with CHECK(1..5). No FK to
//     MyMood -- cross-module links are always opt-in + free text for now.
//   * sp_rec_leagues has no FK to sp_participation_sessions; users can
//     log a league game as a session or keep them separate.

export const V6_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS sp_participation_sessions (
    id TEXT PRIMARY KEY,
    sport TEXT NOT NULL,
    activity TEXT NOT NULL CHECK (activity IN ('game','practice','pickup','training')),
    started_at INTEGER NOT NULL,
    duration_minutes INTEGER,
    location TEXT,
    teammates_json TEXT NOT NULL DEFAULT '[]',
    stats_json TEXT NOT NULL DEFAULT '{}',
    personal_best INTEGER NOT NULL DEFAULT 0,
    mood_before INTEGER CHECK (mood_before IS NULL OR mood_before BETWEEN 1 AND 5),
    mood_after INTEGER CHECK (mood_after IS NULL OR mood_after BETWEEN 1 AND 5),
    injury_notes TEXT,
    notes_md TEXT,
    photo_ids_json TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sp_rec_leagues (
    id TEXT PRIMARY KEY,
    sport TEXT NOT NULL,
    league_name TEXT NOT NULL,
    team_name TEXT NOT NULL,
    season TEXT NOT NULL,
    schedule_json TEXT NOT NULL DEFAULT '[]',
    roster_json TEXT NOT NULL DEFAULT '[]',
    record_wins INTEGER NOT NULL DEFAULT 0,
    record_losses INTEGER NOT NULL DEFAULT 0,
    record_ties INTEGER NOT NULL DEFAULT 0,
    notes_md TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];

export const V6_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sp_participation_sport_started ON sp_participation_sessions(sport, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sp_participation_activity ON sp_participation_sessions(activity)`,
  `CREATE INDEX IF NOT EXISTS sp_participation_pb ON sp_participation_sessions(personal_best) WHERE personal_best = 1`,
  `CREATE INDEX IF NOT EXISTS sp_rec_leagues_sport_season ON sp_rec_leagues(sport, season)`,
];

// ── V7 Tables (events + venues + memorabilia) ──────────────────────
//
// Additive only. Three independent tables for the P6 events surface:
//   * sp_attendance   -- "I attended this game" journal (seats, companions, tailgate)
//   * sp_venues       -- stadium registry + bucket list
//   * sp_memorabilia  -- cards, jerseys, signed items, ticket stubs, etc.
//
// Design decisions:
//   * No FKs between these tables and V1-V6. `game_id` on sp_attendance
//     and `venue_id` on sp_attendance are soft refs (nullable TEXT) --
//     attendance outlives sp_games cache pruning and venues may be
//     user-created before the venue registry is seeded.
//   * `venue_name` is denormalized onto sp_attendance so "I watched at a
//     random bar" and venues missing from the seed list still round-trip
//     without a fabricated sp_venues row.
//   * Photos are deferred to the later photo pipeline. `photo_ids_json`
//     columns on sp_attendance and sp_memorabilia store JSON string[]
//     for forward compat; no sp_photos table yet.
//   * All monetary values are INTEGER cents (no REAL for currency).
//   * `rating` is NULLable 1..5 on both sp_attendance and sp_venues via
//     CHECK -- same pattern as mood_before/mood_after in V6.
//   * Booleans are INTEGER 0/1 (sp_venues.visited, sp_venues.bucket_list).

export const V7_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS sp_attendance (
    id TEXT PRIMARY KEY,
    game_id TEXT,
    venue_id TEXT,
    venue_name TEXT NOT NULL,
    section TEXT,
    row_label TEXT,
    seat TEXT,
    companions_json TEXT NOT NULL DEFAULT '[]',
    cost_cents INTEGER NOT NULL DEFAULT 0,
    tailgate_notes_md TEXT,
    parking_notes_md TEXT,
    rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    notes_md TEXT,
    photo_ids_json TEXT NOT NULL DEFAULT '[]',
    attended_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sp_venues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    country TEXT,
    sport TEXT,
    team TEXT,
    capacity INTEGER,
    visited INTEGER NOT NULL DEFAULT 0,
    first_visit_at INTEGER,
    last_visit_at INTEGER,
    rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    bucket_list INTEGER NOT NULL DEFAULT 0,
    lat REAL,
    lng REAL,
    notes_md TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sp_memorabilia (
    id TEXT PRIMARY KEY,
    item_type TEXT NOT NULL CHECK (item_type IN ('card','jersey','signed','ticket','ball','hat','other')),
    description TEXT NOT NULL,
    sport TEXT,
    team TEXT,
    player TEXT,
    acquired_at INTEGER,
    purchase_price_cents INTEGER NOT NULL DEFAULT 0,
    estimated_value_cents INTEGER NOT NULL DEFAULT 0,
    photo_ids_json TEXT NOT NULL DEFAULT '[]',
    notes_md TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];

export const V7_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sp_attendance_attended_at_idx ON sp_attendance(attended_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sp_attendance_game_idx ON sp_attendance(game_id)`,
  `CREATE INDEX IF NOT EXISTS sp_attendance_venue_idx ON sp_attendance(venue_id)`,
  `CREATE INDEX IF NOT EXISTS sp_venues_visited_idx ON sp_venues(visited)`,
  `CREATE INDEX IF NOT EXISTS sp_venues_bucket_list_idx ON sp_venues(bucket_list)`,
  `CREATE INDEX IF NOT EXISTS sp_venues_sport_idx ON sp_venues(sport)`,
  `CREATE INDEX IF NOT EXISTS sp_venues_team_idx ON sp_venues(team)`,
  `CREATE INDEX IF NOT EXISTS sp_memorabilia_acquired_idx ON sp_memorabilia(acquired_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sp_memorabilia_item_type_idx ON sp_memorabilia(item_type)`,
  `CREATE INDEX IF NOT EXISTS sp_memorabilia_sport_idx ON sp_memorabilia(sport)`,
];

// ── V8 Tables (predictions journal) ────────────────────────────────
//
// Additive only. One table for user-logged predictions and award picks:
//   * sp_predictions -- champion / mvp / roty / division / conference /
//     player_of_year / over_under / custom pick, with optional lock date,
//     settlement result, and accuracy tracking.
//
// Design decisions:
//   * No FKs. `sport` + `league` are free-text labels -- predictions
//     outlive any league-id registry refactor.
//   * `confidence` is 1..5 and OPTIONAL. CHECK is phrased to allow NULL.
//   * `locks_at` is the optional immutability fence. After Date.now() >
//     locks_at (and before settlement) the prediction_text + reasoning_md
//     + confidence freeze; only notes_md may be edited. Enforced in CRUD.
//   * `was_correct` stored as INTEGER 0/1 with NULL meaning "unsettled".
//     Not SqliteBool because three-state cannot fit the 0/1 union.
//   * No brackets table -- the JSON tree UI is deferred to a future
//     P7-B2 card. This migration intentionally ships predictions only.

export const V8_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS sp_predictions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('champion','mvp','roty','division','conference','player_of_year','over_under','custom')),
    sport TEXT,
    league TEXT,
    season TEXT NOT NULL,
    prediction_text TEXT NOT NULL,
    reasoning_md TEXT,
    confidence INTEGER CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 5),
    predicted_at INTEGER NOT NULL,
    locks_at INTEGER,
    settled_at INTEGER,
    was_correct INTEGER CHECK (was_correct IS NULL OR was_correct IN (0, 1)),
    result_text TEXT,
    notes_md TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];

export const V8_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS sp_predictions_settled_at_idx ON sp_predictions(settled_at)`,
  `CREATE INDEX IF NOT EXISTS sp_predictions_category_idx ON sp_predictions(category)`,
  `CREATE INDEX IF NOT EXISTS sp_predictions_sport_idx ON sp_predictions(sport)`,
  `CREATE INDEX IF NOT EXISTS sp_predictions_season_idx ON sp_predictions(season)`,
  `CREATE INDEX IF NOT EXISTS sp_predictions_predicted_at_idx ON sp_predictions(predicted_at DESC)`,
];
