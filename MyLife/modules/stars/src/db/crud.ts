import type { DatabaseAdapter } from '@mylife/db';
import type {
  BirthProfile,
  Transit,
  DailyReading,
  TarotReading,
  SavedChart,
  CreateBirthProfileInput,
  UpdateBirthProfileInput,
  CreateTransitInput,
  CreateDailyReadingInput,
  CreateTarotReadingInput,
  StarsStats,
  MoonPhase,
  ZodiacSign,
} from '../types';
import {
  CreateBirthProfileInputSchema,
  CreateTransitInputSchema,
  CreateDailyReadingInputSchema,
  CreateTarotReadingInputSchema,
} from '../types';
import type { MoonCalendarDay } from '../engine/lunar';
import type { ZodiacEvent } from '../engine/zodiac-events';
import type { TransitEvent } from '../engine/transits';
import type { SolarReturnResult } from '../engine/solar-return';
import type { ProgressedChartResult } from '../engine/progressions';

// ── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function parseJsonStringArray(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function rowToProfile(row: Record<string, unknown>): BirthProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    birthDate: row.birth_date as string,
    birthTime: (row.birth_time as string) ?? null,
    birthLat: (row.birth_lat as number) ?? null,
    birthLng: (row.birth_lng as number) ?? null,
    birthPlace: (row.birth_place as string) ?? null,
    sunSign: (row.sun_sign as BirthProfile['sunSign']) ?? null,
    moonSign: (row.moon_sign as BirthProfile['moonSign']) ?? null,
    risingSign: (row.rising_sign as BirthProfile['risingSign']) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToTransit(row: Record<string, unknown>): Transit {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    date: row.date as string,
    planet: row.planet as string,
    sign: row.sign as Transit['sign'],
    aspect: (row.aspect as string) ?? null,
    description: (row.description as string) ?? null,
  };
}

