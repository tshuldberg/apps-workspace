'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  getBirthProfiles,
  getBirthProfile,
  createBirthProfile,
  updateBirthProfile,
  deleteBirthProfile,
  getTransitsByProfile,
  getTransitsByDate,
  getDailyReading,
  createDailyReading,
  createSavedChart,
  getDailyReadings,
  getSavedChartsByProfile,
  getStarsStats,
  getMoonCalendarMonth,
  cacheMoonCalendarDay,
  saveCompatibilityResult,
  getRecentCompatibilityResults,
  getZodiacEvents,
  cacheZodiacEvent,
  getTransitEventsByProfile,
  createJournalEntry,
  getJournalEntries,
  getJournalEntry,
  searchJournalEntries,
  deleteJournalEntry,
  getJournalEntryCount,
  saveTarotReading,
  getTarotReadings,
  saveSolarReturn,
  getSolarReturn,
  saveProgressedChart,
  getProgressedChart,
  computeMoonCalendarMonth,
  computeQuickMatch,
  canonicalPair,
  computeZodiacEvents,
  computeSolarReturn,
  computeProgressedChart,
  type CreateBirthProfileInput,
  type UpdateBirthProfileInput,
  type CreateDailyReadingInput,
  type CreateTarotReadingInput,
} from '@mylife/stars';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('stars');
  return adapter;
}

async function runAction<T>(message: string, fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(message, error);
    throw new Error(message);
  }
}

// ── Birth Profiles ──────────────────────────────────────────────────

export async function fetchProfiles() {
  return runAction('Failed to fetch MyStars profiles', () => getBirthProfiles(db()));
}

export async function fetchProfile(id: string) {
  return runAction('Failed to fetch MyStars profile', () => getBirthProfile(db(), id));
}

export async function doCreateProfile(input: CreateBirthProfileInput) {
  return runAction('Failed to create MyStars profile', () => {
    const id = crypto.randomUUID();
    return createBirthProfile(db(), id, input);
  });
}

export async function doUpdateProfile(id: string, input: UpdateBirthProfileInput) {
  return runAction('Failed to update MyStars profile', () => updateBirthProfile(db(), id, input));
}

export async function doDeleteProfile(id: string) {
  return runAction('Failed to delete MyStars profile', () => deleteBirthProfile(db(), id));
}

// ── Transits ────────────────────────────────────────────────────────

export async function fetchTransitsByProfile(profileId: string, limit?: number) {
  return runAction('Failed to fetch MyStars transits', () => getTransitsByProfile(db(), profileId, limit));
}

export async function fetchTransitsByDate(date: string) {
  return runAction('Failed to fetch MyStars transits for date', () => getTransitsByDate(db(), date));
}

// ── Daily Readings ──────────────────────────────────────────────────

export async function fetchDailyReading(profileId: string, date: string) {
  return runAction('Failed to fetch MyStars daily reading', () => getDailyReading(db(), profileId, date));
}

export async function doCreateDailyReading(input: CreateDailyReadingInput) {
  return runAction('Failed to create MyStars daily reading', () => {
    const id = crypto.randomUUID();
    return createDailyReading(db(), id, input);
  });
}

export async function fetchDailyReadingsAction(profileId?: string | null, limit?: number) {
  return runAction('Failed to fetch MyStars reading archive', () => getDailyReadings(db(), profileId, limit));
}

// ── Saved Charts ────────────────────────────────────────────────────

export async function fetchSavedCharts(profileId: string) {
  return runAction('Failed to fetch MyStars saved charts', () => getSavedChartsByProfile(db(), profileId));
}

export async function doCreateSavedChart(
  profileId: string,
  chartType: string,
  title: string,
  data: string,
) {
  return runAction('Failed to save MyStars chart', () => {
    const id = crypto.randomUUID();
    return createSavedChart(db(), id, profileId, chartType, title, data);
  });
}

// ── Stats ───────────────────────────────────────────────────────────

export async function fetchStats() {
  return runAction('Failed to fetch MyStars stats', () => getStarsStats(db()));
}

// ── Moon Calendar ───────────────────────────────────────────────────

export async function doComputeAndCacheMoonMonth(year: number, month: number) {
  return runAction('Failed to compute MyStars moon calendar month', () => {
    const adapter = db();
    const days = computeMoonCalendarMonth(year, month);
    for (const day of days) {
      cacheMoonCalendarDay(adapter, crypto.randomUUID(), day);
    }
    return days;
  });
}

export async function fetchMoonCalendarMonth(year: number, month: number) {
  return runAction('Failed to fetch MyStars moon calendar month', async () => {
    const cached = getMoonCalendarMonth(db(), year, month);
    if (cached.length > 0) return cached;
    return doComputeAndCacheMoonMonth(year, month);
  });
}

// ── Compatibility ───────────────────────────────────────────────────

