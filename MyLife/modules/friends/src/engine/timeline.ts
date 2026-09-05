// ── Shared Experience Timeline Engine ────────────────────────────────
// Pure functions for merging hangouts, memories, gifts, and life events
// into a unified chronological timeline with milestone detection.
// No DB calls, no side effects. Takes data in, returns computed results.

// ── Types ──────────────────────────────────────────────────────────

export type TimelineEntryType =
  | 'hangout'
  | 'memory'
  | 'gift_given'
  | 'gift_received'
  | 'life_event'
  | 'milestone';

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  date: string; // ISO date
  title: string;
  summary: string;
  icon: string; // emoji
  accentColor?: string;
  metadata?: Record<string, unknown>;
}

export interface Milestone {
  id: string;
  type: string;
  date: string;
  title: string;
  description: string;
}

// ── Input types (loosely coupled to DB row shapes) ─────────────────

interface HangoutInput {
  id: string;
  people_ids: string[];
  happened_at: string;
  activity_tags: string[];
  quality_rating: number | null;
  location_name: string | null;
  notes_md: string | null;
}

interface MemoryInput {
  id: string;
  person_ids: string[];
  title: string;
  happened_at: string | null;
  is_inside_joke: boolean;
  created_at: string;
}

interface GiftInput {
  id: string;
  person_id: string;
  direction: string;
  description: string;
  occasion: string | null;
  date: string | null;
}

interface LifeEventInput {
  id: string;
  person_id: string;
  type: string;
  description: string | null;
  happened_at: string | null;
}

// ── Icon + color maps ──────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, string> = {
  coffee: '\u2615',
  dinner: '\uD83C\uDF7D\uFE0F',
  lunch: '\uD83C\uDF54',
  drinks: '\uD83C\uDF7B',
  hike: '\u26F0\uFE0F',
  movie: '\uD83C\uDFAC',
  gaming: '\uD83C\uDFAE',
  party: '\uD83C\uDF89',
  study: '\uD83D\uDCDA',
  work: '\uD83D\uDCBC',
  gym: '\uD83C\uDFCB\uFE0F',
  shopping: '\uD83D\uDED2',
  concert: '\uD83C\uDFB5',
  travel: '\u2708\uFE0F',
  random: '\uD83C\uDFB2',
};

const LIFE_EVENT_ICONS: Record<string, string> = {
  move: '\uD83C\uDFE0',
  job: '\uD83D\uDCBC',
  baby: '\uD83D\uDC76',
  engaged: '\uD83D\uDC8D',
  married: '\uD83D\uDC92',
  graduated: '\uD83C\uDF93',
  other: '\u2B50',
};

const TYPE_COLORS: Record<TimelineEntryType, string> = {
  hangout: '#EC4899',
  memory: '#8B5CF6',
  gift_given: '#10B981',
  gift_received: '#06B6D4',
  life_event: '#F59E0B',
  milestone: '#FFB877',
};

// ── Core functions ─────────────────────────────────────────────────

/**
 * Merge all data types into a unified chronological timeline for a person.
 * Sorted by date descending (most recent first).
 */
