// ── Group Dynamics Engine ────────────────────────────────────────────
// Pure functions for analyzing circle/group activity patterns,
// compatibility between people, recurring traditions, and introductions.
// No DB calls, no side effects. Takes data in, returns computed results.

// ── Types ──────────────────────────────────────────────────────────

export interface GroupActivitySummary {
  circleId: string;
  totalGroupHangouts: number;
  lastGroupHangout: string | null;
  averageFrequencyDays: number | null;
}

export interface CompatibilityPair {
  personAId: string;
  personAName: string;
  personBId: string;
  personBName: string;
  sharedHangouts: number;
  coOccurrenceRate: number; // 0-1, what % of A's hangouts include B
}

export interface GroupTradition {
  activityTag: string;
  frequency: string; // "weekly", "monthly", "yearly"
  occurrences: number;
  lastOccurrence: string;
  description: string;
}

export interface Introduction {
  personAId: string;
  personAName: string;
  personBId: string;
  personBName: string;
  firstSharedHangoutDate: string;
}

// ── Input types ───────────────────────────────────────────────────

interface HangoutInput {
  people_ids: string[];
  happened_at: string;
  activity_tags?: string[];
}

interface PersonInput {
  id: string;
  display_name: string;
}

// ── Core Functions ────────────────────────────────────────────────

/**
 * Calculate group activity for a given circle's members.
 * A "group hangout" = hangout where 2+ circle members are present.
 */
export function getGroupActivity(
  memberIds: string[],
  hangouts: HangoutInput[],
): GroupActivitySummary {
  if (memberIds.length < 2) {
    return {
      circleId: '',
      totalGroupHangouts: 0,
      lastGroupHangout: null,
      averageFrequencyDays: null,
    };
  }

  const memberSet = new Set(memberIds);

  // Find hangouts with 2+ circle members
  const groupHangouts = hangouts
    .filter((h) => {
      const overlap = h.people_ids.filter((pid) => memberSet.has(pid));
      return overlap.length >= 2;
    })
    .sort((a, b) => a.happened_at.localeCompare(b.happened_at));

  if (groupHangouts.length === 0) {
    return {
      circleId: '',
      totalGroupHangouts: 0,
      lastGroupHangout: null,
      averageFrequencyDays: null,
    };
  }

  const lastGroupHangout = groupHangouts[groupHangouts.length - 1].happened_at;

  // Calculate average frequency between group hangouts
  let averageFrequencyDays: number | null = null;
  if (groupHangouts.length >= 2) {
    let totalDays = 0;
    for (let i = 1; i < groupHangouts.length; i++) {
      const prev = new Date(groupHangouts[i - 1].happened_at).getTime();
      const curr = new Date(groupHangouts[i].happened_at).getTime();
      totalDays += (curr - prev) / (1000 * 60 * 60 * 24);
    }
    averageFrequencyDays = Math.round(totalDays / (groupHangouts.length - 1));
  }

  return {
    circleId: '',
    totalGroupHangouts: groupHangouts.length,
    lastGroupHangout,
    averageFrequencyDays,
  };
}

/**
 * Find the top compatibility pairs across all hangouts.
 * For each pair of people, count shared hangouts.
 * coOccurrenceRate = sharedHangouts / (total hangouts where A is present).
 */