function rowToReading(row: Record<string, unknown>): DailyReading {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    date: row.date as string,
    moonPhase: row.moon_phase as DailyReading['moonPhase'],
    moonSign: (row.moon_sign as DailyReading['moonSign']) ?? null,
    summary: (row.summary as string) ?? null,
    tarotCard: (row.tarot_card as string) ?? null,
    tarotCardId: (row.tarot_card_id as string) ?? null,
    tarotIsReversed: ((row.tarot_is_reversed as number) ?? 0) === 1,
    journalPrompt: (row.journal_prompt as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToTarotReading(row: Record<string, unknown>): TarotReading {
  let cards: TarotReading['cards'] = [];

  try {
    cards = JSON.parse((row.cards_json as string) ?? '[]') as TarotReading['cards'];
  } catch {
    cards = [];
  }

  return {
    id: row.id as string,
    profileId: (row.profile_id as string) ?? null,
    readingDate: row.reading_date as string,
    spreadType: row.spread_type as TarotReading['spreadType'],
    title: row.title as string,
    question: (row.question as string) ?? null,
    narrative: (row.narrative as string) ?? null,
    notes: (row.notes as string) ?? null,
    cards,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToSavedChart(row: Record<string, unknown>): SavedChart {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    chartType: row.chart_type as string,
    title: row.title as string,
    data: row.data as string,
    createdAt: row.created_at as string,
  };
}

// ── Birth Profiles ────────────────────────────────────────────────────

export function createBirthProfile(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateBirthProfileInput,
): BirthProfile {
  const input = CreateBirthProfileInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO st_birth_profiles (id, name, birth_date, birth_time, birth_lat, birth_lng, birth_place, sun_sign, moon_sign, rising_sign, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.birthDate,
      input.birthTime ?? null,
      input.birthLat ?? null,
      input.birthLng ?? null,
      input.birthPlace ?? null,
      input.sunSign ?? null,
      input.moonSign ?? null,
      input.risingSign ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    name: input.name,
    birthDate: input.birthDate,
    birthTime: input.birthTime ?? null,
    birthLat: input.birthLat ?? null,
    birthLng: input.birthLng ?? null,
    birthPlace: input.birthPlace ?? null,
    sunSign: input.sunSign ?? null,
    moonSign: input.moonSign ?? null,
    risingSign: input.risingSign ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getBirthProfile(db: DatabaseAdapter, id: string): BirthProfile | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_birth_profiles WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToProfile(rows[0]) : null;
}

export function getBirthProfiles(db: DatabaseAdapter): BirthProfile[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_birth_profiles ORDER BY created_at DESC`,
  );
  return rows.map(rowToProfile);
}

export function updateBirthProfile(
  db: DatabaseAdapter,
  id: string,
  input: UpdateBirthProfileInput,
): BirthProfile | null {
  const existing = getBirthProfile(db, id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
  if (input.birthDate !== undefined) { updates.push('birth_date = ?'); params.push(input.birthDate); }
  if (input.birthTime !== undefined) { updates.push('birth_time = ?'); params.push(input.birthTime); }
  if (input.birthLat !== undefined) { updates.push('birth_lat = ?'); params.push(input.birthLat); }
  if (input.birthLng !== undefined) { updates.push('birth_lng = ?'); params.push(input.birthLng); }
  if (input.birthPlace !== undefined) { updates.push('birth_place = ?'); params.push(input.birthPlace); }
  if (input.sunSign !== undefined) { updates.push('sun_sign = ?'); params.push(input.sunSign); }
  if (input.moonSign !== undefined) { updates.push('moon_sign = ?'); params.push(input.moonSign); }
  if (input.risingSign !== undefined) { updates.push('rising_sign = ?'); params.push(input.risingSign); }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.execute(`UPDATE st_birth_profiles SET ${updates.join(', ')} WHERE id = ?`, params);
  return getBirthProfile(db, id);
}

export function deleteBirthProfile(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM st_birth_profiles WHERE id = ?`, [id]);
  return true;
}

// ── Transits ──────────────────────────────────────────────────────────

export function createTransit(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateTransitInput,
): Transit {
  const input = CreateTransitInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO st_transits (id, profile_id, date, planet, sign, aspect, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.profileId,
      input.date,
      input.planet,
      input.sign,
      input.aspect ?? null,
      input.description ?? null,
      now,
    ],
  );

  return {
    id,
    profileId: input.profileId,
    date: input.date,
    planet: input.planet,
    sign: input.sign,
    aspect: input.aspect ?? null,
    description: input.description ?? null,
  };
}

export function getTransitsByProfile(
  db: DatabaseAdapter,
  profileId: string,
  limit = 50,
): Transit[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_transits WHERE profile_id = ? ORDER BY date DESC LIMIT ?`,
    [profileId, limit],
  );
  return rows.map(rowToTransit);
}

export function getTransitsByDate(db: DatabaseAdapter, date: string): Transit[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_transits WHERE date = ? ORDER BY planet ASC`,
    [date],
  );
  return rows.map(rowToTransit);
}

// ── Daily Readings ────────────────────────────────────────────────────

export function createDailyReading(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateDailyReadingInput,
): DailyReading {
  const input = CreateDailyReadingInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO st_daily_readings (
      id,
      profile_id,
      date,
      moon_phase,
      moon_sign,
      summary,
      tarot_card,
      tarot_card_id,
      tarot_is_reversed,
      journal_prompt,
      created_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.profileId,
      input.date,
      input.moonPhase,
      input.moonSign ?? null,
      input.summary ?? null,
      input.tarotCard ?? null,
      input.tarotCardId ?? null,
      input.tarotIsReversed ? 1 : 0,
      input.journalPrompt ?? null,
      now,
    ],
  );

  return {
    id,
    profileId: input.profileId,
    date: input.date,
    moonPhase: input.moonPhase,
    moonSign: input.moonSign ?? null,
    summary: input.summary ?? null,
    tarotCard: input.tarotCard ?? null,
    tarotCardId: input.tarotCardId ?? null,
    tarotIsReversed: input.tarotIsReversed ?? false,
    journalPrompt: input.journalPrompt ?? null,
    createdAt: now,
  };
}

export function saveDailyReading(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateDailyReadingInput,
): DailyReading {
  const input = CreateDailyReadingInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO st_daily_readings (
      id,
      profile_id,
      date,
      moon_phase,
      moon_sign,
      summary,
      tarot_card,
      tarot_card_id,
      tarot_is_reversed,
      journal_prompt,
      created_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id, date) DO UPDATE SET
       moon_phase = excluded.moon_phase,
       moon_sign = excluded.moon_sign,
       summary = excluded.summary,
       tarot_card = excluded.tarot_card,
       tarot_card_id = excluded.tarot_card_id,
       tarot_is_reversed = excluded.tarot_is_reversed,
       journal_prompt = excluded.journal_prompt`,
    [
      id,
      input.profileId,
      input.date,
      input.moonPhase,
      input.moonSign ?? null,
      input.summary ?? null,
      input.tarotCard ?? null,
      input.tarotCardId ?? null,
      input.tarotIsReversed ? 1 : 0,
      input.journalPrompt ?? null,
      now,
    ],
  );

  return (
    getDailyReading(db, input.profileId, input.date) ?? {
      id,
      profileId: input.profileId,
      date: input.date,
      moonPhase: input.moonPhase,
      moonSign: input.moonSign ?? null,
      summary: input.summary ?? null,
      tarotCard: input.tarotCard ?? null,
      tarotCardId: input.tarotCardId ?? null,
      tarotIsReversed: input.tarotIsReversed ?? false,
      journalPrompt: input.journalPrompt ?? null,
      createdAt: now,
    }
  );
}

export function getDailyReading(
  db: DatabaseAdapter,
  profileId: string,
  date: string,
): DailyReading | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_daily_readings WHERE profile_id = ? AND date = ?`,
    [profileId, date],
  );
  return rows.length > 0 ? rowToReading(rows[0]) : null;
}

