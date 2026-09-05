// ── Quality-of-Time Analysis Engine ─────────────────────────────────
// Pure functions for analyzing time distribution, quality correlations,
// inner circle detection, and energy-based relationship patterns.
// No DB calls, no side effects. Takes data in, returns computed results.

// ── Types ───────────────────────────────────────────────────────────

export interface PersonTimeShare {
  personId: string;
  personName: string;
  totalMinutes: number;
  hangoutCount: number;
  percentOfTotal: number;
}

export interface QualityCorrelation {
  personId: string;
  personName: string;
  avgQuality: number;
  totalMinutes: number;
  hangoutCount: number;
}

export type TimeQualityQuadrant =
  | 'high-time-high-quality'
  | 'high-time-low-quality'
  | 'low-time-high-quality'
  | 'low-time-low-quality';

export interface EnergyBreakdown {
  energyTag: string;
  totalMinutes: number;
  avgQuality: number;
  personCount: number;
}

// ── Input types ─────────────────────────────────────────────────────

interface HangoutBase {
  people_ids: string[];
  duration_minutes: number | null;
}

interface HangoutWithQuality extends HangoutBase {
  quality_rating: number | null;
}

interface PersonBase {
  id: string;
  display_name: string;
}

interface PersonWithEnergy extends PersonBase {
  energy_tag: string | null;
}

// ── getTimeDistribution ─────────────────────────────────────────────

/**
 * Calculate how total hangout time is distributed across people.
 * Multi-person hangouts count their duration for each person present.
 * Hangouts with null duration are counted as 0 minutes but still
 * increment the hangout count.
 * Sorted by totalMinutes DESC.
 */
export function getTimeDistribution(
  hangouts: HangoutBase[],
  people: PersonBase[],
): PersonTimeShare[] {
  if (hangouts.length === 0 || people.length === 0) return [];

  const personMap = new Map(people.map((p) => [p.id, p.display_name]));
  const timeMap = new Map<string, { minutes: number; count: number }>();

  for (const h of hangouts) {
    const mins = h.duration_minutes ?? 0;
    for (const pid of h.people_ids) {
      if (!personMap.has(pid)) continue;
      const existing = timeMap.get(pid) ?? { minutes: 0, count: 0 };
      existing.minutes += mins;
      existing.count += 1;
      timeMap.set(pid, existing);
    }
  }

  const totalMinutes = Array.from(timeMap.values()).reduce(
    (sum, v) => sum + v.minutes,
    0,
  );

  const results: PersonTimeShare[] = [];
  for (const [pid, { minutes, count }] of Array.from(timeMap.entries())) {
    results.push({
      personId: pid,
      personName: personMap.get(pid)!,
      totalMinutes: minutes,
      hangoutCount: count,
      percentOfTotal: totalMinutes > 0
        ? Math.round((minutes / totalMinutes) * 1000) / 10
        : 0,
    });
  }

  results.sort((a, b) => b.totalMinutes - a.totalMinutes);
  return results;
}

// ── getQualityCorrelation ───────────────────────────────────────────

/**
 * Average quality rating per person, excluding hangouts with null ratings.
 * Sorted by avgQuality DESC.
 */
export function getQualityCorrelation(
  hangouts: HangoutWithQuality[],
  people: PersonBase[],
): QualityCorrelation[] {
  if (hangouts.length === 0 || people.length === 0) return [];

  const personMap = new Map(people.map((p) => [p.id, p.display_name]));
  const statsMap = new Map<
    string,
    { qualitySum: number; qualityCount: number; minutes: number; hangoutCount: number }
  >();

  for (const h of hangouts) {
    const mins = h.duration_minutes ?? 0;
    for (const pid of h.people_ids) {
      if (!personMap.has(pid)) continue;
      const existing = statsMap.get(pid) ?? {
        qualitySum: 0,
        qualityCount: 0,
        minutes: 0,
        hangoutCount: 0,
      };
      existing.minutes += mins;
      existing.hangoutCount += 1;
      if (h.quality_rating !== null) {
        existing.qualitySum += h.quality_rating;
        existing.qualityCount += 1;
      }
      statsMap.set(pid, existing);
    }
  }

  const results: QualityCorrelation[] = [];
  for (const [pid, stats] of Array.from(statsMap.entries())) {
    if (stats.qualityCount === 0) continue; // skip people with no rated hangouts
    results.push({
      personId: pid,
      personName: personMap.get(pid)!,
      avgQuality: Math.round((stats.qualitySum / stats.qualityCount) * 100) / 100,
      totalMinutes: stats.minutes,
      hangoutCount: stats.hangoutCount,
    });
  }

  results.sort((a, b) => b.avgQuality - a.avgQuality);
  return results;
}

// ── getInnerCircle ──────────────────────────────────────────────────

/**
 * Top N people by composite score: (normalizedTime * 0.4) + (normalizedQuality * 0.6).
 * Normalization: value / max across all people. People without quality ratings are excluded.
 */
