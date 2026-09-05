import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InsightsPage from '../page';

vi.mock('@mylife/mood', () => ({
  generateInsights: vi.fn(() => []),
}));

const reportableCorrelation = {
  correlation: 1,
  insight: 'Your mood averages 8.0/10 after nights with quality 4+, vs 3.0/10 after lower-quality sleep.',
  sampleSize: 7,
  status: 'reportable' as const,
  goodSleepAverageMood: 8,
  lowerQualitySleepAverageMood: 3,
  highMoodAverageSleepQuality: 5,
  lowMoodAverageSleepQuality: 2,
  pairs: [],
};

vi.mock('../../actions', () => ({
  fetchEntryCount: vi.fn(async () => 7),
  fetchSleepMoodCorrelation: vi.fn(async () => reportableCorrelation),
  fetchLastNightSleepContext: vi.fn(async () => ({
    date: '2026-04-24',
    durationMinutes: 420,
    durationHours: 7,
    qualityRating: 4,
    wakeFeeling: 'refreshed',
    context: 'Sleep context: 7h, quality 4/5',
  })),
  fetchEntries: vi.fn(async () => []),
  fetchActivityCorrelations: vi.fn(async () => []),
  fetchDailyAverages: vi.fn(async () => []),
  fetchTopEmotions: vi.fn(async () => []),
  fetchEmotionTagsForEntry: vi.fn(async () => []),
  fetchActivitiesForEntry: vi.fn(async () => []),
}));

describe('Mood insights sleep bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sleep correlation and last-night context before full mood insights unlock', async () => {
    render(<InsightsPage />);

    expect(await screen.findByText('Sleep and Mood')).toBeInTheDocument();
    expect(screen.getByText(reportableCorrelation.insight)).toBeInTheDocument();
    expect(screen.getByText('Sleep context: 7h, quality 4/5')).toBeInTheDocument();
  });
});
