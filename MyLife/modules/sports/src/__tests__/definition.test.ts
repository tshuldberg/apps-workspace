import { describe, expect, it } from 'vitest';
import {
  createInMemoryTestDatabase,
  initializeHubDatabase,
  runModuleMigrations,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  V1_INDEXES,
  V1_TABLES,
  V2_INDEXES,
  V2_TABLES,
  V3_INDEXES,
  V3_TABLES,
  V4_INDEXES,
  V4_TABLES,
  V5_INDEXES,
  V5_TABLES,
  V6_INDEXES,
  V6_TABLES,
  V7_INDEXES,
  V7_TABLES,
  V8_INDEXES,
  V8_TABLES,
} from '../db/schema';

describe('SPORTS_MODULE', () => {
  it('defines the expected module contract', () => {
    expect(SPORTS_MODULE.id).toBe('sports');
    expect(SPORTS_MODULE.tablePrefix).toBe('sp_');
    expect(SPORTS_MODULE.accentColor).toBe('#16A34A');
    expect(SPORTS_MODULE.tier).toBe('premium');
    expect(SPORTS_MODULE.storageType).toBe('sqlite');
    expect(SPORTS_MODULE.schemaVersion).toBe(8);
  });

  it('ships a V1 + V2 + V3 + V4 + V5 + V6 + V7 + V8 migration set', () => {
    expect(SPORTS_MODULE.migrations).toHaveLength(8);

    const v1 = SPORTS_MODULE.migrations?.[0];
    expect(v1?.version).toBe(1);
    expect(v1?.up.length).toBe(V1_TABLES.length + V1_INDEXES.length);
    expect(v1?.down).toEqual([
      'DROP TABLE IF EXISTS sp_settings',
      'DROP TABLE IF EXISTS sp_teams',
    ]);

    const v2 = SPORTS_MODULE.migrations?.[1];
    expect(v2?.version).toBe(2);
    expect(v2?.up.length).toBe(V2_TABLES.length + V2_INDEXES.length);
    expect(v2?.down).toEqual(['DROP TABLE IF EXISTS sp_games']);

    const v3 = SPORTS_MODULE.migrations?.[2];
    expect(v3?.version).toBe(3);
    expect(v3?.up.length).toBe(V3_TABLES.length + V3_INDEXES.length);
    expect(v3?.down).toEqual(['DROP TABLE IF EXISTS sp_notifications_log']);

    const v4 = SPORTS_MODULE.migrations?.[3];
    expect(v4?.version).toBe(4);
    expect(v4?.up.length).toBe(V4_TABLES.length + V4_INDEXES.length);
    expect(v4?.down).toEqual([
      'DROP TABLE IF EXISTS sp_bet_legs',
      'DROP TABLE IF EXISTS sp_bets',
      'DROP TABLE IF EXISTS sp_bankroll',
    ]);

    const v5 = SPORTS_MODULE.migrations?.[4];
    expect(v5?.version).toBe(5);
    expect(v5?.up.length).toBe(V5_TABLES.length + V5_INDEXES.length);
    expect(v5?.down).toEqual([
      'DROP TABLE IF EXISTS sp_fantasy_transactions',
      'DROP TABLE IF EXISTS sp_fantasy_leagues',
    ]);

    const v6 = SPORTS_MODULE.migrations?.[5];
    expect(v6?.version).toBe(6);
    expect(v6?.up.length).toBe(V6_TABLES.length + V6_INDEXES.length);
    expect(v6?.down).toEqual([
      'DROP TABLE IF EXISTS sp_participation_sessions',
      'DROP TABLE IF EXISTS sp_rec_leagues',
    ]);

    const v7 = SPORTS_MODULE.migrations?.[6];
    expect(v7?.version).toBe(7);
    expect(v7?.up.length).toBe(V7_TABLES.length + V7_INDEXES.length);
    expect(v7?.down).toEqual([
      'DROP TABLE IF EXISTS sp_attendance',
      'DROP TABLE IF EXISTS sp_venues',
      'DROP TABLE IF EXISTS sp_memorabilia',
    ]);

    const v8 = SPORTS_MODULE.migrations?.[7];
    expect(v8?.version).toBe(8);
    expect(v8?.up.length).toBe(V8_TABLES.length + V8_INDEXES.length);
    expect(v8?.down).toEqual(['DROP TABLE IF EXISTS sp_predictions']);
  });

  it('creates sp_predictions with check constraints + indexes in V8', () => {
    const tables = V8_TABLES.join('\n');
    expect(tables).toMatch(/CREATE TABLE IF NOT EXISTS sp_predictions/);
    expect(tables).toMatch(
      /category TEXT NOT NULL CHECK \(category IN \('champion','mvp','roty','division','conference','player_of_year','over_under','custom'\)\)/,
    );
    expect(tables).toMatch(
      /confidence INTEGER CHECK \(confidence IS NULL OR confidence BETWEEN 1 AND 5\)/,
    );
    expect(tables).toMatch(
      /was_correct INTEGER CHECK \(was_correct IS NULL OR was_correct IN \(0, 1\)\)/,
    );
    // Brackets are deferred to a future P7-B2 card.
    expect(tables).not.toMatch(/CREATE TABLE IF NOT EXISTS sp_brackets/);

    const idx = V8_INDEXES.join('\n');
    expect(idx).toMatch(/sp_predictions_settled_at_idx/);
    expect(idx).toMatch(/sp_predictions_category_idx/);
    expect(idx).toMatch(/sp_predictions_sport_idx/);
    expect(idx).toMatch(/sp_predictions_season_idx/);
    expect(idx).toMatch(/sp_predictions_predicted_at_idx/);
  });

  it('creates sp_attendance + sp_venues + sp_memorabilia with check constraints in V7', () => {
    const tables = V7_TABLES.join('\n');
    expect(tables).toMatch(/CREATE TABLE IF NOT EXISTS sp_attendance/);
    expect(tables).toMatch(/CREATE TABLE IF NOT EXISTS sp_venues/);
    expect(tables).toMatch(/CREATE TABLE IF NOT EXISTS sp_memorabilia/);
    expect(tables).toMatch(
      /item_type TEXT NOT NULL CHECK \(item_type IN \('card','jersey','signed','ticket','ball','hat','other'\)\)/,
    );
    expect(tables).toMatch(
      /rating INTEGER CHECK \(rating IS NULL OR rating BETWEEN 1 AND 5\)/,
    );
    // Photo pipeline is deferred -- we only reserve the shape.
    expect(tables).not.toMatch(/CREATE TABLE IF NOT EXISTS sp_photos/);
    expect(tables).toMatch(/photo_ids_json TEXT NOT NULL DEFAULT '\[\]'/);

    const idx = V7_INDEXES.join('\n');
    expect(idx).toMatch(/sp_attendance_attended_at_idx/);
    expect(idx).toMatch(/sp_attendance_game_idx/);
    expect(idx).toMatch(/sp_attendance_venue_idx/);
    expect(idx).toMatch(/sp_venues_visited_idx/);
    expect(idx).toMatch(/sp_venues_bucket_list_idx/);
    expect(idx).toMatch(/sp_memorabilia_acquired_idx/);
    expect(idx).toMatch(/sp_memorabilia_item_type_idx/);
  });

  it('creates sp_fantasy_leagues + sp_fantasy_transactions with CHECK constraints in V5', () => {
    const tables = V5_TABLES.join('\n');
    expect(tables).toMatch(/CREATE TABLE IF NOT EXISTS sp_fantasy_leagues/);
    expect(tables).toMatch(
      /CREATE TABLE IF NOT EXISTS sp_fantasy_transactions/,
    );
    expect(tables).toMatch(
      /platform TEXT NOT NULL CHECK \(platform IN \('espn','yahoo','sleeper','nfl','cbs','custom'\)\)/,
    );
    expect(tables).toMatch(
      /format TEXT NOT NULL CHECK \(format IN \('redraft','dynasty','keeper','bestball'\)\)/,
    );
    expect(tables).toMatch(
      /type TEXT NOT NULL CHECK \(type IN \('draft','trade','waiver_add','waiver_drop','fa_add'\)\)/,
    );
    expect(tables).toMatch(
      /league_id TEXT NOT NULL REFERENCES sp_fantasy_leagues\(id\) ON DELETE CASCADE/,
    );

    const idx = V5_INDEXES.join('\n');
    expect(idx).toMatch(/sp_fantasy_leagues_platform_season/);
    expect(idx).toMatch(/sp_fantasy_leagues_sport/);
    expect(idx).toMatch(/sp_fantasy_transactions_league/);
    expect(idx).toMatch(/sp_fantasy_transactions_type/);
  });

  it('creates sp_bets + sp_bet_legs + sp_bankroll with check constraints in V4', () => {
    const tables = V4_TABLES.join('\n');
    expect(tables).toMatch(/CREATE TABLE IF NOT EXISTS sp_bets/);
    expect(tables).toMatch(/CREATE TABLE IF NOT EXISTS sp_bet_legs/);
    expect(tables).toMatch(/CREATE TABLE IF NOT EXISTS sp_bankroll/);
    expect(tables).toMatch(
      /bet_type TEXT NOT NULL CHECK \(bet_type IN \('moneyline','spread','total','prop','parlay','future'\)\)/,
    );
    expect(tables).toMatch(
      /result TEXT NOT NULL DEFAULT 'pending' CHECK \(result IN \('pending','won','lost','push','void'\)\)/,
    );
    expect(tables).toMatch(
      /bet_id TEXT NOT NULL REFERENCES sp_bets\(id\) ON DELETE CASCADE/,
    );
    expect(tables).toMatch(/name TEXT NOT NULL UNIQUE/);
    // Bankroll must NOT carry stored computed columns.
    expect(tables).not.toMatch(/total_wagered/);
    expect(tables).not.toMatch(/total_won/);
    expect(tables).not.toMatch(/roi_percent/);

    const idx = V4_INDEXES.join('\n');
    expect(idx).toMatch(/sp_bets_placed_at_idx/);
    expect(idx).toMatch(/sp_bets_result_placed_at_idx/);
    expect(idx).toMatch(/sp_bets_game_id_idx/);
    expect(idx).toMatch(/sp_bets_sport_league_idx/);
    expect(idx).toMatch(/sp_bet_legs_bet_id_idx/);
  });

  it('creates sp_teams and sp_settings in V1', () => {
    const joined = V1_TABLES.join('\n');
    expect(joined).toMatch(/CREATE TABLE IF NOT EXISTS sp_teams/);
    expect(joined).toMatch(/CREATE TABLE IF NOT EXISTS sp_settings/);
    expect(joined).toMatch(/follow_tier TEXT NOT NULL DEFAULT 'casual'/);
  });

  it('declares the expected V1 indexes', () => {
    const joined = V1_INDEXES.join('\n');
    expect(joined).toMatch(/idx_sp_teams_league/);
    expect(joined).toMatch(/idx_sp_teams_sport/);
    expect(joined).toMatch(/idx_sp_teams_tier/);
    expect(joined).toMatch(/idx_sp_teams_rival/);
  });

  it('creates sp_games with a status CHECK and supporting indexes in V2', () => {
    const tables = V2_TABLES.join('\n');
    expect(tables).toMatch(/CREATE TABLE IF NOT EXISTS sp_games/);
    expect(tables).toMatch(
      /status TEXT NOT NULL CHECK \(status IN \('scheduled','live','final'\)\)/,
    );
    // Attendance columns are deferred to P6 -- keep them OUT of V2.
    expect(tables).not.toMatch(/attended/);
    expect(tables).not.toMatch(/attendance_notes/);

    const idx = V2_INDEXES.join('\n');
    expect(idx).toMatch(/sp_games_start_at_idx/);
    expect(idx).toMatch(/sp_games_status_idx/);
    expect(idx).toMatch(/sp_games_team_idx/);
  });

  it('creates sp_notifications_log + composite dedupe index in V3', () => {
    const tables = V3_TABLES.join('\n');
    expect(tables).toMatch(/CREATE TABLE IF NOT EXISTS sp_notifications_log/);
    expect(tables).toMatch(
      /event_type TEXT NOT NULL CHECK \(event_type IN \('start','final','close','overtime','rival_loss','trade'\)\)/,
    );

    const idx = V3_INDEXES.join('\n');
    expect(idx).toMatch(/sp_notifications_log_dedupe_idx/);
    expect(idx).toMatch(/UNIQUE INDEX/);
    expect(idx).toMatch(/team_id, game_id, event_type/);
    expect(idx).toMatch(/sp_notifications_log_fired_at_idx/);
  });

  it('applies V2 on top of an already-V1 database without data loss', () => {
    // Bootstrap a DB pinned at V1 first so we mimic a pre-P1-B install.
    const db: InMemoryTestDatabase = createInMemoryTestDatabase();
    initializeHubDatabase(db.adapter);
    const v1 = SPORTS_MODULE.migrations?.[0];
    if (!v1) throw new Error('missing V1 migration');
    runModuleMigrations(db.adapter, 'sports', [v1]);

    // Seed a V1 row so we can assert the V2 run preserves it.
    db.adapter.execute(
      `INSERT INTO sp_teams (id, name, league, sport, follow_tier, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['espn:nfl:6', 'Cowboys', 'nfl', 'football', 'diehard', 1, 1],
    );

    // Now apply the full V1 + V2 migration set idempotently.
    runModuleMigrations(db.adapter, 'sports', SPORTS_MODULE.migrations ?? []);

    const teams = db.adapter.query<{ id: string }>(
      'SELECT id FROM sp_teams',
    );
    expect(teams).toHaveLength(1);

    // And sp_games should now exist and be empty.
    const rows = db.adapter.query<{ c: number }>(
      'SELECT COUNT(*) as c FROM sp_games',
    );
    expect(rows[0]?.c).toBe(0);

    db.close();
  });

  it('V1 -> V3 upgrade preserves sp_teams + sp_games data and adds empty log', () => {
    const db: InMemoryTestDatabase = createInMemoryTestDatabase();
    initializeHubDatabase(db.adapter);

    // Seed V1 only.
    const v1 = SPORTS_MODULE.migrations?.[0];
    if (!v1) throw new Error('missing V1 migration');
    runModuleMigrations(db.adapter, 'sports', [v1]);

    db.adapter.execute(
      `INSERT INTO sp_teams (id, name, league, sport, follow_tier, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['espn:nfl:6', 'Cowboys', 'nfl', 'football', 'diehard', 1, 1],
    );

    // Apply V2 next and seed a cached game.
    const v2 = SPORTS_MODULE.migrations?.[1];
    if (!v2) throw new Error('missing V2 migration');
    runModuleMigrations(db.adapter, 'sports', [v1, v2]);
    db.adapter.execute(
      `INSERT INTO sp_games (
        id, league, sport, home_team_name, away_team_name, start_at, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['espn:nfl:game-1', 'nfl', 'football', 'Cowboys', 'Eagles', 1_700_000_000_000, 'scheduled', 1],
    );

    // Finally apply the full V1+V2+V3 set.
    runModuleMigrations(db.adapter, 'sports', SPORTS_MODULE.migrations ?? []);

    const teams = db.adapter.query<{ id: string }>('SELECT id FROM sp_teams');
    expect(teams).toHaveLength(1);
    const games = db.adapter.query<{ id: string }>('SELECT id FROM sp_games');
    expect(games).toHaveLength(1);
    const logs = db.adapter.query<{ c: number }>(
      'SELECT COUNT(*) as c FROM sp_notifications_log',
    );
    expect(logs[0]?.c).toBe(0);

    db.close();
  });
});
