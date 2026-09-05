import { Fragment, type ReactNode } from 'react';
import type {
  CreateProgressEntryRecord,
  CreateProgressMood,
} from '../models/schemas';

export interface CreateProgressMoodOption {
  value: CreateProgressMood;
  label: string;
  emoji: string;
}

export const CREATE_PROGRESS_MOOD_OPTIONS: CreateProgressMoodOption[] = [
  { value: 'focused', label: 'Focused', emoji: '🎯' },
  { value: 'flowing', label: 'Flowing', emoji: '🌊' },
  { value: 'struggling', label: 'Struggling', emoji: '🧩' },
  { value: 'grinding', label: 'Grinding', emoji: '⚙️' },
  { value: 'inspired', label: 'Inspired', emoji: '✨' },
  { value: 'frustrated', label: 'Frustrated', emoji: '⚠️' },
] as const;

export interface CreateProgressTimelineItem {
  id: string;
  rawDate: string;
  dateLabel: string;
  hoursSpent: number;
  hoursLabel: string;
  notesPreview: string | null;
  mood: CreateProgressMood | null;
  moodLabel: string | null;
  moodEmoji: string | null;
  milestone: boolean;
  milestoneName: string | null;
  breakthrough: string | null;
  roadblock: string | null;
  photoCount: number;
}

export interface CreateProgressTimelineRenderArgs {
  item: CreateProgressTimelineItem;
  index: number;
  total: number;
  isLast: boolean;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return DATE_FORMATTER.format(parsed);
}

function toNotesPreview(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/\s+/g, ' ');
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function moodOptionFor(
  mood: CreateProgressMood | null,
): CreateProgressMoodOption | null {
  if (!mood) return null;
  return CREATE_PROGRESS_MOOD_OPTIONS.find((option) => option.value === mood) ?? null;
}

export function buildCreateProgressTimeline(
  entries: CreateProgressEntryRecord[],
): CreateProgressTimelineItem[] {
  return [...entries]
    .sort((left, right) => {
      const byDate = right.date.localeCompare(left.date);
      if (byDate !== 0) return byDate;
      return right.created_at.localeCompare(left.created_at);
    })
    .map((entry) => {
      const mood = moodOptionFor(entry.mood);

      return {
        id: entry.id,
        rawDate: entry.date,
        dateLabel: formatDateLabel(entry.date),
        hoursSpent: entry.hours_spent,
        hoursLabel: `${entry.hours_spent}h`,
        notesPreview: toNotesPreview(entry.notes_md),
        mood: entry.mood,
        moodLabel: mood?.label ?? null,
        moodEmoji: mood?.emoji ?? null,
        milestone: entry.milestone,
        milestoneName: entry.milestone
          ? entry.milestone_name?.trim() || 'Milestone'
          : null,
        breakthrough: entry.breakthrough?.trim() || null,
        roadblock: entry.roadblock?.trim() || null,
        photoCount: entry.photo_ids.length,
      };
    });
}

export function ProgressTimeline({
  entries,
  emptyState = null,
  renderItem,
}: {
  entries: CreateProgressEntryRecord[];
  emptyState?: ReactNode;
  renderItem: (args: CreateProgressTimelineRenderArgs) => ReactNode;
}) {
  const items = buildCreateProgressTimeline(entries);
  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {renderItem({
            item,
            index,
            total: items.length,
            isLast: index === items.length - 1,
          })}
        </Fragment>
      ))}
    </>
  );
}