export async function doComputeCompatibility(
  profileAId: string,
  profileBId: string,
) {
  return runAction('Failed to compute MyStars compatibility', () => {
    const adapter = db();
    const profileA = getBirthProfile(adapter, profileAId);
    const profileB = getBirthProfile(adapter, profileBId);
    if (!profileA || !profileB) return null;
    if (!profileA.sunSign || !profileB.sunSign) return null;

    const analysis = computeQuickMatch(
      profileAId,
      profileBId,
      profileA.sunSign,
      profileB.sunSign,
    );

    const [canonA, canonB] = canonicalPair(profileAId, profileBId);
    saveCompatibilityResult(
      adapter,
      crypto.randomUUID(),
      canonA,
      canonB,
      analysis.overallScore,
      analysis.elementDescription,
      analysis.analysisType,
    );

    return { ...analysis, profileAName: profileA.name, profileBName: profileB.name };
  });
}

export async function fetchRecentCompatibility(limit?: number) {
  return runAction('Failed to fetch MyStars compatibility history', () => {
    const adapter = db();
    const results = getRecentCompatibilityResults(adapter, limit);
    return results.map((r) => {
      const profileA = getBirthProfile(adapter, r.profileAId);
      const profileB = getBirthProfile(adapter, r.profileBId);
      return {
        ...r,
        profileAName: profileA?.name ?? 'Unknown',
        profileBName: profileB?.name ?? 'Unknown',
      };
    });
  });
}

// ── Zodiac Events ───────────────────────────────────────────────────

export async function doComputeAndCacheZodiacEvents(startDate: string) {
  return runAction('Failed to compute MyStars zodiac events', () => {
    const adapter = db();
    const events = computeZodiacEvents(startDate, 7, 90);
    for (const event of events) {
      cacheZodiacEvent(adapter, event);
    }
    return events;
  });
}

export async function fetchZodiacEventsAction(startDate: string, endDate: string) {
  return runAction('Failed to fetch MyStars zodiac events', async () => {
    const cached = getZodiacEvents(db(), startDate, endDate);
    if (cached.length > 0) return cached;
    return doComputeAndCacheZodiacEvents(startDate);
  });
}

// ── Transit Events ──────────────────────────────────────────────────

export async function fetchTransitEvents(
  profileId: string,
  startDate: string,
  endDate: string,
) {
  return runAction('Failed to fetch MyStars transit events', () =>
    getTransitEventsByProfile(db(), profileId, startDate, endDate),
  );
}

// ── Journal ─────────────────────────────────────────────────────────

export async function fetchJournalEntries(limit?: number) {
  return runAction('Failed to fetch MyStars journal entries', () => getJournalEntries(db(), limit));
}

export async function fetchJournalEntryAction(id: string) {
  return runAction('Failed to fetch MyStars journal entry', () => getJournalEntry(db(), id));
}

export async function doCreateJournalEntry(entry: {
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
}) {
  return runAction('Failed to create MyStars journal entry', () => {
    const id = crypto.randomUUID();
    return createJournalEntry(db(), id, entry);
  });
}

export async function doDeleteJournalEntry(id: string) {
  return runAction('Failed to delete MyStars journal entry', () => deleteJournalEntry(db(), id));
}

export async function doSearchJournalEntries(query: string, limit?: number) {
  return runAction('Failed to search MyStars journal entries', () => searchJournalEntries(db(), query, limit));
}

export async function fetchJournalCount() {
  return runAction('Failed to fetch MyStars journal counts', () => getJournalEntryCount(db()));
}

export async function fetchTarotReadingsAction(profileId?: string | null, limit?: number) {
  return runAction('Failed to fetch MyStars tarot archive', () => getTarotReadings(db(), profileId, limit));
}

export async function doCreateTarotReading(input: CreateTarotReadingInput) {
  return runAction('Failed to create MyStars tarot reading', () => {
    const id = crypto.randomUUID();
    return saveTarotReading(db(), id, input);
  });
}

// ── Solar Returns ───────────────────────────────────────────────────

export async function doComputeAndCacheSolarReturn(profileId: string, year: number) {
  return runAction('Failed to compute MyStars solar return', () => {
    const adapter = db();
    const profile = getBirthProfile(adapter, profileId);
    if (!profile) return null;
    const result = computeSolarReturn(profileId, profile.birthDate, year);
    saveSolarReturn(adapter, crypto.randomUUID(), result);
    return result;
  });
}

export async function fetchSolarReturn(profileId: string, year: number) {
  return runAction('Failed to fetch MyStars solar return', async () => {
    const cached = getSolarReturn(db(), profileId, year);
    if (cached) return cached;
    return doComputeAndCacheSolarReturn(profileId, year);
  });
}

// ── Progressions ────────────────────────────────────────────────────

export async function doComputeAndCacheProgressedChart(profileId: string) {
  return runAction('Failed to compute MyStars progressed chart', () => {
    const adapter = db();
    const profile = getBirthProfile(adapter, profileId);
    if (!profile) return null;
    const today = new Date().toISOString().slice(0, 10);
    const result = computeProgressedChart(profileId, profile.birthDate, today);
    saveProgressedChart(adapter, crypto.randomUUID(), result);
    return result;
  });
}

export async function fetchProgressedChartAction(profileId: string) {
  return runAction('Failed to fetch MyStars progressed chart', async () => {
    const cached = getProgressedChart(db(), profileId);
    if (cached) return cached;
    return doComputeAndCacheProgressedChart(profileId);
  });
}
