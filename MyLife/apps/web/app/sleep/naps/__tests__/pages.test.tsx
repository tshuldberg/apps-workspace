import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import {
  createEntry,
  createFactor,
  createNap,
  SLEEP_MODULE,
} from '@mylife/sleep';
import SleepHygienePage from '../../hygiene/page';
import SleepNapsPage from '../page';
import SleepNapLogPage from '../log/page';

let testDb: InMemoryTestDatabase;

vi.mock('@/lib/db', () => ({
  getAdapter: () => testDb.adapter,
}));

vi.mock('../../actions', () => ({
  addSleepNapAction: vi.fn(),
  saveSleepHygieneChecksAction: vi.fn(),
  saveSleepHygienePracticesAction: vi.fn(),
}));

function seedNapAndHygieneData() {
  const entry = createEntry(testDb.adapter, {
    bedtime: '2026-04-23T22:30:00.000Z',
    sleep_onset_time: '2026-04-23T22:45:00.000Z',
    wake_time: '2026-04-24T06:30:00.000Z',
    quality_rating: 5,
    wake_count: 0,
    wake_feeling: 'refreshed',
  });
  createFactor(testDb.adapter, {
    sleep_entry_id: entry.id,
    date: entry.date,
    last_caffeine_time: '13:30',
    last_meal_time: '19:30',
    alcohol_drinks: 0,
    exercise_today: true,
    exercise_time: '17:30',
    screen_cutoff_time: '21:00',
    room_temp: 'cool',
    room_light: 'dark',
    room_noise: 'quiet',
    supplements: [],
    stress_level: 2,
    pre_sleep_activities: ['reading', 'meditation'],
  });
  createNap(testDb.adapter, {
    date: '2026-04-23',
    start_time: '2026-04-23T14:00:00.000Z',
    duration_minutes: 25,
    intentional: true,
    quality: 4,
  });
}

describe('MySleep web nap and hygiene pages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'));
    testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
    seedNapAndHygieneData();
  });

  afterEach(() => {
    testDb.close();
    vi.useRealTimers();
  });

  it('renders nap history metrics and impact insight', () => {
    render(<SleepNapsPage />);

    expect(screen.getByText('Nap Tracking')).toBeInTheDocument();
    expect(screen.getByText('Total naps')).toBeInTheDocument();
    expect(screen.getByText('Duration trend')).toBeInTheDocument();
    expect(screen.getByText('Nap impact')).toBeInTheDocument();
    expect(screen.getByText('Intentional')).toBeInTheDocument();
  });

  it('renders the nap log form', () => {
    render(<SleepNapLogPage />);

    expect(screen.getByText('Nap Log')).toBeInTheDocument();
    expect(screen.getByText('I just napped')).toBeInTheDocument();
    expect(screen.getByText("I'm about to nap")).toBeInTheDocument();
    expect(screen.getByText('Intentional nap')).toBeInTheDocument();
    expect(screen.getByText('Save Nap')).toBeInTheDocument();
  });

  it('renders hygiene checklist, weekly adherence, and settings', () => {
    render(<SleepHygienePage />);

    expect(screen.getByText('Sleep Hygiene')).toBeInTheDocument();
    expect(screen.getByText('Weekly score')).toBeInTheDocument();
    expect(screen.getAllByText('No caffeine after 2pm').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Relaxation routine').length).toBeGreaterThan(0);
    expect(screen.getByText('Save Practices')).toBeInTheDocument();
  });
});
