import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SLEEP_MODULE } from '@mylife/sleep';
import SleepSettingsScreen from '../settings';

let testDb: InMemoryTestDatabase;

vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 'default' },
  AndroidNotificationVisibility: { PUBLIC: 'public' },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  cancelScheduledNotificationAsync: vi.fn(),
  getPermissionsAsync: vi.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true, status: 'granted' })),
  scheduleNotificationAsync: vi.fn(async () => 'notification-id'),
  setNotificationChannelAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///tmp/',
  writeAsStringAsync: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(),
}));

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

describe('SleepSettingsScreen', () => {
  beforeEach(() => {
    testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
  });

  afterEach(() => {
    testDb.close();
  });

  it('renders target and bedtime reminder settings', () => {
    render(<SleepSettingsScreen />);

    expect(screen.getByText('Target hours')).toBeInTheDocument();
    expect(screen.getByText('Wind-down nudge')).toBeInTheDocument();
    expect(screen.getByText('Export for Therapist')).toBeInTheDocument();
    expect(screen.getByText('Sleep restriction tracking')).toBeInTheDocument();
    expect(screen.getByText('Bedtime reminder is off.')).toBeInTheDocument();
    expect(screen.getByText('Save Settings')).toBeInTheDocument();
  });
});