export function getDailyReadings(
  db: DatabaseAdapter,
  profileId?: string | null,
  limit = 60,
): DailyReading[] {
  const rows = profileId
    ? db.query<Record<string, unknown>>(
        `SELECT * FROM st_daily_readings WHERE profile_id = ? ORDER BY date DESC LIMIT ?`,
        [profileId, limit],
      )
    : db.query<Record<string, unknown>>(
        `SELECT * FROM st_daily_readings ORDER BY date DESC LIMIT ?`,
        [limit],
      );

  return rows.map(rowToReading);
}

export function deleteDailyReading(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM st_daily_readings WHERE id = ?`, [id]);
  return true;
}

export function saveTarotReading(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateTarotReadingInput,
): TarotReading {
  const input = CreateTarotReadingInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT OR REPLACE INTO st_tarot_readings (
      id,
      profile_id,
      reading_date,
      spread_type,
      title,
      question,
      narrative,
      notes,
      cards_json,
      created_at,
      updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.profileId ?? null,
      input.readingDate,
      input.spreadType,
      input.title,
      input.question ?? null,
      input.narrative ?? null,
      input.notes ?? null,
      JSON.stringify(input.cards),
      now,
      now,
    ],
  );

  return (
    getTarotReading(db, id) ?? {
      id,
      profileId: input.profileId ?? null,
      readingDate: input.readingDate,
      spreadType: input.spreadType,
      title: input.title,
      question: input.question ?? null,
      narrative: input.narrative ?? null,
      notes: input.notes ?? null,
      cards: input.cards,
      createdAt: now,
      updatedAt: now,
    }
  );
}

export function getTarotReading(
  db: DatabaseAdapter,
  id: string,
): TarotReading | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_tarot_readings WHERE id = ? LIMIT 1`,
    [id],
  );

  return rows.length > 0 ? rowToTarotReading(rows[0]) : null;
}

export function getTarotReadings(
  db: DatabaseAdapter,
  profileId?: string | null,
  limit = 60,
): TarotReading[] {
  const rows = profileId === undefined
    ? db.query<Record<string, unknown>>(
        `SELECT * FROM st_tarot_readings ORDER BY reading_date DESC, created_at DESC LIMIT ?`,
        [limit],
      )
    : profileId === null
      ? db.query<Record<string, unknown>>(
          `SELECT * FROM st_tarot_readings WHERE profile_id IS NULL ORDER BY reading_date DESC, created_at DESC LIMIT ?`,
          [limit],
        )
      : db.query<Record<string, unknown>>(
          `SELECT * FROM st_tarot_readings WHERE profile_id = ? ORDER BY reading_date DESC, created_at DESC LIMIT ?`,
          [profileId, limit],
        );

  return rows.map(rowToTarotReading);
}

export function updateTarotReadingNotes(
  db: DatabaseAdapter,
  id: string,
  notes: string | null,
): TarotReading | null {
  const now = nowIso();
  db.execute(
    `UPDATE st_tarot_readings SET notes = ?, updated_at = ? WHERE id = ?`,
    [notes ?? null, now, id],
  );
  return getTarotReading(db, id);
}

export function deleteTarotReading(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM st_tarot_readings WHERE id = ?`, [id]);
  return true;
}

export function deleteReading(
  db: DatabaseAdapter,
  kind: 'daily' | 'tarot',
  id: string,
): boolean {
  if (kind === 'daily') {
    return deleteDailyReading(db, id);
  }

  return deleteTarotReading(db, id);
}

// ── Saved Charts ──────────────────────────────────────────────────────

export function createSavedChart(
  db: DatabaseAdapter,
  id: string,
  profileId: string,
  chartType: string,
  title: string,
  data: string,
): SavedChart {
  const now = nowIso();

  db.execute(
    `INSERT INTO st_saved_charts (id, profile_id, chart_type, title, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, profileId, chartType, title, data, now],
  );

  return {
    id,
    profileId,
    chartType,
    title,
    data,
    createdAt: now,
  };
}