export function getCompatibilityPairs(
  hangouts: HangoutInput[],
  people: PersonInput[],
  topN: number = 10,
): CompatibilityPair[] {
  const personMap = new Map(people.map((p) => [p.id, p.display_name]));

  // Count hangouts per person and per pair
  const personHangoutCount = new Map<string, number>();
  const pairCount = new Map<string, number>();

  for (const h of hangouts) {
    const ids = h.people_ids.filter((id) => personMap.has(id));

    for (const id of ids) {
      personHangoutCount.set(id, (personHangoutCount.get(id) ?? 0) + 1);
    }

    // Count all pairs in this hangout
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  // Build compatibility pairs
  const pairs: CompatibilityPair[] = [];
  for (const [key, count] of Array.from(pairCount.entries())) {
    const [idA, idB] = key.split('|');
    const countA = personHangoutCount.get(idA) ?? 1;

    pairs.push({
      personAId: idA,
      personAName: personMap.get(idA) ?? idA,
      personBId: idB,
      personBName: personMap.get(idB) ?? idB,
      sharedHangouts: count,
      coOccurrenceRate: count / countA,
    });
  }

  // Sort by shared hangouts DESC, take top N
  pairs.sort((a, b) => b.sharedHangouts - a.sharedHangouts);
  return pairs.slice(0, topN);
}

/**
 * Detect recurring group traditions based on activity tags.
 * A tradition = same activity_tag with 2+ group members, happening repeatedly.
 */
export function detectTraditions(
  memberIds: string[],
  hangouts: HangoutInput[],
  minOccurrences: number = 2,
): GroupTradition[] {
  if (memberIds.length < 2) return [];

  const memberSet = new Set(memberIds);

  // Filter to group hangouts (2+ members present)
  const groupHangouts = hangouts
    .filter((h) => {
      const overlap = h.people_ids.filter((pid) => memberSet.has(pid));
      return overlap.length >= 2;
    })
    .sort((a, b) => a.happened_at.localeCompare(b.happened_at));

  // Group by activity tag
  const tagOccurrences = new Map<string, string[]>(); // tag -> dates

  for (const h of groupHangouts) {
    const tags = h.activity_tags ?? [];
    for (const tag of tags) {
      if (!tagOccurrences.has(tag)) {
        tagOccurrences.set(tag, []);
      }
      tagOccurrences.get(tag)!.push(h.happened_at);
    }
  }

  const traditions: GroupTradition[] = [];

  for (const [tag, dates] of Array.from(tagOccurrences.entries())) {
    if (dates.length < minOccurrences) continue;

    const lastOccurrence = dates[dates.length - 1];
    const frequency = detectFrequency(dates);
    const description = generateTraditionDescription(tag, frequency);

    traditions.push({
      activityTag: tag,
      frequency,
      occurrences: dates.length,
      lastOccurrence,
      description,
    });
  }

  // Sort by occurrences DESC
  traditions.sort((a, b) => b.occurrences - a.occurrences);
  return traditions;
}

/**
 * Detect first co-occurrences (introductions) between pairs of people.
 * For each pair, find their first shared hangout.
 */
export function detectIntroductions(
  hangouts: HangoutInput[],
  people: PersonInput[],
): Introduction[] {
  const personMap = new Map(people.map((p) => [p.id, p.display_name]));

  // Sort hangouts chronologically
  const sorted = [...hangouts].sort((a, b) => a.happened_at.localeCompare(b.happened_at));

  // Track first co-occurrence for each pair
  const firstMeeting = new Map<string, string>(); // pairKey -> date

  for (const h of sorted) {
    const ids = h.people_ids.filter((id) => personMap.has(id));

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`;
        if (!firstMeeting.has(key)) {
          firstMeeting.set(key, h.happened_at);
        }
      }
    }
  }

  // Build introduction list
  const introductions: Introduction[] = [];
  for (const [key, date] of Array.from(firstMeeting.entries())) {
    const [idA, idB] = key.split('|');
    introductions.push({
      personAId: idA,
      personAName: personMap.get(idA) ?? idA,
      personBId: idB,
      personBName: personMap.get(idB) ?? idB,
      firstSharedHangoutDate: date,
    });
  }

  // Sort by date ASC (oldest introductions first)
  introductions.sort((a, b) => a.firstSharedHangoutDate.localeCompare(b.firstSharedHangoutDate));
  return introductions;
}

// ── Internal Helpers ──────────────────────────────────────────────

/**
 * Detect frequency pattern from a list of sorted dates.
 */
function detectFrequency(dates: string[]): string {
  if (dates.length < 2) return 'occasional';

  // Calculate average days between occurrences
  let totalDays = 0;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]).getTime();
    const curr = new Date(dates[i]).getTime();
    totalDays += (curr - prev) / (1000 * 60 * 60 * 24);
  }
  const avgDays = totalDays / (dates.length - 1);

  if (avgDays <= 10) return 'weekly';
  if (avgDays <= 45) return 'monthly';
  if (avgDays <= 120) return 'quarterly';
  return 'yearly';
}

/**
 * Generate a human-readable tradition description.
 */
function generateTraditionDescription(tag: string, frequency: string): string {
  const tagLabel = tag.charAt(0).toUpperCase() + tag.slice(1);

  switch (frequency) {
    case 'weekly':
      return `Weekly ${tagLabel.toLowerCase()}`;
    case 'monthly':
      return `Monthly ${tagLabel.toLowerCase()}`;
    case 'quarterly':
      return `Quarterly ${tagLabel.toLowerCase()}`;
    case 'yearly':
      return `Annual ${tagLabel.toLowerCase()} tradition`;
    default:
      return `Recurring ${tagLabel.toLowerCase()}`;
  }
}
