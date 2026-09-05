import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModeOnboardingPage from '../onboarding/mode/page';
import { setModeConfigAction } from '../actions';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../actions', () => ({
  setModeConfigAction: vi.fn().mockResolvedValue(undefined),
}));

describe('ModeOnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves hosted mode and routes to dashboard', async () => {
    const user = userEvent.setup();
    render(<ModeOnboardingPage />);

    await user.click(screen.getByRole('button', { name: 'Use Hosted' }));

    await waitFor(() => {
      expect(setModeConfigAction).toHaveBeenCalledWith('hosted', null);
      expect(pushMock).toHaveBeenCalledWith('/');
    });
  });

  it('saves self-host mode with URL input', async () => {
    const user = userEvent.setup();
    render(<ModeOnboardingPage />);

    await user.type(
      screen.getByPlaceholderText('https://home.example.com'),
      'https://mylife.internal',
    );
    await user.click(screen.getByRole('button', { name: 'Use Self-Host' }));

    await waitFor(() => {
      expect(setModeConfigAction).toHaveBeenCalledWith(
        'self_host',
        'https://mylife.internal',
      );
      expect(pushMock).toHaveBeenCalledWith('/');
    });
  });

  it('saves local-only mode and routes to dashboard', async () => {
    const user = userEvent.setup();
    render(<ModeOnboardingPage />);

    await user.click(screen.getByRole('button', { name: 'Use Local-Only' }));

    await waitFor(() => {
      expect(setModeConfigAction).toHaveBeenCalledWith('local_only', null);
      expect(pushMock).toHaveBeenCalledWith('/');
    });
  });
});
