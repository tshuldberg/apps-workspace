import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SleepInsightsPage from '../page';

type Row = Record<string, unknown>;

let entryRows: Row[] = [];
let factorRows: Row[] = [];

const mockAdapter = {
  execute: vi.fn(),
  query: vi.fn((sql: string) => {
    if (sql.includes('hub_enabled_modules')) {
      return [{ count: 2 }];
    }
    if (sql.includes('sleep_daily')) {
      return makeMoodPairRows(entryRows);
    }
    if (sql.includes('FROM hb_habits')) {
      return makeHabitRows();
    }
    if (sql.includes('completed_habit_count')) {
      return makeHabitAdherenceRows(entryRows);
    }
    if (sql.includes('sl_settings')) {
      return [{ value: '8' }];
    }
    if (sql.includes('sl_sleep_entries')) {
      return entryRows;
    }
    if (sql.includes('sl_factors')) {
      return factorRows;
    }
    return [];
  }),
};

vi.mock('@/lib/db', () => ({
  ensureModuleMigrations: vi.fn(),
  getAdapter: () => mockAdapter,
}));

vi.mock('../SleepInsightsCharts', () => ({
  SleepInsightsLineChart: ({
    title,
  }: {
    title: string;
  }) => <section>{title}</section>,
}));

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function makeEntryRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => {
    const wakeDate = shiftDate('2026-04-01', index);
    const bedDate = shiftDate(wakeDate, -1);
    const strongNight = index % 2 === 0;

    return {
      id: `entry-${index}`,
      date: wakeDate,
      bedtime: `${bedDate}T22:30:00.000Z`,
      sleep_onset_time: `${bedDate}T22:45:00.000Z`,
      wake_time: `${wakeDate}T06:30:00.000Z`,
      duration_minutes: strongNight ? 500 : 420,
      quality_rating: strongNight ? 5 : 3,
      wake_count: strongNight ? 1 : 3,
      sleep_latency_minutes: 15,
      alarm_time: null,
      snooze_count: 0,
      wake_feeling: strongNight ? 'refreshed' : 'groggy',
      notes_md: null,
      created_at: `${wakeDate}T07:00:00.000Z`,
      updated_at: `${wakeDate}T07:00:00.000Z`,
    };
  }).reverse();
}

function makeFactorRows(entries: Row[]): Row[] {
  return entries.map((entry, index) => {
    const strongNight = index % 2 === 0;

    return {
      id: `factor-${entry.id}`,
      sleep_entry_id: entry.id,
      date: entry.date,
      last_caffeine_time: strongNight ? '13:00' : '19:00',
      last_meal_time: '18:30',
      alcohol_drinks: strongNight ? 0 : 1,
      exercise_today: strongNight ? 1 : 0,
      exercise_time: strongNight ? '17:00' : null,
      screen_cutoff_time: strongNight ? '21:00' : '22:20',
      room_temp: 'cool',
      room_light: 'dark',
      room_noise: 'quiet',
      supplements: '[]',
      stress_level: strongNight ? 2 : 5,
      pre_sleep_activities: JSON.stringify(strongNight ? ['reading'] : ['screen_time']),
      notes: null,
      created_at: `${entry.date}T20:00:00.000Z`,
    };
  });
}

function makeMoodPairRows(entries: Row[]): Row[] {
  return entries
    .map((entry) => {
      const quality = Number(entry.quality_rating);
      return {
        date: entry.date,
        sleep_quality: quality,
        mood_score: quality >= 4 ? 8 : 3,
        sleep_entry_count: 1,
        mood_entry_count: 1,
      };
    })
    .reverse();
}

function makeHabitRows(): Row[] {
  return [
    {
      id: 'habit-wind-down',
      name: 'Wind down routine',
      time_of_day: 'evening',
      habit_type: 'standard',
      target_count: 1,
    },
  ];
}

function makeHabitAdherenceRows(entries: Row[]): Row[] {
  return entries
    .map((entry) => {
      const quality = Number(entry.quality_rating);
      return {
        sleep_date: entry.date,
        routine_date: String(entry.bedtime).slice(0, 10),
        sleep_quality: quality,
        completed_habit_count: quality >= 4 ? 1 : 0,
      };
    })
    .reverse();
}

describe('SleepInsightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entryRows = makeEntryRows(18);
    factorRows = makeFactorRows(entryRows);
  });

  it('renders the full insights dashboard when the selected range has 14+ nights', async () => {
    const element = await SleepInsightsPage({
      searchParams: Promise.resolve({}),
    });

    render(element);

    expect(screen.getByText('This Week Summary')).toBeInTheDocument();
    expect(screen.getByText('Efficiency')).toBeInTheDocument();
    expect(screen.getByText('Duration Trend')).toBeInTheDocument();
    expect(screen.getByText('Quality Trend')).toBeInTheDocument();
    expect(screen.getByText('Factor Insights')).toBeInTheDocument();
    expect(screen.getByText('Mood Bridge')).toBeInTheDocument();
    expect(screen.getByText('Habits Bridge')).toBeInTheDocument();
    expect(screen.getByText('Health Bridge Preview')).toBeInTheDocument();
    expect(screen.getByText('Optimal Window')).toBeInTheDocument();
    expect(screen.getByText('Weekend vs Weekday')).toBeInTheDocument();
  });

  it('shows progress copy before 7 nights are available', async () => {
    entryRows = makeEntryRows(4);
    factorRows = makeFactorRows(entryRows);

    const element = await SleepInsightsPage({
      searchParams: Promise.resolve({ range: 'all' }),
    });

    render(element);

    expect(
      screen.getByText('Log 3 more nights to unlock insights'),
    ).toBeInTheDocument();
  });
});
