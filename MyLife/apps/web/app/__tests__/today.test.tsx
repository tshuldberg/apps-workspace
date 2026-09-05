import { render, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';
import type { TodayCard } from '@mylife/module-registry';
import HubTodayPage from '../page';

vi.mock('@/app/actions', () => ({
  fetchTodayCards: vi.fn(),
  fetchEnabledModuleIds: vi.fn(),
  fetchPrimaryClusters: vi.fn(),
  fetchOnboardingCompleted: vi.fn(),
  dismissTodayCardAction: vi.fn(),
  savePrimaryClustersAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((_url: string) => {
    throw new Error('__NEXT_REDIRECT__');
  }),
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
}));

import {
  fetchTodayCards,
  fetchEnabledModuleIds,
  fetchPrimaryClusters,
  fetchOnboardingCompleted,
} from '@/app/actions';

async function renderAsync(element: Promise<React.ReactElement>) {
  const resolved = await element;
  return render(resolved);
}

function makeCard(overrides: Partial<TodayCard>): TodayCard {
  return {
    id: 'test.card.1',
    moduleId: 'health',
    kind: 'action',
    priority: 50,
    title: 'Test card',
    dismissible: true,
    ...overrides,
  };
}

describe('HubTodayPage', () => {
  beforeEach(() => {
    vi.mocked(fetchTodayCards).mockReset();
    vi.mocked(fetchEnabledModuleIds).mockReset();
    vi.mocked(fetchPrimaryClusters).mockReset();
    vi.mocked(fetchOnboardingCompleted).mockReset();
    // Default: onboarding complete so the redirect doesn't fire in Today tests.
    vi.mocked(fetchOnboardingCompleted).mockResolvedValue(true);
  });

  it('renders the empty state when no cards and no enabled modules', async () => {
    vi.mocked(fetchTodayCards).mockResolvedValue([]);
    vi.mocked(fetchEnabledModuleIds).mockResolvedValue([]);
    vi.mocked(fetchPrimaryClusters).mockResolvedValue([
      'body',
      'mind',
      'home',
      'money',
      'social',
      'outdoor',
      'knowledge',
    ]);
    // @ts-expect-error — HubTodayPage is an async server component; we resolve it in test.
    await renderAsync(HubTodayPage());
    expect(screen.getByText('Nothing yet for today')).toBeDefined();
    expect(screen.getByText('Browse modules')).toBeDefined();
  });

  it('renders a Your-day card when an action-kind card is returned', async () => {
    vi.mocked(fetchTodayCards).mockResolvedValue([
      makeCard({ title: 'Log your mood', kind: 'action', priority: 60 }),
    ]);
    vi.mocked(fetchEnabledModuleIds).mockResolvedValue(['health', 'mood']);
    vi.mocked(fetchPrimaryClusters).mockResolvedValue(['body']);
    // @ts-expect-error — async server component
    await renderAsync(HubTodayPage());
    expect(screen.getByText('Your day')).toBeDefined();
    expect(screen.getByText('Log your mood')).toBeDefined();
  });

  it('renders a This-week card when a progress-kind card is returned', async () => {
    vi.mocked(fetchTodayCards).mockResolvedValue([
      makeCard({
        title: 'Reading goal: 12 of 20 books',
        kind: 'progress',
        priority: 35,
      }),
    ]);
    vi.mocked(fetchEnabledModuleIds).mockResolvedValue(['books']);
    vi.mocked(fetchPrimaryClusters).mockResolvedValue(['knowledge']);
    // @ts-expect-error — async server component
    await renderAsync(HubTodayPage());
    expect(screen.getByText('This week')).toBeDefined();
    expect(screen.getByText('Reading goal: 12 of 20 books')).toBeDefined();
  });

  it('hides the Quick section when no enabled modules match the cluster actions', async () => {
    vi.mocked(fetchTodayCards).mockResolvedValue([
      makeCard({ title: 'Card', kind: 'action' }),
    ]);
    vi.mocked(fetchEnabledModuleIds).mockResolvedValue([]);
    vi.mocked(fetchPrimaryClusters).mockResolvedValue(['body']);
    // @ts-expect-error — async server component
    await renderAsync(HubTodayPage());
    expect(screen.queryByText('Quick')).toBeNull();
  });
});