export function getSavedChartsByProfile(
  db: DatabaseAdapter,
  profileId: string,
): SavedChart[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_saved_charts WHERE profile_id = ? ORDER BY created_at DESC`,
    [profileId],
  );
  return rows.map(rowToSavedChart);
}

// ── Stats ─────────────────────────────────────────────────────────────

export function getStarsStats(db: DatabaseAdapter): StarsStats {
  const profiles = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM st_birth_profiles`,
  );
  const transits = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM st_transits`,
  );
  const readings = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM st_daily_readings`,
  );
  const tarotReadings = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM st_tarot_readings`,
  );
  const charts = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM st_saved_charts`,
  );

  // Get the most recent daily reading's moon phase if available
  const latestReading = db.query<{ moon_phase: string }>(
    `SELECT moon_phase FROM st_daily_readings ORDER BY date DESC LIMIT 1`,
  );

  return {
    totalProfiles: profiles[0].count,
    totalTransits: transits[0].count,
    totalReadings: readings[0].count + tarotReadings[0].count,
    totalSavedCharts: charts[0].count,
    currentMoonPhase: latestReading.length > 0
      ? (latestReading[0].moon_phase as MoonPhase)
      : null,
  };
}

// ── V2: Moon Calendar ────────────────────────────────────────────────

export function cacheMoonCalendarDay(
  db: DatabaseAdapter,
  id: string,
  day: MoonCalendarDay,
): void {
  db.execute(
    `INSERT OR REPLACE INTO st_moon_calendar (id, date, moon_phase, moon_sign, illumination_pct, is_key_phase, phase_interpretation, sign_interpretation, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, day.date, day.moonPhase, day.moonSign, day.illuminationPct, day.isKeyPhase ? 1 : 0, day.phaseInterpretation, day.signInterpretation],
  );
}

export function getMoonCalendarMonth(db: DatabaseAdapter, year: number, month: number): MoonCalendarDay[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_moon_calendar WHERE date LIKE ? ORDER BY date ASC`,
    [`${prefix}%`],
  );
  return rows.map((r) => ({
    date: r.date as string,
    moonPhase: r.moon_phase as MoonPhase,
    moonSign: r.moon_sign as ZodiacSign,
    illuminationPct: r.illumination_pct as number,
    isKeyPhase: (r.is_key_phase as number) === 1,
    phaseInterpretation: (r.phase_interpretation as string) ?? '',
    signInterpretation: (r.sign_interpretation as string) ?? '',
  }));
}

// ── V2: Compatibility Results ────────────────────────────────────────

export function saveCompatibilityResult(
  db: DatabaseAdapter,
  id: string,
  profileAId: string,
  profileBId: string,
  overallScore: number,
  elementCompatibility: string,
  analysisType: string = 'quick_match',
): void {
  db.execute(
    `INSERT OR REPLACE INTO st_compatibility_results (id, profile_a_id, profile_b_id, analysis_type, overall_score, element_compatibility, computed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
    [id, profileAId, profileBId, analysisType, overallScore, elementCompatibility],
  );
}

export function getCompatibilityResult(
  db: DatabaseAdapter,
  profileAId: string,
  profileBId: string,
): {
  id: string;
  overallScore: number;
  elementCompatibility: string;
  analysisType: string;
  computedAt: string;
} | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_compatibility_results WHERE profile_a_id = ? AND profile_b_id = ?`,
    [profileAId, profileBId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    overallScore: r.overall_score as number,
    elementCompatibility: r.element_compatibility as string,
    analysisType: r.analysis_type as string,
    computedAt: r.computed_at as string,
  };
}

export function getRecentCompatibilityResults(db: DatabaseAdapter, limit: number = 10): Array<{
  id: string;
  profileAId: string;
  profileBId: string;
  overallScore: number;
  elementCompatibility: string;
  computedAt: string;
}> {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_compatibility_results ORDER BY computed_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id as string,
    profileAId: r.profile_a_id as string,
    profileBId: r.profile_b_id as string,
    overallScore: r.overall_score as number,
    elementCompatibility: r.element_compatibility as string,
    computedAt: r.computed_at as string,
  }));
}

