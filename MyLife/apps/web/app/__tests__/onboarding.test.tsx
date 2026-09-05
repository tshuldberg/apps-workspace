import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import PledgeOnboardingPage from '../onboarding/pledge/page';
import GoalOnboardingPage from '../onboarding/goal/page';
import KitOnboardingPage from '../onboarding/kit/page';

const pushMock = vi.fn();
const searchParamsGet = vi.fn<(key: string) => string | null>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => ({ get: searchParamsGet }),
  redirect: vi.fn(),
}));

vi.mock('@/app/actions', () => ({
  acceptPledgeAction: vi.fn().mockResolvedValue(undefined),
  selectGoalsAction: vi.fn().mockResolvedValue(undefined),
  completeOnboardingAction: vi
    .fn()
    .mockResolvedValue({ redirectTo: '/mood/log' }),
}));

import {
  selectGoalsAction,
  completeOnboardingAction,
} from '@/app/actions';

describe('Onboarding - Pledge page', () => {
  it('renders pledge headline and an accept button', () => {
    render(<PledgeOnboardingPage />);
    expect(screen.getByText('Our pledge to you')).toBeDefined();
    expect(screen.getByRole('button', { name: 'I accept' })).toBeDefined();
  });

  it('lists all seven commitments', () => {
    render(<PledgeOnboardingPage />);
    expect(screen.getByText('No ads, ever.')).toBeDefined();
    expect(screen.getByText('No data sale, ever.')).toBeDefined();
    expect(screen.getByText('Free features stay free.')).toBeDefined();
    expect(screen.getByText('Export everything, anytime.')).toBeDefined();
    expect(screen.getByText('Delete everything, anytime.')).toBeDefined();
    expect(screen.getByText('Content filters are your choice.')).toBeDefined();
    expect(screen.getByText('Exit door is always open.')).toBeDefined();
  });
});

describe('Onboarding - Goal page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the seven cluster tiles', () => {
    render(<GoalOnboardingPage />);
    expect(screen.getByText('Body & energy')).toBeDefined();
    expect(screen.getByText('Mind & reflection')).toBeDefined();
    expect(screen.getByText('Home & things')).toBeDefined();
    expect(screen.getByText('Money & spending')).toBeDefined();
    expect(screen.getByText('People & events')).toBeDefined();
    expect(screen.getByText('Outdoors & nature')).toBeDefined();
    expect(screen.getByText('Learning & reading')).toBeDefined();
  });

  it('disables Continue until a cluster is selected, then enables and submits', async () => {
    const user = userEvent.setup();
    render(<GoalOnboardingPage />);

    const continueBtn = screen.getByRole('button', { name: 'Continue' });
    expect(continueBtn).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Body & energy/ }));
    expect(continueBtn).not.toBeDisabled();

    await user.click(continueBtn);

    await waitFor(() => {
      expect(selectGoalsAction).toHaveBeenCalledWith(['body']);
      expect(pushMock).toHaveBeenCalledWith(
        expect.stringContaining('/onboarding/kit?clusters=body'),
      );
    });
  });

  it('toggles a selected tile off when clicked again', async () => {
    const user = userEvent.setup();
    render(<GoalOnboardingPage />);

    const tile = screen.getByRole('button', { name: /Mind & reflection/ });
    await user.click(tile);
    expect(tile.getAttribute('aria-pressed')).toBe('true');

    await user.click(tile);
    expect(tile.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});

describe('Onboarding - Kit page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` resets return values; re-prime the action mock so the
    // Kit page's `const { redirectTo } = await completeOnboardingAction(...)`
    // destructure doesn't hit undefined.
    vi.mocked(completeOnboardingAction).mockResolvedValue({ redirectTo: '/mood/log' });
  });

  it('renders merged modules for a single cluster (body)', () => {
    searchParamsGet.mockImplementation((key) =>
      key === 'clusters' ? 'body' : null,
    );
    render(<KitOnboardingPage />);

    // body → health, workouts, nutrition, sleep, sports, cycle, meds, mood
    // (all deliverable on web; fast is web-hidden and intentionally omitted).
    expect(screen.getByText('MyHealth')).toBeDefined();
    expect(screen.getByText('MyWorkouts')).toBeDefined();
    expect(screen.getByText('MyNutrition')).toBeDefined();
    expect(screen.getByText('MySleep')).toBeDefined();
    expect(screen.getByText('MySports')).toBeDefined();
    expect(screen.getByText('MyMood')).toBeDefined();
    expect(screen.queryByText('MyFast')).toBeNull();
  });

  it('merges and dedupes modules across multiple clusters', () => {
    // After web reconciliation, mind = [mood, books] and
    // knowledge = [books, classes, habits]. `books` is the shared deliverable
    // module, so verify it renders exactly once and the other deliverable
    // modules from each cluster appear. flash/notes/words are web-hidden and
    // must not render.
    searchParamsGet.mockImplementation((key) =>
      key === 'clusters' ? 'mind,knowledge' : null,
    );
    render(<KitOnboardingPage />);

    expect(screen.getAllByText('MyBooks')).toHaveLength(1);
    expect(screen.getByText('MyMood')).toBeDefined();
    expect(screen.getByText('MyClasses')).toBeDefined();
    expect(screen.getByText('MyHabits')).toBeDefined();
    expect(screen.queryByText('MyFlash')).toBeNull();
    expect(screen.queryByText('MyNotes')).toBeNull();
    expect(screen.queryByText('MyWords')).toBeNull();
  });

  it('falls back to Everything Lite when clusters are missing', () => {
    searchParamsGet.mockImplementation(() => null);
    render(<KitOnboardingPage />);

    // ALL_FREE_LITE is filtered to free modules deliverable on web. Of
    // fast/journal/mood/notes/voice, only mood is GA/visible on web; the rest
    // are web-hidden and would be silently dropped, so they are not offered.
    expect(screen.getByText('MyMood')).toBeDefined();
    expect(screen.queryByText('MyFast')).toBeNull();
    expect(screen.queryByText('MyJournal')).toBeNull();
    expect(screen.queryByText('MyNotes')).toBeNull();
    expect(screen.queryByText('MyVoice')).toBeNull();
  });

  it('submits selected modules and routes to the returned URL', async () => {
    const user = userEvent.setup();
    searchParamsGet.mockImplementation((key) =>
      key === 'clusters' ? 'body' : null,
    );
    render(<KitOnboardingPage />);

    await user.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => {
      expect(completeOnboardingAction).toHaveBeenCalledWith(
        expect.objectContaining({
          clusters: ['body'],
          enabledModuleIds: expect.arrayContaining([
            'health',
            'workouts',
            'nutrition',
            'sleep',
            'sports',
            'cycle',
            'meds',
            'mood',
          ]),
        }),
      );
      expect(pushMock).toHaveBeenCalledWith('/mood/log');
    });
  });

  it('excludes modules that the user toggled off before Start', async () => {
    const user = userEvent.setup();
    searchParamsGet.mockImplementation((key) =>
      key === 'clusters' ? 'outdoor' : null,
    );
    render(<KitOnboardingPage />);

    // outdoor → trails, stars, garden (all deliverable on web)
    await user.click(
      screen.getByRole('switch', { name: 'Disable MyStars' }),
    );
    await user.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => {
      const call = vi.mocked(completeOnboardingAction).mock.calls[0]?.[0];
      expect(call).toBeDefined();
      expect(call!.enabledModuleIds).toContain('trails');
      expect(call!.enabledModuleIds).toContain('garden');
      expect(call!.enabledModuleIds).not.toContain('stars');
    });
  });
});
