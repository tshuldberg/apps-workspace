import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mocks -- must be declared before importing the screens under test.
// -----------------------------------------------------------------------------

const routerReplaceMock = vi.fn();
const localSearchParamsMock: { current: Record<string, string | string[] | undefined> } = {
  current: {},
};

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: routerReplaceMock,
  }),
  useLocalSearchParams: () => localSearchParamsMock.current,
  useSegments: () => [] as string[],
}));

const enableModuleMock = vi.fn();
const setPreferenceMock = vi.fn();

vi.mock('@mylife/db', () => ({
  enableModule: (...args: unknown[]) => enableModuleMock(...args),
  setPreference: (...args: unknown[]) => setPreferenceMock(...args),
  getPreference: () => undefined,
}));

const DB_MOCK = {
  query: vi.fn(() => []),
  execute: vi.fn(),
  transaction: (fn: () => void) => fn(),
};

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => DB_MOCK,
}));

// -----------------------------------------------------------------------------
// Screens under test (must import after all vi.mock calls above)
// -----------------------------------------------------------------------------

import PledgeScreen from '../pledge';
import GoalScreen from '../goal';
import KitScreen from '../kit';

describe('Onboarding flow (mobile)', () => {
  it('pledge renders the seven commitments and the I accept button', () => {
    render(<PledgeScreen />);
    expect(screen.getByText('Our pledge to you')).toBeInTheDocument();
    expect(screen.getByText('No ads, ever.')).toBeInTheDocument();
    expect(screen.getByText('The exit door is always open.')).toBeInTheDocument();
    expect(screen.getByLabelText('I accept')).toBeInTheDocument();
    expect(screen.getByLabelText('Read full pledge')).toBeInTheDocument();
  });

  it('pledge "I accept" advances to the goal screen', () => {
    routerReplaceMock.mockClear();
    render(<PledgeScreen />);
    fireEvent.click(screen.getByLabelText('I accept'));
    expect(routerReplaceMock).toHaveBeenCalledWith('/(onboarding)/goal');
  });

  it('goal renders all seven clusters and disables Continue until one is picked', () => {
    render(<GoalScreen />);

    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Mind')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Money')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('Outdoor')).toBeInTheDocument();
    expect(screen.getByText('Knowledge')).toBeInTheDocument();

    // Continue starts disabled
    const continueBtn = screen.getByLabelText('Continue');
    expect(continueBtn.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(screen.getByLabelText(/Body:/));

    // After selecting, Continue is enabled
    expect(continueBtn.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('goal Continue advances to kit with the selected clusters', () => {
    routerReplaceMock.mockClear();
    render(<GoalScreen />);

    fireEvent.click(screen.getByLabelText(/Mind:/));
    fireEvent.click(screen.getByLabelText('Continue'));

    expect(routerReplaceMock).toHaveBeenCalledWith({
      pathname: '/(onboarding)/kit',
      params: { clusters: 'mind' },
    });
  });

  it('kit renders the deduped union of modules for the selected clusters', () => {
    localSearchParamsMock.current = { clusters: 'body,mind' };
    render(<KitScreen />);

    // From Body cluster
    expect(screen.getByText('MyHealth')).toBeInTheDocument();
    expect(screen.getByText('MyWorkouts')).toBeInTheDocument();
    // From Mind cluster
    expect(screen.getByText('MyJournal')).toBeInTheDocument();
    expect(screen.getByText('MyNotes')).toBeInTheDocument();
    // MyMood is in both; verify it appears exactly once
    const moodMatches = screen.getAllByText('MyMood');
    expect(moodMatches).toHaveLength(1);
  });

  it('kit Start enables modules, writes preferences, and routes to the first action', () => {
    localSearchParamsMock.current = { clusters: 'body' };
    enableModuleMock.mockClear();
    setPreferenceMock.mockClear();
    routerReplaceMock.mockClear();

    render(<KitScreen />);
    fireEvent.click(screen.getByLabelText('Start'));

    // primary_clusters written
    expect(setPreferenceMock).toHaveBeenCalledWith(
      DB_MOCK,
      'today.primary_clusters',
      JSON.stringify(['body']),
    );
    // completion timestamp written
    expect(setPreferenceMock).toHaveBeenCalledWith(
      DB_MOCK,
      'onboarding.completed_at',
      expect.any(String),
    );
    // every body-cluster module enabled
    const enabledIds = enableModuleMock.mock.calls.map((c) => c[1]);
    expect(enabledIds).toEqual(
      expect.arrayContaining(['health', 'workouts', 'nutrition', 'fast', 'mood', 'cycle', 'meds']),
    );
    // routed into /(mood)/log-mood
    expect(routerReplaceMock).toHaveBeenCalledWith('/(mood)/log-mood');
  });
});
