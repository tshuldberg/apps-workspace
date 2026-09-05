import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HabitsTodayScreen from '../(tabs)/index';

const mockDb = { id: 'mock-db', execute: vi.fn(), query: vi.fn(() => []) };
const pushMock = vi.fn();

const deleteCompletionMock = vi.fn();
const deleteMeasurementMock = vi.fn();
const deleteSessionMock = vi.fn();
const endSessionMock = vi.fn();
const getAllSobrietyProfilesMock = vi.fn();
const getAreasMock = vi.fn();
const getCompletionsForDateMock = vi.fn();
const getFreezesInMonthMock = vi.fn();
const getHabitsMock = vi.fn();
const getMeasurementsForDateMock = vi.fn();
const getMeasurableStreaksMock = vi.fn();
const getNegativeStreaksMock = vi.fn();
const getPetStateMock = vi.fn();
const getPlayerProfileMock = vi.fn();
const getSessionsForDateMock = vi.fn();
const getSleepRoutineContextMock = vi.fn();
const getStreaksMock = vi.fn();
const recordCompletionMock = vi.fn();
const recordMeasurementMock = vi.fn();
const startSessionMock = vi.fn();

vi.mock('@mylife/habits', async () => {
  return {
    deleteCompletion: (...args: unknown[]) => deleteCompletionMock(...args),
    deleteMeasurement: (...args: unknown[]) => deleteMeasurementMock(...args),
    deleteSession: (...args: unknown[]) => deleteSessionMock(...args),
    endSession: (...args: unknown[]) => endSessionMock(...args),
    getAllSobrietyProfiles: (...args: unknown[]) => getAllSobrietyProfilesMock(...args),
    getAreas: (...args: unknown[]) => getAreasMock(...args),
    getCompletionsForDate: (...args: unknown[]) => getCompletionsForDateMock(...args),
    getFreezesInMonth: (...args: unknown[]) => getFreezesInMonthMock(...args),
    getHabits: (...args: unknown[]) => getHabitsMock(...args),
    getMeasurementsForDate: (...args: unknown[]) => getMeasurementsForDateMock(...args),
    getMeasurableStreaks: (...args: unknown[]) => getMeasurableStreaksMock(...args),
    getNegativeStreaks: (...args: unknown[]) => getNegativeStreaksMock(...args),
    getPetState: (...args: unknown[]) => getPetStateMock(...args),
    getPlayerProfile: (...args: unknown[]) => getPlayerProfileMock(...args),
    getSessionsForDate: (...args: unknown[]) => getSessionsForDateMock(...args),
    getSleepRoutineContext: (...args: unknown[]) => getSleepRoutineContextMock(...args),
    getStreaks: (...args: unknown[]) => getStreaksMock(...args),
    recordCompletion: (...args: unknown[]) => recordCompletionMock(...args),
    recordMeasurement: (...args: unknown[]) => recordMeasurementMock(...args),
    startSession: (...args: unknown[]) => startSessionMock(...args),
    GlassCard: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    HabitRow: ({
      habit,
      checked,
      onCheck,
      onPress,
    }: {
      habit: { name: string; habitType: string };
      checked?: boolean;
      onCheck?: () => void;
      onPress?: () => void;
    }) => (
      <div>
        {habit.habitType === 'standard' ? (
          <button aria-checked={checked} onClick={onCheck} role="checkbox" />
        ) : (
          <button onClick={onCheck} type="button">Action</button>
        )}
        <button onClick={onPress} type="button">{habit.name}</button>
      </div>
    ),
    MaterialSymbol: ({ name }: { name: string }) => <span>{name}</span>,
    PetAvatar: ({ pet }: { pet: { name: string } }) => <div>{pet.name}</div>,
    SectionHeader: ({ title }: { title: string }) => <div>{title}</div>,
    StreakFlame: ({ count }: { count: number }) => <div>{count}</div>,
    XPBar: ({ current, max }: { current: number; max: number }) => <div>{current}/{max}</div>,
    calculatePetMood: () => 'happy',
    getXPProgress: () => ({ level: 2, currentXP: 20, neededXP: 100 }),
    remainingFreezes: () => 2,
    HB_ACCENT: '#8B5CF6',
    HB_ACCENT_LIGHT: '#A78BFA',
    HB_AREAS: {
      health: '#30D158',
      mind: '#A78BFA',
      body: '#FFB4AB',
      money: '#84CC16',
      social: '#FFB877',
      spiritual: '#C4B5FD',
      learning: '#8BCFF0',
      other: '#9F8E81',
    },
    HB_STREAK: { legendary: '#A78BFA', fire: '#FFB877' },
    HB_SURFACES: { lowest: '#0E0E13', low: '#1B1B20' },
    HB_TEXT: '#E4E1E9',
    HB_TEXT_SECONDARY: 'rgba(228,225,233,0.72)',
    HB_TEXT_TERTIARY: '#9F8E81',
    HB_TYPOGRAPHY: {
      labelUpper: { fontFamily: 'PlusJakartaSans-SemiBold' },
      headlineMd: { fontFamily: 'PlusJakartaSans-Bold' },
      bodyMd: { fontFamily: 'PlusJakartaSans-Regular' },
      streakDisplay: { fontFamily: 'PlusJakartaSans-ExtraBold' },
    },
    withAlpha: (_hex: string, _alpha: number) => 'rgba(0,0,0,0.5)',
  };
});

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

