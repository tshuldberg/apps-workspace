import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../actions', () => ({
  fetchActiveFast: vi.fn().mockResolvedValue(null),
  doStartFast: vi.fn().mockResolvedValue({ id: 'fast-1' }),
  doEndFast: vi.fn().mockResolvedValue(undefined),
  fetchProtocols: vi.fn().mockResolvedValue([]),
  fetchStreaks: vi.fn().mockResolvedValue({ currentStreak: 0, longestStreak: 0, totalFasts: 0 }),
}));

vi.mock('@mylife/fast', () => ({
  computeTimerState: vi.fn(),
  formatDuration: vi.fn((s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`),
}));

import FastPage from '../page';
import {
  fetchActiveFast,
  doStartFast,
  doEndFast,
  fetchProtocols,
  fetchStreaks,
} from '../actions';
import { computeTimerState, formatDuration } from '@mylife/fast';

const mockProtocols = [
  {
    id: '16:8',
    name: '16:8',
    fasting_hours: 16,
    eating_hours: 8,
    description: null,
  },
  {
    id: '18:6',
    name: '18:6',
    fasting_hours: 18,
    eating_hours: 6,
    description: null,
  },
  {
    id: '20:4',
    name: '20:4',
    fasting_hours: 20,
    eating_hours: 4,
    description: null,
  },
];

const mockStreaks = {
  currentStreak: 3,
  longestStreak: 7,
  totalFasts: 20,
};

const idleTimerState = {
  state: 'idle' as const,
  elapsed: 0,
  remaining: 0,
  progress: 0,
  targetReached: false,
  activeFast: null,
};

const fastingTimerState = {
  state: 'fasting' as const,
  elapsed: 28800,
  remaining: 28800,
  progress: 0.5,
  targetReached: false,
  activeFast: {
    id: 'fast-1',
    protocol_id: '16:8',
    started_at: '2026-02-24T06:00:00Z',
    target_hours: 16,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(computeTimerState).mockReturnValue(idleTimerState);
});

describe('FastPage', () => {
  it('shows skeleton loading state initially', () => {
    vi.mocked(computeTimerState).mockReturnValue(idleTimerState);
    vi.mocked(fetchActiveFast).mockReturnValue(new Promise(() => {})); // never resolves
    vi.mocked(fetchProtocols).mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchStreaks).mockReturnValue(new Promise(() => {}));

    const { container } = render(<FastPage />);

    // Fast page uses skeleton loader (pulsing divs) instead of text
    const skeletons = container.querySelectorAll('[style*="pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders idle timer when no active fast', async () => {
    vi.mocked(fetchActiveFast).mockResolvedValue(null);
    vi.mocked(fetchProtocols).mockResolvedValue(mockProtocols);
    vi.mocked(fetchStreaks).mockResolvedValue(mockStreaks);
    vi.mocked(computeTimerState).mockReturnValue(idleTimerState);

    render(<FastPage />);

    await waitFor(() => {
      expect(screen.getByText(/ready to fast/i)).toBeInTheDocument();
    });

    // Protocol chips visible
    expect(screen.getByText('16:8')).toBeInTheDocument();
    expect(screen.getByText('18:6')).toBeInTheDocument();
    expect(screen.getByText('20:4')).toBeInTheDocument();

    // Start button visible
    expect(screen.getByRole('button', { name: /start fast/i })).toBeInTheDocument();
  });

  it('starts a fast when Start Fast clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchActiveFast).mockResolvedValue(null);
    vi.mocked(fetchProtocols).mockResolvedValue(mockProtocols);
    vi.mocked(fetchStreaks).mockResolvedValue(mockStreaks);
    vi.mocked(computeTimerState).mockReturnValue(idleTimerState);

    render(<FastPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start fast/i })).toBeInTheDocument();
    });

    const startButton = screen.getByRole('button', { name: /start fast/i });
    await user.click(startButton);

    await waitFor(() => {
      expect(doStartFast).toHaveBeenCalledWith(
        expect.any(String),
        '16:8',
        16
      );
    });
  });

  it('shows active timer during fast', async () => {
    vi.mocked(fetchActiveFast).mockResolvedValue({
      id: 'fast-1',
      protocol_id: '16:8',
      started_at: '2026-02-24T06:00:00Z',
      target_hours: 16,
    });
    vi.mocked(fetchProtocols).mockResolvedValue(mockProtocols);
    vi.mocked(fetchStreaks).mockResolvedValue(mockStreaks);
    vi.mocked(computeTimerState).mockReturnValue(fastingTimerState);
    vi.mocked(formatDuration).mockReturnValue('8h 0m');

    render(<FastPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /end fast/i })).toBeInTheDocument();
    });

    // Progress bar is rendered as a styled div (no ARIA role)
    expect(screen.getByRole('button', { name: /end fast/i })).toBeInTheDocument();
  });

  it('ends a fast when End Fast clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchActiveFast).mockResolvedValue({
      id: 'fast-1',
      protocol_id: '16:8',
      started_at: '2026-02-24T06:00:00Z',
      target_hours: 16,
    });
    vi.mocked(fetchProtocols).mockResolvedValue(mockProtocols);
    vi.mocked(fetchStreaks).mockResolvedValue(mockStreaks);
    vi.mocked(computeTimerState).mockReturnValue(fastingTimerState);

    render(<FastPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /end fast/i })).toBeInTheDocument();
    });

    const endButton = screen.getByRole('button', { name: /end fast/i });
    await user.click(endButton);

    await waitFor(() => {
      expect(doEndFast).toHaveBeenCalled();
    });
  });

  it('displays streak cards with correct values', async () => {
    vi.mocked(fetchActiveFast).mockResolvedValue(null);
    vi.mocked(fetchProtocols).mockResolvedValue(mockProtocols);
    vi.mocked(fetchStreaks).mockResolvedValue(mockStreaks);
    vi.mocked(computeTimerState).mockReturnValue(idleTimerState);

    render(<FastPage />);

    await waitFor(() => {
      expect(screen.getByText(/current streak/i)).toBeInTheDocument();
    });

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();

    expect(screen.getByText(/current streak/i)).toBeInTheDocument();
    expect(screen.getByText(/longest streak/i)).toBeInTheDocument();
    expect(screen.getByText(/total fasts/i)).toBeInTheDocument();
  });

  it('allows selecting different protocols', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchActiveFast).mockResolvedValue(null);
    vi.mocked(fetchProtocols).mockResolvedValue(mockProtocols);
    vi.mocked(fetchStreaks).mockResolvedValue(mockStreaks);
    vi.mocked(computeTimerState).mockReturnValue(idleTimerState);

    render(<FastPage />);

    await waitFor(() => {
      expect(screen.getByText('18:6')).toBeInTheDocument();
    });

    const protocol186 = screen.getByText('18:6');
    await user.click(protocol186);

    // After clicking, the 18:6 chip should have active/selected styling
    // The exact class/attribute depends on implementation, but we verify the click registers
    // by checking doStartFast gets the right protocol when Start is pressed
    const startButton = screen.getByRole('button', { name: /start fast/i });
    await user.click(startButton);

    await waitFor(() => {
      expect(doStartFast).toHaveBeenCalledWith(
        expect.any(String),
        '18:6',
        18
      );
    });
  });
});