// ── V2: Zodiac Events ───────────────────────────────────────────────

export function cacheZodiacEvent(db: DatabaseAdapter, event: ZodiacEvent): void {
  db.execute(
    `INSERT OR REPLACE INTO st_zodiac_events (id, event_type, category, event_date, body, from_sign, to_sign, title, description_brief, description_full, computed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [event.id, event.eventType, event.category, event.eventDate, event.body, event.fromSign, event.toSign, event.title, event.descriptionBrief, event.descriptionFull],
  );
}

export function getZodiacEvents(db: DatabaseAdapter, startDate: string, endDate: string): ZodiacEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_zodiac_events WHERE event_date >= ? AND event_date <= ? ORDER BY event_date ASC`,
    [startDate, endDate],
  );
  return rows.map((r) => ({
    id: r.id as string,
    eventType: r.event_type as ZodiacEvent['eventType'],
    category: r.category as ZodiacEvent['category'],
    eventDate: r.event_date as string,
    body: r.body as string,
    fromSign: (r.from_sign as ZodiacSign) ?? null,
    toSign: (r.to_sign as ZodiacSign) ?? null,
    title: r.title as string,
    descriptionBrief: r.description_brief as string,
    descriptionFull: (r.description_full as string) ?? null,
  }));
}

// ── V2: Transit Events ──────────────────────────────────────────────

export function saveTransitEvent(db: DatabaseAdapter, event: TransitEvent): void {
  db.execute(
    `INSERT OR REPLACE INTO st_transit_events (id, profile_id, transiting_body, natal_body, aspect_type, significance, current_orb, exact_date, is_applying, interpretation_brief, computed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
    [event.id, event.profileId, event.transitingBody, event.natalBody, event.aspectType, event.significance, event.currentOrb, event.exactDate, event.isApplying ? 1 : 0, event.interpretationBrief],
  );
}

export function getTransitEventsByProfile(
  db: DatabaseAdapter,
  profileId: string,
  startDate: string,
  endDate: string,
): TransitEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_transit_events WHERE profile_id = ? AND exact_date >= ? AND exact_date <= ? ORDER BY current_orb ASC`,
    [profileId, startDate, endDate],
  );
  return rows.map((r) => ({
    id: r.id as string,
    profileId: r.profile_id as string,
    transitingBody: r.transiting_body as string,
    natalBody: r.natal_body as string,
    aspectType: r.aspect_type as TransitEvent['aspectType'],
    significance: r.significance as TransitEvent['significance'],
    currentOrb: r.current_orb as number,
    exactDate: r.exact_date as string,
    isApplying: (r.is_applying as number) === 1,
    interpretationBrief: (r.interpretation_brief as string) ?? '',
  }));
}

// ── V2: Journal Entries ──────────────────────────────────────────────

export interface JournalEntryRow {
  id: string;
  profileId: string | null;
  date: string;
  title: string | null;
  content: string;
  intention: string | null;
  mood: string | null;
  moonPhase: string;
  moonSign: string;
  sunSign: string;
  retrogradePlanets: string | null;
  tarotCardName: string | null;
  photoUris: string[];
  createdAt: string;
  updatedAt: string;
}