vi.mock('../../../lib/uuid', () => ({
  uuid: () => 'uuid-123',
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => pushMock(...args),
  }),
}));

describe('HabitsTodayScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getHabitsMock.mockReturnValue([
      {
        id: 'habit-1',
        name: 'Drink Water',
        description: null,
        icon: null,
        color: null,
        frequency: 'daily',
        targetCount: 1,
        unit: null,
        habitType: 'standard',
        timeOfDay: 'morning',
        specificDays: null,
        gracePeriod: 0,
        reminderTime: null,
        areaId: 'area-health',
        startDate: null,
        endDate: null,
        isArchived: false,
        sortOrder: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    getAreasMock.mockReturnValue([
      {
        id: 'area-health',
        name: 'Health',
        icon: 'favorite',
        color: '#30D158',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    getCompletionsForDateMock.mockReturnValue([]);
    getMeasurementsForDateMock.mockReturnValue([]);
    getSessionsForDateMock.mockReturnValue([]);
    getStreaksMock.mockReturnValue({ currentStreak: 5, longestStreak: 9 });
    getMeasurableStreaksMock.mockReturnValue({ currentStreak: 0, longestStreak: 0 });
    getNegativeStreaksMock.mockReturnValue({ daysSinceLastSlip: 0, longestCleanStreak: 0 });
    getPlayerProfileMock.mockReturnValue({
      id: 'player',
      totalXP: 120,
      currentLevel: 2,
      gamificationEnabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    getPetStateMock.mockReturnValue({
      id: 'pet',
      name: 'Nova',
      species: 'fox',
      equippedItems: [],
      daysTogether: 12,
      totalHabitsCompleted: 42,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    getSleepRoutineContextMock.mockReturnValue({
      sleepDate: '2026-01-06',
      routineDate: '2026-01-05',
      durationMinutes: 420,
      durationHours: 7,
      qualityRating: 4,
      routineHabitCount: 1,
      completedRoutineCount: 1,
      completionRate: 100,
      context: 'Sleep context: 7h, quality 4/5 after 1 of 1 bedtime routine habits.',
    });
    getFreezesInMonthMock.mockReturnValue([]);
    getAllSobrietyProfilesMock.mockReturnValue([]);
  });

  it('renders the new today layout', () => {
    render(<HabitsTodayScreen />);

    expect(screen.getByText('day streak')).toBeInTheDocument();
    expect(screen.getByText('Sleep routine context')).toBeInTheDocument();
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Daily insight')).toBeInTheDocument();
  });

  it('records a completion when a standard habit is checked', () => {
    render(<HabitsTodayScreen />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(recordCompletionMock).toHaveBeenCalledWith(
      mockDb,
      'uuid-123',
      'habit-1',
      expect.any(String),
      1,
    );
  });

  it('navigates from quick actions', () => {
    render(<HabitsTodayScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Focus Timer/i }));

    expect(pushMock).toHaveBeenCalledWith('/(habits)/focus-timer');
  });
});
