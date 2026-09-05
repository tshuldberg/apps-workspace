import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { createEntry, createGoal, SLEEP_MODULE } from '@mylife/sleep';
import SleepGoalsScreen from '../goals';

let testDb: InMemoryTestDatabase;

vi.mock('expo-router', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    useFocusEffect: (effect: () => void) => {
      React.useEffect(() => {
        effect();
      }, [effect]);
    },
    useRouter: () => ({
      push: vi.fn(),
    }),
  };
});

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => testDb.adapter,
}));

function pad(day: number): string {
  return String(day).padStart(2, '0');
}

describe('SleepGoalsScreen', () => {
  beforeEach(() => {
    testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
    createGoal(testDb.adapter, {
      type: 'duration',
      target_value: 8,
      start_date: '2026-04-01',
    });

    for (let day = 1; day <= 7; day += 1) {
      createEntry(testDb.adapter, {
        bedtime: `2026-04-${pad(day)}T22:30:00Z`,
        wake_time: `2026-04-${pad(day + 1)}T06:45:00Z`,
        quality_rating: day % 2 === 0 ? 3 : 5,
        wake_count: 1,
        snooze_count: day % 2 === 0 ? 1 : 0,
        wake_feeling: day % 2 === 0 ? 'groggy' : 'refreshed',
      });
    }
  });

  afterEach(() => {
    testDb.close();
  });

  it('renders goals, weekly progress, and streak cards', () => {
    render(<SleepGoalsScreen />);

    expect(screen.getByText('Weekly accountability')).toBeInTheDocument();
    expect(screen.getByText('Set a goal')).toBeInTheDocument();
    expect(screen.getByText('Active Goals')).toBeInTheDocument();
    expect(screen.getAllByText('Target hours')[0]).toBeInTheDocument();
    expect(screen.getByText('Streaks')).toBeInTheDocument();
    expect(screen.getByText('No snooze')).toBeInTheDocument();
  });
});
