import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkoutsScreen from '../(tabs)/index';

const mockDb = { id: 'mock-db' };
const pushMock = vi.fn();

const seedWorkoutExerciseLibraryMock = vi.fn();
const getWorkoutDashboardMock = vi.fn();
const getWorkoutExercisesMock = vi.fn();
const getWorkoutPlansMock = vi.fn();
const getWorkoutSessionsMock = vi.fn();
const getWorkoutsMock = vi.fn();
const getActivePlanSubscriptionMock = vi.fn();
const getBestToTrainMock = vi.fn();
const getCurrentPlanPositionMock = vi.fn();
const getSetWeightsForSessionMock = vi.fn();
const getTodaysWorkoutMock = vi.fn();
const buildRecoveryMapMock = vi.fn();

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useFocusEffect: () => {},
}));

vi.mock('@mylife/ui', () => ({
  EmptyState: ({
    title,
    message,
    actionLabel,
  }: {
    title: string;
    message?: string;
    actionLabel?: string;
  }) => (
    <div>
      <span>{title}</span>
      {message ? <span>{message}</span> : null}
      {actionLabel ? <button type="button">{actionLabel}</button> : null}
    </div>
  ),
  ErrorState: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock('../(tabs)/_screen-kit', () => ({
  WorkoutTabScrollView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  WorkoutHero: ({
    eyebrow,
    title,
    subtitle,
  }: {
    eyebrow: string;
    title: string;
    subtitle?: string;
  }) => (
    <div>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
  WorkoutSectionHeader: ({
    title,
    actionLabel,
  }: {
    title: string;
    actionLabel?: string;
  }) => (
    <div>
      <span>{title}</span>
      {actionLabel ? <button type="button">{actionLabel}</button> : null}
    </div>
  ),
  formatDateLabel: (value: string | null | undefined) => value ?? 'Not scheduled',
  formatDeltaPercent: (value: number | null) => (value == null ? 'No prior period' : `${value}%`),
  formatMinutes: (value: number) => `${value}m`,
  formatVolume: (value: number) => String(value),
  getDeltaTint: () => '#30D158',
}));

vi.mock('@mylife/workouts', () => ({
  AsymmetricGrid: ({
    left,
    right,
  }: {
    left?: React.ReactNode;
    right?: React.ReactNode;
  }) => (
    <div>
      {left}
      {right}
    </div>
  ),
  BarChart: ({ data }: { data: Array<{ label: string }> }) => (
    <div>
      {data.map((item) => (
        <span key={item.label}>{item.label}</span>
      ))}
    </div>
  ),
  GlassPanel: ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
  }) => (
    <div onClick={onPress}>{children}</div>
  ),
  MaterialSymbol: ({ name }: { name: string }) => <span>{name}</span>,
  SectionLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  StartWorkoutFAB: ({ onPress }: { onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      Start Workout
    </button>
  ),
  StatCard: ({
    label,
    value,
    footer,
  }: {
    label: string;
    value: string | number;
    footer?: React.ReactNode;
  }) => (
    <div>
      <span>{label}</span>
      <span>{String(value)}</span>
      {footer}
    </div>
  ),
  WK_ACCENT: '#C9894D',
  WK_ACCENT_LIGHT: '#F5C38F',
  WK_CATEGORY_COLORS: {
    recovery: '#30D158',
    hypertrophy: '#EF4444',
  },
  WK_FONTS: {
    medium: 'PlusJakartaSans-Medium',
    semiBold: 'PlusJakartaSans-SemiBold',
    bold: 'PlusJakartaSans-Bold',
    extraBold: 'PlusJakartaSans-ExtraBold',
  },
  WK_SURFACES: {
    low: '#12121A',
    high: '#1A1A24',
    highest: '#21212D',
  },
  MUSCLE_GROUP_LABELS: {
    chest: 'Chest',
    back: 'Back',
    legs: 'Legs',
  },
  buildRecoveryMap: (...args: unknown[]) => buildRecoveryMapMock(...args),
  getActivePlanSubscription: (...args: unknown[]) => getActivePlanSubscriptionMock(...args),
  getBestToTrain: (...args: unknown[]) => getBestToTrainMock(...args),
  getCurrentPlanPosition: (...args: unknown[]) => getCurrentPlanPositionMock(...args),
  getSetWeightsForSession: (...args: unknown[]) => getSetWeightsForSessionMock(...args),
  getTodaysWorkout: (...args: unknown[]) => getTodaysWorkoutMock(...args),
  getWorkoutDashboard: (...args: unknown[]) => getWorkoutDashboardMock(...args),
  getWorkoutExercises: (...args: unknown[]) => getWorkoutExercisesMock(...args),
  getWorkoutPlans: (...args: unknown[]) => getWorkoutPlansMock(...args),
  getWorkoutSessions: (...args: unknown[]) => getWorkoutSessionsMock(...args),
  getWorkouts: (...args: unknown[]) => getWorkoutsMock(...args),
  seedWorkoutExerciseLibrary: (...args: unknown[]) => seedWorkoutExerciseLibraryMock(...args),
}));

describe('WorkoutsScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    seedWorkoutExerciseLibraryMock.mockReturnValue(undefined);
    getWorkoutDashboardMock.mockReturnValue({
      workouts: 4,
      exercises: 50,
      sessions: 12,
      streakDays: 5,
      totalMinutes30d: 310,
    });
    getWorkoutExercisesMock.mockReturnValue([
      {
        id: 'ex-1',
        name: 'Back Squat',
        muscleGroups: ['legs'],
      },
      {
        id: 'ex-2',
        name: 'Bent Over Row',
        muscleGroups: ['back'],
      },
    ]);
    getWorkoutPlansMock.mockReturnValue([]);
    getWorkoutSessionsMock.mockReturnValue([
      {
        id: 'session-1',
        workoutId: 'wk-1',
        startedAt: '2026-04-06T09:00:00.000Z',
        completedAt: '2026-04-06T10:00:00.000Z',
        exercisesCompleted: [
          {
            exerciseId: 'ex-1',
            setsCompleted: 4,
            repsCompleted: 32,
            skipped: false,
            durationActual: null,
          },
        ],
      },
      {
        id: 'session-2',
        workoutId: 'wk-2',
        startedAt: '2026-03-30T09:00:00.000Z',
        completedAt: '2026-03-30T09:45:00.000Z',
        exercisesCompleted: [
          {
            exerciseId: 'ex-2',
            setsCompleted: 3,
            repsCompleted: 24,
            skipped: false,
            durationActual: null,
          },
        ],
      },
    ]);
    getWorkoutsMock.mockReturnValue([
      {
        id: 'wk-1',
        title: 'Lower Body Power',
        exercises: [{ exerciseId: 'ex-1' }],
        estimatedDuration: 3600,
      },
      {
        id: 'wk-2',
        title: 'Upper Pull Strength',
        exercises: [{ exerciseId: 'ex-2' }],
        estimatedDuration: 2700,
      },
    ]);
    getActivePlanSubscriptionMock.mockReturnValue(null);
    getCurrentPlanPositionMock.mockReturnValue({ weekNumber: 1 });
    getSetWeightsForSessionMock.mockImplementation((_: unknown, sessionId: string) => {
      if (sessionId === 'session-1') {
        return [
          {
            id: 'set-1',
            sessionId: 'session-1',
            exerciseId: 'ex-1',
            setNumber: 1,
            weight: 225,
            reps: 8,
            estimated1rm: 285,
            createdAt: '2026-04-06T10:00:00.000Z',
          },
        ];
      }

      return [];
    });
    getTodaysWorkoutMock.mockReturnValue({
      workoutTitle: 'Lower Body Power',
      scheduledFor: '2026-04-06T18:00:00.000Z',
    });
    buildRecoveryMapMock.mockReturnValue(
      new Map([
        ['legs', { muscleGroup: 'legs', score: 92 }],
        ['back', { muscleGroup: 'back', score: 81 }],
      ]),
    );
    getBestToTrainMock.mockReturnValue({
      label: 'Pull focus',
      freshMuscles: ['back', 'legs'],
      fatiguedMuscles: [],
    });
  });

  it('renders the redesigned workout dashboard with live analytics sections', () => {
    render(<WorkoutsScreen />);

    expect(seedWorkoutExerciseLibraryMock).toHaveBeenCalledWith(mockDb);
    expect(screen.getByText('Digital Sanctuary')).toBeInTheDocument();
    expect(screen.getByText('Weekly Training Volume')).toBeInTheDocument();
    expect(screen.getByText('Archived Sessions')).toBeInTheDocument();
    expect(screen.getByText('Freshest today')).toBeInTheDocument();
    expect(screen.getAllByText('Lower Body Power').length).toBeGreaterThan(0);
  });

  it('shows the empty state when no workouts or sessions exist yet', () => {
    getWorkoutSessionsMock.mockReturnValue([]);
    getWorkoutsMock.mockReturnValue([]);
    getWorkoutExercisesMock.mockReturnValue([]);
    buildRecoveryMapMock.mockReturnValue(new Map());
    getBestToTrainMock.mockReturnValue({
      label: 'Rest day',
      freshMuscles: [],
      fatiguedMuscles: [],
    });

    render(<WorkoutsScreen />);

    expect(screen.getByText('Build your first workout')).toBeInTheDocument();
    expect(screen.getByText('Open Builder')).toBeInTheDocument();
  });
});
