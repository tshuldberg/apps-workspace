import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SleepChronotypePage from '../chronotype/page';
import SleepJetLagPage from '../jet-lag/page';
import SleepShiftWorkPage from '../shift-work/page';

type Row = Record<string, unknown>;

let entryRows: Row[] = [];

const mockAdapter = {
  execute: vi.fn(),
  query: vi.fn((sql: string) => {
    if (sql.includes('sl_sleep_entries')) {
      return entryRows;
    }
    return [];
  }),
};

vi.mock('@/lib/db', () => ({
  getAdapter: () => mockAdapter,
}));

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function makeEntryRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => {
    const wakeDate = shiftDate('2026-01-03', index * 7);

    return {
      id: `entry-${index}`,
      date: wakeDate,
      bedtime: `${wakeDate}T02:30:00.000Z`,
      sleep_onset_time: `${wakeDate}T02:45:00.000Z`,
      wake_time: `${wakeDate}T10:30:00.000Z`,
      duration_minutes: 465,
      quality_rating: 4,
      wake_count: 1,
      sleep_latency_minutes: 15,
      alarm_time: null,
      snooze_count: 0,
      wake_feeling: 'refreshed',
      notes_md: null,
      created_at: `${wakeDate}T11:00:00.000Z`,
      updated_at: `${wakeDate}T11:00:00.000Z`,
    };
  }).reverse();
}

describe('MySleep web science pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entryRows = makeEntryRows(14);
  });

  it('renders the chronotype result with enough free-day entries', () => {
    render(<SleepChronotypePage />);

    expect(screen.getByText('Chronotype and circadian rhythm')).toBeInTheDocument();
    expect(screen.getByText('Night Owl')).toBeInTheDocument();
    expect(screen.getByText('Circadian profile')).toBeInTheDocument();
  });

  it('renders the jet lag tracker from query params', async () => {
    const element = await SleepJetLagPage({
      searchParams: Promise.resolve({}),
    });

    render(element);

    expect(screen.getByText('Jet lag tracker')).toBeInTheDocument();
    expect(screen.getByText('0% adjusted')).toBeInTheDocument();
    expect(screen.getByText(/3h eastward/)).toBeInTheDocument();
    expect(screen.getByText(/Try to sleep at 02:00/)).toBeInTheDocument();
  });

  it('renders shift work expected sleep window from query params', async () => {
    const element = await SleepShiftWorkPage({
      searchParams: Promise.resolve({
        date: '2026-04-06',
        start: '22:00',
        end: '06:00',
        day: '1',
      }),
    });

    render(element);

    expect(screen.getByText('Shift work mode')).toBeInTheDocument();
    expect(screen.getByText('Expected sleep')).toBeInTheDocument();
    expect(screen.getByText('07:30 - 15:30')).toBeInTheDocument();
  });
});
