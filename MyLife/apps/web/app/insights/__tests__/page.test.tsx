/**
 * Phase 4a Insights page smoke test (web).
 *
 * - With no AI permissions, the opt-in banner renders.
 * - With a mocked bootstrap + a discovery card, the discoveries section
 *   surfaces the insight title.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/actions', () => ({
  fetchInsightsAction: vi.fn(),
  fetchCorrelationAction: vi.fn().mockResolvedValue([]),
  fetchTrendsAction: vi.fn().mockResolvedValue(null),
}));

import InsightsPage from '../page';
import { fetchInsightsAction } from '@/app/actions';

describe('Phase 4a Insights page (web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the opt-in banner when the user has no AI permissions', async () => {
    vi.mocked(fetchInsightsAction).mockResolvedValue({
      hasAIPermission: false,
      modules: [],
      discoveries: [],
    });
    const element = await InsightsPage();
    render(element);
    expect(screen.getByLabelText('insights-optin-banner')).toBeDefined();
    expect(screen.getByText('Requires AI opt-in')).toBeDefined();
  });

  it('renders discoveries when the engine returns an insight card', async () => {
    vi.mocked(fetchInsightsAction).mockResolvedValue({
      hasAIPermission: true,
      modules: [
        {
          id: 'budget',
          name: 'MyBudget',
          series: [
            { metric: 'daily_spending', label: 'Daily Spending', unit: 'cents' },
          ],
        },
        {
          id: 'habits',
          name: 'MyHabits',
          series: [
            {
              metric: 'habit_completion_rate',
              label: 'Habit Completion Rate',
              unit: '%',
            },
          ],
        },
      ],
      discoveries: [
        {
          title: 'Daily Spending and Habit Completion Rate are negatively correlated',
          description:
            'Strong negative correlation (r=-0.72, 30 days of data)',
          correlation: {
            moduleA: 'budget',
            moduleB: 'habits',
            metricA: 'daily_spending',
            labelA: 'Daily Spending',
            metricB: 'habit_completion_rate',
            labelB: 'Habit Completion Rate',
            coefficient: -0.72,
            dataPoints: 30,
            strength: 'strong',
          },
          modules: ['budget', 'habits'],
          confidence: 'medium',
        },
      ],
    });

    const element = await InsightsPage();
    render(element);

    expect(screen.queryByLabelText('insights-optin-banner')).toBeNull();
    expect(
      screen.getByText(
        /Daily Spending and Habit Completion Rate are negatively correlated/,
      ),
    ).toBeDefined();
    // Confidence pill
    expect(screen.getByText('medium')).toBeDefined();
  });
});
