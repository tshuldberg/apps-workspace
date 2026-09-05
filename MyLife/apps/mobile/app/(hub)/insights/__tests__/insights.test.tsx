/**
 * Phase 4a Insights screen smoke test.
 *
 * - With no hub_ai_permissions rows, renders the opt-in banner.
 * - With a mocked permitted module + a mocked queryCorrelation result, the
 *   correlations section renders the Pearson coefficient.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// -----------------------------------------------------------------------------
// Mocks (must come before the module-under-test import)
// -----------------------------------------------------------------------------

const getPermittedModulesMock = vi.fn<() => string[]>(() => []);
const queryCorrelationMock = vi.fn(() => [] as unknown[]);
const queryTrendsMock = vi.fn(() => null);
const discoverInsightsMock = vi.fn(() => [] as unknown[]);

vi.mock('@mylife/intelligence', () => ({
  getPermittedModules: (...args: unknown[]) => getPermittedModulesMock(...(args as [])),
  queryCorrelation: (...args: unknown[]) => queryCorrelationMock(...(args as [])),
  queryTrends: (...args: unknown[]) => queryTrendsMock(...(args as [])),
  discoverInsights: (...args: unknown[]) => discoverInsightsMock(...(args as [])),
}));

const enabledModulesMock = vi.fn<() => unknown[]>(() => []);
vi.mock('@mylife/module-registry', () => ({
  useEnabledModules: () => enabledModulesMock(),
}));

const pushMock = vi.fn();
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('../../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({
    execute: vi.fn(),
    query: vi.fn(() => []),
    transaction: (fn: () => void) => fn(),
  }),
}));

vi.mock('../../_layout', () => ({ HUB_TAB_BAR_CLEARANCE: 120 }));

vi.mock('@mylife/ui', () => {
  const React = require('react');
  const stub = (name: string) =>
    React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      React.createElement('div', { ...props, ref, 'data-testid': name }),
    );
  return {
    Text: stub('Text'),
    colors: {
      background: '#000',
      surface: '#111',
      surfaceElevated: '#222',
      text: '#fff',
      textSecondary: '#aaa',
      hubAccent: '#C9894D',
      border: '#333',
    },
    surfaceTiers: { lowest: '#0E0E13', high: '#2A292F', highest: '#35343A' },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  };
});

vi.mock('react-native-svg', () => {
  const React = require('react');
  const stub = (name: string) =>
    React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      React.createElement('svg', { ...props, ref, 'data-testid': name }),
    );
  const Primitive = React.forwardRef(
    (props: Record<string, unknown>, ref: unknown) =>
      React.createElement('g', { ...props, ref }),
  );
  return {
    default: stub('Svg'),
    Svg: stub('Svg'),
    Circle: Primitive,
    Line: Primitive,
    Rect: Primitive,
    Path: Primitive,
  };
});

import InsightsScreen from '../index';

describe('Phase 4a Insights screen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enabledModulesMock.mockReturnValue([]);
    getPermittedModulesMock.mockReturnValue([]);
    queryCorrelationMock.mockReturnValue([]);
    discoverInsightsMock.mockReturnValue([]);
  });

  it('renders the opt-in banner when no AI permissions are granted', () => {
    getPermittedModulesMock.mockReturnValue([]);
    render(<InsightsScreen />);
    expect(screen.getByText('Requires AI opt-in')).toBeInTheDocument();
    expect(screen.getByLabelText('enable-ai-access')).toBeInTheDocument();
  });

  it('renders a Pearson coefficient when queryCorrelation returns a result', () => {
    getPermittedModulesMock.mockReturnValue(['budget', 'habits']);
    const fakeModules = [
      {
        id: 'budget',
        name: 'MyBudget',
        crossModule: { getCorrelationData: () => ({ moduleId: 'budget', series: [] }) },
      },
      {
        id: 'habits',
        name: 'MyHabits',
        crossModule: { getCorrelationData: () => ({ moduleId: 'habits', series: [] }) },
      },
    ];
    enabledModulesMock.mockReturnValue(fakeModules);
    queryCorrelationMock.mockReturnValue([
      {
        moduleA: 'budget',
        moduleB: 'habits',
        metricA: 'daily_spending',
        labelA: 'Daily Spending',
        metricB: 'habit_completion_rate',
        labelB: 'Habit Completion Rate',
        coefficient: 0.72,
        dataPoints: 30,
        strength: 'strong',
      },
    ]);

    render(<InsightsScreen />);
    // Banner must not appear
    expect(screen.queryByText('Requires AI opt-in')).toBeNull();
    // Section switcher renders
    expect(screen.getByLabelText('section-correlations')).toBeInTheDocument();
    // Correlation card shows rounded coefficient
    expect(screen.getByText(/r = 0\.72/)).toBeInTheDocument();
    // Clicking "Discoveries" switches sections
    fireEvent.click(screen.getByLabelText('section-discoveries'));
    expect(screen.getByText('Nothing interesting yet')).toBeInTheDocument();
  });
});