export function buildPersonTimeline(
  personId: string,
  hangouts: HangoutInput[],
  memories: MemoryInput[],
  gifts: GiftInput[],
  lifeEvents: LifeEventInput[],
  milestones: Milestone[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // ── Hangouts ───────────────────────────────────────────────────
  for (const h of hangouts) {
    if (!h.people_ids.includes(personId)) continue;
    const firstTag = h.activity_tags[0];
    const icon = firstTag ? (ACTIVITY_ICONS[firstTag] ?? '\uD83E\uDD1D') : '\uD83E\uDD1D';
    const tagsLabel = h.activity_tags.length > 0
      ? h.activity_tags.join(', ')
      : 'hangout';
    const summary = h.location_name
      ? `${tagsLabel} at ${h.location_name}`
      : tagsLabel;

    entries.push({
      id: `hangout_${h.id}`,
      type: 'hangout',
      date: h.happened_at,
      title: tagsLabel.charAt(0).toUpperCase() + tagsLabel.slice(1),
      summary,
      icon,
      accentColor: TYPE_COLORS.hangout,
      metadata: {
        quality_rating: h.quality_rating,
        activity_tags: h.activity_tags,
      },
    });
  }

  // ── Memories ───────────────────────────────────────────────────
  for (const m of memories) {
    if (!m.person_ids.includes(personId)) continue;
    const date = m.happened_at ?? m.created_at;
    const icon = m.is_inside_joke ? '\uD83E\uDD2B' : '\uD83D\uDCAD';

    entries.push({
      id: `memory_${m.id}`,
      type: 'memory',
      date,
      title: m.title,
      summary: m.is_inside_joke ? 'Inside joke' : 'Shared memory',
      icon,
      accentColor: TYPE_COLORS.memory,
      metadata: { is_inside_joke: m.is_inside_joke },
    });
  }

  // ── Gifts ──────────────────────────────────────────────────────
  for (const g of gifts) {
    if (g.person_id !== personId) continue;
    const date = g.date ?? '';
    if (!date) continue; // skip gifts with no date

    const isGiven = g.direction === 'given';
    const type: TimelineEntryType = isGiven ? 'gift_given' : 'gift_received';
    const icon = isGiven ? '\uD83C\uDF81' : '\uD83C\uDF80';
    const prefix = isGiven ? 'Gave' : 'Received';
    const summary = g.occasion ? `${prefix}: ${g.description} (${g.occasion})` : `${prefix}: ${g.description}`;

    entries.push({
      id: `gift_${g.id}`,
      type,
      date,
      title: g.description,
      summary,
      icon,
      accentColor: TYPE_COLORS[type],
      metadata: { direction: g.direction, occasion: g.occasion },
    });
  }

  // ── Life Events ────────────────────────────────────────────────
  for (const le of lifeEvents) {
    if (le.person_id !== personId) continue;
    const date = le.happened_at ?? '';
    if (!date) continue;

    const icon = LIFE_EVENT_ICONS[le.type] ?? '\u2B50';

    entries.push({
      id: `life_event_${le.id}`,
      type: 'life_event',
      date,
      title: le.type.charAt(0).toUpperCase() + le.type.slice(1),
      summary: le.description ?? le.type,
      icon,
      accentColor: TYPE_COLORS.life_event,
      metadata: { event_type: le.type },
    });
  }

  // ── Milestones ─────────────────────────────────────────────────
  for (const ms of milestones) {
    entries.push({
      id: `milestone_${ms.id}`,
      type: 'milestone',
      date: ms.date,
      title: ms.title,
      summary: ms.description,
      icon: '\u2B50',
      accentColor: TYPE_COLORS.milestone,
      metadata: { milestone_type: ms.type },
    });
  }

  // Sort by date DESC
  entries.sort((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    return 0;
  });

  return entries;
}

// ── Milestone Detection ────────────────────────────────────────────

/**
 * Detect milestones for a person based on their hangout history and when_met date.
 */
export function detectMilestones(
  personName: string,
  whenMet: string | null,
  hangouts: Array<{ happened_at: string; activity_tags: string[] }>,
  now: Date = new Date(),
): Milestone[] {
  const milestones: Milestone[] = [];

  if (hangouts.length === 0) return milestones;

  // Sort hangouts chronologically (oldest first)
  const sorted = [...hangouts].sort((a, b) => a.happened_at.localeCompare(b.happened_at));

  // ── First hangout ──────────────────────────────────────────────
  const firstHangout = sorted[0];
  milestones.push({
    id: `milestone_first_hangout`,
    type: 'first_hangout',
    date: firstHangout.happened_at,
    title: 'First hangout',
    description: `Your first hangout with ${personName}`,
  });

  // ── First trip together ────────────────────────────────────────
  const firstTrip = sorted.find((h) => h.activity_tags.includes('travel'));
  if (firstTrip) {
    milestones.push({
      id: `milestone_first_trip`,
      type: 'first_trip',
      date: firstTrip.happened_at,
      title: 'First trip together',
      description: `Your first trip with ${personName}`,
    });
  }

  // ── Hangout count milestones ───────────────────────────────────
  const countThresholds = [10, 25, 50, 100];
  for (const threshold of countThresholds) {
    if (sorted.length >= threshold) {
      const hangoutAtThreshold = sorted[threshold - 1];
      milestones.push({
        id: `milestone_hangout_count_${threshold}`,
        type: `hangout_count_${threshold}`,
        date: hangoutAtThreshold.happened_at,
        title: `${threshold}th hangout`,
        description: `You've hung out with ${personName} ${threshold} times!`,
      });
    }
  }

  // ── Friendship anniversaries ───────────────────────────────────
  if (whenMet) {
    const metDate = new Date(whenMet);
    const yearThresholds = [1, 2, 5, 10];
    for (const years of yearThresholds) {
      const anniversary = new Date(metDate);
      anniversary.setFullYear(metDate.getFullYear() + years);
      if (anniversary <= now) {
        milestones.push({
          id: `milestone_anniversary_${years}yr`,
          type: `friendship_anniversary_${years}yr`,
          date: anniversary.toISOString().slice(0, 10),
          title: `${years} year${years > 1 ? 's' : ''} of friendship`,
          description: `You've known ${personName} for ${years} year${years > 1 ? 's' : ''}!`,
        });
      }
    }
  }

  // ── Most active month ──────────────────────────────────────────
  if (sorted.length >= 10) {
    const monthCounts = new Map<string, number>();
    for (const h of sorted) {
      const monthKey = h.happened_at.slice(0, 7); // YYYY-MM
      monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
    }
    let maxMonth = '';
    let maxCount = 0;
    for (const [month, count] of Array.from(monthCounts.entries())) {
      if (count > maxCount) {
        maxMonth = month;
        maxCount = count;
      }
    }
    if (maxMonth && maxCount >= 3) {
      milestones.push({
        id: `milestone_most_active_month`,
        type: 'most_active_month',
        date: `${maxMonth}-01`,
        title: 'Most active month',
        description: `${maxCount} hangouts in ${formatMonthYear(maxMonth)}`,
      });
    }
  }

  return milestones;
}

// ── Display Helpers ────────────────────────────────────────────────

/**
 * Get the year group label for a date string.
 */
export function getYearGroup(date: string): string {
  return date.slice(0, 4);
}

/**
 * Format a timeline date for display (e.g. "Apr 15, 2026").
 */
export function formatTimelineDate(date: string): string {
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

/**
 * Get the accent color for a timeline entry type.
 */
export function getTypeColor(type: TimelineEntryType): string {
  return TYPE_COLORS[type];
}

// ── Internal helpers ───────────────────────────────────────────────

function formatMonthYear(monthKey: string): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const [year, month] = monthKey.split('-');
  const monthIndex = parseInt(month, 10) - 1;
  return `${months[monthIndex]} ${year}`;
}