export function createJournalEntry(
  db: DatabaseAdapter,
  id: string,
  entry: {
    profileId?: string | null;
    date: string;
    title?: string | null;
    content: string;
    intention?: string | null;
    mood?: string | null;
    moonPhase: string;
    moonSign: string;
    sunSign: string;
    retrogradePlanets?: string | null;
    tarotCardName?: string | null;
    photoUris?: string[] | null;
  },
): JournalEntryRow {
  const now = nowIso();
  db.execute(
    `INSERT INTO st_journal_entries (id, profile_id, date, title, content, intention, mood, moon_phase, moon_sign, sun_sign, retrograde_planets, tarot_card_name, photo_uris, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entry.profileId ?? null,
      entry.date,
      entry.title?.trim() || null,
      entry.content,
      entry.intention ?? null,
      entry.mood ?? null,
      entry.moonPhase,
      entry.moonSign,
      entry.sunSign,
      entry.retrogradePlanets ?? null,
      entry.tarotCardName ?? null,
      entry.photoUris && entry.photoUris.length > 0 ? JSON.stringify(entry.photoUris) : null,
      now,
      now,
    ],
  );
  return {
    id,
    profileId: entry.profileId ?? null,
    date: entry.date,
    title: entry.title?.trim() || null,
    content: entry.content,
    intention: entry.intention ?? null,
    mood: entry.mood ?? null,
    moonPhase: entry.moonPhase,
    moonSign: entry.moonSign,
    sunSign: entry.sunSign,
    retrogradePlanets: entry.retrogradePlanets ?? null,
    tarotCardName: entry.tarotCardName ?? null,
    photoUris: entry.photoUris ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

function rowToJournalEntry(row: Record<string, unknown>): JournalEntryRow {
  return {
    id: row.id as string,
    profileId: (row.profile_id as string) ?? null,
    date: row.date as string,
    title: (row.title as string) ?? null,
    content: row.content as string,
    intention: (row.intention as string) ?? null,
    mood: (row.mood as string) ?? null,
    moonPhase: row.moon_phase as string,
    moonSign: row.moon_sign as string,
    sunSign: row.sun_sign as string,
    retrogradePlanets: (row.retrograde_planets as string) ?? null,
    tarotCardName: (row.tarot_card_name as string) ?? null,
    photoUris: parseJsonStringArray(row.photo_uris),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function getJournalEntries(db: DatabaseAdapter, limit: number = 50): JournalEntryRow[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_journal_entries ORDER BY date DESC, created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToJournalEntry);
}

export function getJournalEntry(db: DatabaseAdapter, id: string): JournalEntryRow | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_journal_entries WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToJournalEntry(rows[0]) : null;
}

export function searchJournalEntries(db: DatabaseAdapter, query: string, limit: number = 20): JournalEntryRow[] {
  const escaped = query.replace(/[%_]/g, (ch) => `\\${ch}`);
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_journal_entries
     WHERE title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\'
     ORDER BY date DESC, created_at DESC
     LIMIT ?`,
    [`%${escaped}%`, `%${escaped}%`, limit],
  );
  return rows.map(rowToJournalEntry);
}

export function deleteJournalEntry(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM st_journal_entries WHERE id = ?`, [id]);
  return true;
}

export function getJournalEntryCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM st_journal_entries`);
  return rows[0].count;
}

// ── V2: Solar Returns ───────────────────────────────────────────────

export function saveSolarReturn(db: DatabaseAdapter, id: string, result: SolarReturnResult): void {
  db.execute(
    `INSERT OR REPLACE INTO st_solar_returns (id, profile_id, return_year, return_date, sun_sign, moon_sign, year_theme, computed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, result.profileId, result.returnYear, result.returnDate, result.sunSign, result.moonSign, result.yearTheme],
  );
}

export function getSolarReturn(
  db: DatabaseAdapter,
  profileId: string,
  returnYear: number,
): SolarReturnResult | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_solar_returns WHERE profile_id = ? AND return_year = ?`,
    [profileId, returnYear],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    profileId: r.profile_id as string,
    returnYear: r.return_year as number,
    returnDate: r.return_date as string,
    sunSign: r.sun_sign as ZodiacSign,
    moonSign: r.moon_sign as ZodiacSign,
    yearTheme: (r.year_theme as string) ?? '',
  };
}

// ── V2: Progressed Charts ───────────────────────────────────────────

export function saveProgressedChart(db: DatabaseAdapter, id: string, result: ProgressedChartResult): void {
  db.execute(
    `INSERT OR REPLACE INTO st_progressed_charts (id, profile_id, progressed_date, current_age_years, moon_sign, moon_degree_approx, moon_next_sign_change_years, moon_next_sign, moon_interpretation, sun_sign, sun_degree_approx, computed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, result.profileId, result.progressedDate, result.currentAgeYears, result.moonSign, result.moonDegreeApprox, result.moonNextSignChangeYears, result.moonNextSign, result.moonInterpretation, result.sunSign, result.sunDegreeApprox],
  );
}

export function getProgressedChart(db: DatabaseAdapter, profileId: string): ProgressedChartResult | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM st_progressed_charts WHERE profile_id = ?`,
    [profileId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    profileId: r.profile_id as string,
    progressedDate: r.progressed_date as string,
    currentAgeYears: r.current_age_years as number,
    moonSign: r.moon_sign as ZodiacSign,
    moonDegreeApprox: r.moon_degree_approx as number,
    moonNextSignChangeYears: (r.moon_next_sign_change_years as number) ?? 0,
    moonNextSign: (r.moon_next_sign as ZodiacSign) ?? 'aries',
    moonInterpretation: (r.moon_interpretation as string) ?? '',
    sunSign: r.sun_sign as ZodiacSign,
    sunDegreeApprox: r.sun_degree_approx as number,
  };
}
