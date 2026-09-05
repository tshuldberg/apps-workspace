'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  listPeople,
  listHangouts,
  getWeekStart,
  generateWeeklySummary,
  getAverageWeeklySocialHours,
  getSocialPattern,
  detectOverSocializing,
  detectUnderSocializing,
  generatePatternInsight,
  type WeeklySummary,
  type SocialPattern,
} from '@mylife/friends';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('friends');
  return adapter;
}

export interface InsightsData {
  summaries: WeeklySummary[];
  avgHours: number;
  pattern: SocialPattern;
  insight: string;
  isOver: boolean;
  isUnder: boolean;
}

export async function fetchInsightsData(): Promise<InsightsData> {
  try {
    const d = db();
    const people = listPeople(d, { is_archived: false });
    const hangouts = listHangouts(d, {});

    const hangoutInputs = hangouts.map((h) => ({
      happened_at: h.happened_at,
      duration_minutes: h.duration_minutes,
      people_ids: h.people_ids ?? [],
      quality_rating: h.quality_rating,
    }));

    const personInputs = people.map((p) => ({
      id: p.id,
      display_name: p.display_name,
    }));

    // Generate last 8 weeks of summaries
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const summaries: WeeklySummary[] = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const summary = generateWeeklySummary(hangoutInputs, personInputs, weekStart);
      summaries.push(summary);
    }

    const avgHours = getAverageWeeklySocialHours(summaries);
    const pattern = getSocialPattern(summaries);
    const insight = generatePatternInsight(pattern, avgHours);

    const currentMinutes = summaries[summaries.length - 1]?.totalMinutes ?? 0;
    const avgMinutes = summaries.length > 0
      ? summaries.reduce((s, w) => s + w.totalMinutes, 0) / summaries.length
      : 0;

    const isOver = detectOverSocializing(currentMinutes, avgMinutes);
    const isUnder = detectUnderSocializing(currentMinutes, avgMinutes);

    return { summaries, avgHours, pattern, insight, isOver, isUnder };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load insights.';
    throw new Error(message);
  }
}