export function getInnerCircle(
  hangouts: HangoutWithQuality[],
  people: PersonBase[],
  topN: number = 5,
): QualityCorrelation[] {
  const correlations = getQualityCorrelation(hangouts, people);
  if (correlations.length === 0) return [];

  const maxTime = Math.max(...correlations.map((c) => c.totalMinutes));
  const maxQuality = Math.max(...correlations.map((c) => c.avgQuality));

  if (maxTime === 0 && maxQuality === 0) return correlations.slice(0, topN);

  const scored = correlations.map((c) => ({
    ...c,
    score:
      (maxTime > 0 ? (c.totalMinutes / maxTime) * 0.4 : 0) +
      (maxQuality > 0 ? (c.avgQuality / maxQuality) * 0.6 : 0),
  }));

  scored.sort((a, b) => b.score - a.score);
  // Strip the score property before returning
  return scored.slice(0, topN).map(({ score: _score, ...rest }) => rest);
}

// ── getTimeVsQualityQuadrant ────────────────────────────────────────

/**
 * Determine which quadrant a person falls into based on median splits.
 * high/low time: person's totalMinutes vs median of allPeopleStats.
 * high/low quality: requires computing quality from hangouts.
 */
export function getTimeVsQualityQuadrant(
  personId: string,
  hangouts: HangoutWithQuality[],
  allPeopleStats: PersonTimeShare[],
): TimeQualityQuadrant {
  if (allPeopleStats.length === 0) return 'low-time-low-quality';

  // Calculate median time
  const sortedTimes = [...allPeopleStats]
    .map((p) => p.totalMinutes)
    .sort((a, b) => a - b);
  const medianTime =
    sortedTimes.length % 2 === 0
      ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
      : sortedTimes[Math.floor(sortedTimes.length / 2)];

  // Get person's time
  const personStats = allPeopleStats.find((p) => p.personId === personId);
  const personTime = personStats?.totalMinutes ?? 0;

  // Calculate person's average quality
  let qualitySum = 0;
  let qualityCount = 0;
  for (const h of hangouts) {
    if (h.people_ids.includes(personId) && h.quality_rating !== null) {
      qualitySum += h.quality_rating;
      qualityCount += 1;
    }
  }
  const personQuality = qualityCount > 0 ? qualitySum / qualityCount : 0;

  // Calculate median quality across all people who have ratings
  const personQualities: number[] = [];
  const personIds = allPeopleStats.map((p) => p.personId);
  for (const pid of personIds) {
    let qSum = 0;
    let qCount = 0;
    for (const h of hangouts) {
      if (h.people_ids.includes(pid) && h.quality_rating !== null) {
        qSum += h.quality_rating;
        qCount += 1;
      }
    }
    if (qCount > 0) personQualities.push(qSum / qCount);
  }

  const sortedQualities = personQualities.sort((a, b) => a - b);
  const medianQuality =
    sortedQualities.length === 0
      ? 0
      : sortedQualities.length % 2 === 0
        ? (sortedQualities[sortedQualities.length / 2 - 1] +
            sortedQualities[sortedQualities.length / 2]) /
          2
        : sortedQualities[Math.floor(sortedQualities.length / 2)];

  const highTime = personTime >= medianTime;
  const highQuality = personQuality >= medianQuality;

  if (highTime && highQuality) return 'high-time-high-quality';
  if (highTime && !highQuality) return 'high-time-low-quality';
  if (!highTime && highQuality) return 'low-time-high-quality';
  return 'low-time-low-quality';
}

// ── getEnergyCorrelation ────────────────────────────────────────────

/**
 * Group people by energy_tag and aggregate time and quality.
 * People with null energy_tag are excluded.
 */
export function getEnergyCorrelation(
  hangouts: HangoutWithQuality[],
  people: PersonWithEnergy[],
): EnergyBreakdown[] {
  if (hangouts.length === 0 || people.length === 0) return [];

  // Map personId to energy_tag
  const energyMap = new Map<string, string>();
  for (const p of people) {
    if (p.energy_tag !== null) {
      energyMap.set(p.id, p.energy_tag);
    }
  }

  // Accumulate per energy tag
  const tagStats = new Map<
    string,
    { minutes: number; qualitySum: number; qualityCount: number; personIds: Set<string> }
  >();

  for (const h of hangouts) {
    const mins = h.duration_minutes ?? 0;
    for (const pid of h.people_ids) {
      const tag = energyMap.get(pid);
      if (!tag) continue;
      const existing = tagStats.get(tag) ?? {
        minutes: 0,
        qualitySum: 0,
        qualityCount: 0,
        personIds: new Set<string>(),
      };
      existing.minutes += mins;
      existing.personIds.add(pid);
      if (h.quality_rating !== null) {
        existing.qualitySum += h.quality_rating;
        existing.qualityCount += 1;
      }
      tagStats.set(tag, existing);
    }
  }

  const results: EnergyBreakdown[] = [];
  for (const [tag, stats] of Array.from(tagStats.entries())) {
    results.push({
      energyTag: tag,
      totalMinutes: stats.minutes,
      avgQuality:
        stats.qualityCount > 0
          ? Math.round((stats.qualitySum / stats.qualityCount) * 100) / 100
          : 0,
      personCount: stats.personIds.size,
    });
  }

  // Sort by totalMinutes DESC
  results.sort((a, b) => b.totalMinutes - a.totalMinutes);
  return results;
}
