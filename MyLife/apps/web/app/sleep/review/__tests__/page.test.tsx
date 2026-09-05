import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import {
  createDream,
  createEntry,
  createNap,
  SLEEP_MODULE,
} from '@mylife/sleep';
import SleepYearReviewPage from '../[year]/page';

let testDb: InMemoryTestDatabase;

vi.mock('@/lib/db', () => ({
  getAdapter: () => testDb.adapter,
}));

function seedReviewData() {
  createEntry(testDb.adapter, {
    bedtime: '2026-01-01T22:30:00.000Z',
    sleep_onset_time: '2026-01-01T22:45:00.000Z',
    wake_time: '2026-01-02T06:45:00.000Z',
    quality_rating: 4,
    wake_count: 1,
    sleep_latency_minutes: 15,
    wake_feeling: 'refreshed',
  });
  createEntry(testDb.adapter, {
    bedtime: '2026-01-02T22:20:00.000Z',
    sleep_onset_time: '2026-01-02T22:35:00.000Z',
    wake_time: '2026-01-03T06:50:00.000Z',
    quality_rating: 5,
    wake_count: 0,
    sleep_latency_minutes: 15,
    wake_feeling: 'energized',
  });
  createDream(testDb.adapter, {
    date: '2026-01-02',
    content_md: 'A private dream about waves.',
    type: 'lucid',
    themes: ['water'],
    emotions: ['calm'],
    is_lucid: true,
  });
  createNap(testDb.adapter, {
    date: '2026-01-02',
    start_time: '2026-01-02T14:00:00.000Z',
    duration_minutes: 25,
    intentional: true,
    quality: 4,
  });
}

describe('MySleep web year review page', () => {
  beforeEach(() => {
    testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
    seedReviewData();
  });

  afterEach(() => {
    testDb.close();
  });

  it('renders annual review and privacy-safe share card', async () => {
    const element = await SleepYearReviewPage({
      params: Promise.resolve({ year: '2026' }),
    });

    render(element);

    expect(screen.getByText('2026 MySleep review')).toBeInTheDocument();
    expect(screen.getAllByText('Total hours').length).toBeGreaterThan(0);
    expect(screen.getByText('Month highlights')).toBeInTheDocument();
    expect(screen.getByText('Dreams and naps')).toBeInTheDocument();
    expect(screen.getByText('2026 Year in Review')).toBeInTheDocument();
    expect(screen.queryByText(/private dream/i)).not.toBeInTheDocument();
  });
});
