import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { createEntry, SLEEP_MODULE } from '@mylife/sleep';
import SleepChronotypeScreen from '../science/chronotype';
import SleepJetLagScreen from '../science/jet-lag';
import SleepShiftWorkScreen from '../science/shift-work';

let testDb: InMemoryTestDatabase;

vi.mock('expo-router', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    useFocusEffect: (effect: () => void) => {
      React.useEffect(() => {
        effect();
      }, [effect]);
    },
  };
});

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => testDb.adapter,
}));

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function seedWeekendEntries(count: number) {
  for (let index = 0; index < count; index += 1) {
    const wakeDate = shiftDate('2026-01-03', index * 7);
    createEntry(testDb.adapter, {
      bedtime: `${wakeDate}T02:30:00.000Z`,
      sleep_onset_time: `${wakeDate}T02:45:00.000Z`,
      wake_time: `${wakeDate}T10:30:00.000Z`,
      quality_rating: 4,
      wake_count: 1,
      sleep_latency_minutes: 15,
      wake_feeling: 'refreshed',
    });
  }
}

describe('MySleep science screens', () => {
  beforeEach(() => {
    testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
  });

  afterEach(() => {
    testDb.close();
    vi.useRealTimers();
  });

  it('renders the chronotype result when enough free-day entries exist', () => {
    seedWeekendEntries(14);

    render(<SleepChronotypeScreen />);

    expect(screen.getByText('Chronotype and circadian rhythm')).toBeInTheDocument();
    expect(screen.getByText('Night Owl')).toBeInTheDocument();
    expect(screen.getByText('Circadian profile')).toBeInTheDocument();
  });

  it('renders jet lag adjustment controls and recommendation output', () => {
    render(<SleepJetLagScreen />);

    expect(screen.getByText('Jet lag tracker')).toBeInTheDocument();
    expect(screen.getByText('0% adjusted')).toBeInTheDocument();
    expect(screen.getByText(/3h eastward/)).toBeInTheDocument();
    expect(screen.getByText(/Try to sleep at 02:00/)).toBeInTheDocument();
  });

  it('renders shift work setup and expected sleep window', () => {
    // Pin "today" to a Monday so the screen's default Mon-Fri active shift days
    // include the auto-selected current date; otherwise this fails whenever CI
    // runs on a weekend (the screen shows "does not match the active shift
    // days"). Fake only Date so React's scheduler is untouched; afterEach
    // restores real timers. Scoped to this test so the chronotype test keeps
    // real "today" (it must fall after its seeded 14-week entry range).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-05T12:00:00.000Z'));

    render(<SleepShiftWorkScreen />);

    expect(screen.getByText('Shift work mode')).toBeInTheDocument();
    expect(screen.getByText('Expected sleep')).toBeInTheDocument();
    expect(screen.getByText('07:30 - 15:30')).toBeInTheDocument();
  });
});
