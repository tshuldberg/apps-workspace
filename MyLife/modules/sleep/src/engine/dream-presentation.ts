import type {
  Dream,
  DreamType,
} from '../models/dream-schemas';
import { indexDream } from './dream-search';

export const DREAM_EMOTION_OPTIONS = [
  'happy',
  'anxious',
  'scared',
  'confused',
  'peaceful',
  'excited',
  'sad',
  'angry',
] as const;

export type DreamEmotionOption = (typeof DREAM_EMOTION_OPTIONS)[number];

export interface DreamFilterState {
  query?: string;
  type?: DreamType | null;
  theme?: string | null;
  emotion?: string | null;
  lucidOnly?: boolean;
  recurringOnly?: boolean;
}

export interface DreamTimelineSection {
  monthKey: string;
  label: string;
  dreams: Dream[];
}

export interface DreamTypeMeta {
  label: string;
  tone: DreamType;
}

type DreamRecurringComparable = Pick<
  Dream,
  'id' | 'is_recurring' | 'recurring_group_id'
>;

function normalizeComparable(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function compareDreamsNewestFirst(a: Dream, b: Dream): number {
  if (a.date !== b.date) {
    return a.date < b.date ? 1 : -1;
  }
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? 1 : -1;
  }
  return a.id.localeCompare(b.id);
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .toLocaleLowerCase()
    .replace(/"/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function getComparableDreamText(dream: Dream): string {
  return [
    indexDream(dream).searchable_text,
    dream.emotions.join(' ').toLocaleLowerCase(),
  ]
    .filter(Boolean)
    .join(' ');
}

function getMonthKey(date: string): string {
  return date.slice(0, 7);
}

function getMonthDistance(monthKey: string, reference: Date): number {
  const [year, month] = monthKey.split('-').map(Number);
  return (
    (reference.getUTCFullYear() - year) * 12 +
    (reference.getUTCMonth() + 1 - month)
  );
}

function formatMonthLabel(monthKey: string, reference: Date): string {
  const distance = getMonthDistance(monthKey, reference);
  if (distance === 0) {
    return 'This Month';
  }
  if (distance === 1) {
    return 'Last Month';
  }

  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function getDreamTypeMeta(type: DreamType): DreamTypeMeta {
  switch (type) {
    case 'vivid':
      return { label: 'Vivid', tone: 'vivid' };
    case 'nightmare':
      return { label: 'Nightmare', tone: 'nightmare' };
    case 'lucid':
      return { label: 'Lucid', tone: 'lucid' };
    case 'recurring':
      return { label: 'Recurring', tone: 'recurring' };
    case 'normal':
    default:
      return { label: 'Normal', tone: 'normal' };
  }
}

export function getRecurringDreamGroupId(
  dream: DreamRecurringComparable,
): string | null {
  return dream.recurring_group_id ?? (dream.is_recurring ? dream.id : null);
}

export function getDreamExcerpt(
  contentMd: string,
  maxLength: number = 160,
): string {
  const stripped = stripMarkdown(contentMd);
  if (stripped.length <= maxLength) {
    return stripped;
  }
  return `${stripped.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildDreamTimelineSections(
  dreams: Dream[],
  referenceDate: Date = new Date(),
): DreamTimelineSection[] {
  if (dreams.length === 0) {
    return [];
  }

  const sorted = [...dreams].sort(compareDreamsNewestFirst);
  const sections = new Map<string, Dream[]>();

  for (const dream of sorted) {
    const key = getMonthKey(dream.date);
    const bucket = sections.get(key);
    if (bucket) {
      bucket.push(dream);
    } else {
      sections.set(key, [dream]);
    }
  }

  return [...sections.entries()].map(([monthKey, monthDreams]) => ({
    monthKey,
    label: formatMonthLabel(monthKey, referenceDate),
    dreams: monthDreams,
  }));
}

export function filterDreams(
  dreams: Dream[],
  filters: DreamFilterState = {},
): Dream[] {
  const queryTokens = tokenizeQuery(filters.query ?? '');
  const theme = normalizeComparable(filters.theme);
  const emotion = normalizeComparable(filters.emotion);

  return dreams.filter((dream) => {
    if (filters.type && dream.type !== filters.type) {
      return false;
    }
    if (theme && !dream.themes.some((value) => normalizeComparable(value) === theme)) {
      return false;
    }
    if (
      emotion &&
      !dream.emotions.some((value) => normalizeComparable(value) === emotion)
    ) {
      return false;
    }
    if (filters.lucidOnly && !dream.is_lucid) {
      return false;
    }
    if (filters.recurringOnly && !dream.is_recurring) {
      return false;
    }
    if (queryTokens.length > 0) {
      const haystack = getComparableDreamText(dream);
      if (!queryTokens.every((token) => haystack.includes(token))) {
        return false;
      }
    }
    return true;
  });
}

export function getDreamPeopleSuggestions(
  dreams: Dream[],
  limit: number = 8,
): string[] {
  const people = new Map<string, { value: string; count: number }>();

  for (const dream of dreams) {
    for (const person of dream.people) {
      const key = normalizeComparable(person);
      if (!key) {
        continue;
      }

      const existing = people.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        people.set(key, { value: person, count: 1 });
      }
    }
  }

  return [...people.values()]
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return a.value.localeCompare(b.value);
    })
    .slice(0, limit)
    .map((entry) => entry.value);
}

export function findRecurringDreamCandidates(
  draft: Pick<Dream, 'content_md' | 'themes'>,
  dreams: Dream[],
  limit: number = 4,
): Dream[] {
  const baseThemes = new Set(draft.themes.map((theme) => normalizeComparable(theme)));
  const queryTokens = tokenizeQuery(draft.content_md);
  const latestByGroup = new Map<string, Dream>();

  for (const dream of dreams) {
    const groupId = getRecurringDreamGroupId(dream);
    if (!groupId) {
      continue;
    }

    const existing = latestByGroup.get(groupId);
    if (!existing || compareDreamsNewestFirst(dream, existing) < 0) {
      latestByGroup.set(groupId, dream);
    }
  }

  const ranked = [...latestByGroup.values()]
    .map((dream) => {
      const normalizedThemes = dream.themes.map((theme) => normalizeComparable(theme));
      const themeOverlap = normalizedThemes.filter((theme) => baseThemes.has(theme))
        .length;
      const searchableText = getComparableDreamText(dream);
      const tokenMatches = queryTokens.reduce((count, token) => {
        return count + (searchableText.includes(token) ? 1 : 0);
      }, 0);

      return {
        dream,
        score: themeOverlap * 10 + tokenMatches,
        themeOverlap,
        tokenMatches,
      };
    })
    .filter((entry) => {
      if (baseThemes.size === 0 && queryTokens.length === 0) {
        return true;
      }
      return entry.themeOverlap > 0 || entry.tokenMatches > 0;
    })
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return compareDreamsNewestFirst(a.dream, b.dream);
    });

  return ranked.slice(0, limit).map((entry) => entry.dream);
}

export function findRelatedDreams(
  dream: Dream,
  dreams: Dream[],
  limit: number = 4,
): Dream[] {
  const baseRecurringGroupId = getRecurringDreamGroupId(dream);
  const baseThemes = new Set(dream.themes.map((theme) => normalizeComparable(theme)));

  return dreams
    .filter((candidate) => candidate.id !== dream.id)
    .map((candidate) => {
      const candidateRecurringGroupId = getRecurringDreamGroupId(candidate);
      const recurringMatch =
        Boolean(baseRecurringGroupId) &&
        baseRecurringGroupId === candidateRecurringGroupId;
      const themeOverlap = candidate.themes.reduce((count, theme) => {
        return count + (baseThemes.has(normalizeComparable(theme)) ? 1 : 0);
      }, 0);

      return {
        candidate,
        recurringMatch,
        score: (recurringMatch ? 1_000 : 0) + themeOverlap * 100,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (a.recurringMatch !== b.recurringMatch) {
        return a.recurringMatch ? -1 : 1;
      }
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return compareDreamsNewestFirst(a.candidate, b.candidate);
    })
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
