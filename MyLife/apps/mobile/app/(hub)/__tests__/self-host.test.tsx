import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SelfHostScreen from '../self-host';

const pushMock = vi.fn();
const incrementAggregateEventCounterMock = vi.fn();
const saveModeConfigMock = vi.fn();
const testSelfHostConnectionMock = vi.fn();
const getPreferenceMock = vi.fn();
const setPreferenceMock = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({ id: 'mock-db' }),
}));

vi.mock('@mylife/db', () => ({
  incrementAggregateEventCounter: (...args: unknown[]) =>
    incrementAggregateEventCounterMock(...args),
  getPreference: (...args: unknown[]) => getPreferenceMock(...args),
  setPreference: (...args: unknown[]) => setPreferenceMock(...args),
}));

vi.mock('../../../lib/entitlements', () => ({
  getModeConfig: () => ({
    mode: 'local_only',
    serverUrl: 'https://existing.example.com',
  }),
  saveModeConfig: (...args: unknown[]) => saveModeConfigMock(...args),
}));

vi.mock('../../../lib/server-endpoint', () => ({
  testSelfHostConnection: (...args: unknown[]) => testSelfHostConnectionMock(...args),
}));

describe('Hub SelfHostScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPreferenceMock.mockReturnValue('port_forward_tls');
    testSelfHostConnectionMock.mockResolvedValue({
      ok: true,
      baseUrl: 'https://new.example.com',
      checks: [
        { id: 'url', ok: true, message: 'URL valid' },
        { id: 'tls', ok: true, message: 'TLS valid' },
        { id: 'health', ok: true, message: 'Health valid', httpStatus: 200 },
        { id: 'sync', ok: true, message: 'Sync valid', httpStatus: 200 },
      ],
    });
  });

  it('saves self-host mode and records mode selection event', () => {
    render(<SelfHostScreen />);

    fireEvent.change(screen.getByPlaceholderText('https://home.example.com'), {
      target: { value: 'https://new.example.com' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save and Use Self-Host' }),
    );

    expect(saveModeConfigMock).toHaveBeenCalledWith(
      { id: 'mock-db' },
      'self_host',
      'https://new.example.com',
    );
    expect(incrementAggregateEventCounterMock).toHaveBeenCalledWith(
      { id: 'mock-db' },
      'mode_selected:self_host',
    );
    expect(
      screen.getByText('Saved self-host mode and server URL.'),
    ).toBeInTheDocument();
  });

  it('lets users compare methods, see pros/cons, and use guided step navigation', () => {
    render(<SelfHostScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: /Dynamic DNS \+ Forwarding/i }),
    );

    expect(setPreferenceMock).toHaveBeenCalledWith(
      { id: 'mock-db' },
      'self_host.connection_method',
      'dynamic_dns',
    );
    expect(screen.getAllByText('Pros').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cons').length).toBeGreaterThan(0);
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    expect(screen.getByText('Step 2 of 6')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use Suggested URL' }));
    expect(screen.getByPlaceholderText('https://home.example.com')).toHaveValue(
      'https://mylife-home.duckdns.org',
    );
  });

  it('loads persisted method and uses method-specific suggested URL', () => {
    getPreferenceMock.mockReturnValue('outbound_tunnel');

    render(<SelfHostScreen />);

    expect(
      screen.getByText('Selected method: Outbound Tunnel'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use Suggested URL' }));
    expect(screen.getByPlaceholderText('https://home.example.com')).toHaveValue(
      'https://mylife-node.trycloudflare.com',
    );
  });

  it('keeps step navigation bounded and resets to first step on method switch', () => {
    render(<SelfHostScreen />);

    for (let i = 0; i < 10; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));
    }
    expect(screen.getByText('Step 6 of 6')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Dynamic DNS \+ Forwarding/i }),
    );
    expect(setPreferenceMock).toHaveBeenCalledWith(
      { id: 'mock-db' },
      'self_host.connection_method',
      'dynamic_dns',
    );
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
  });

  it('runs connection test and records setup completion when checks pass', async () => {
    render(<SelfHostScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => {
      expect(testSelfHostConnectionMock).toHaveBeenCalledWith(
        'https://existing.example.com',
      );
      expect(screen.getByText('Overall: PASS')).toBeInTheDocument();
    });

    expect(incrementAggregateEventCounterMock).toHaveBeenCalledWith(
      { id: 'mock-db' },
      'setup_completed:self_host',
    );
  });

  it('shows failed connection result without setup completion event', async () => {
    testSelfHostConnectionMock.mockResolvedValueOnce({
      ok: false,
      baseUrl: 'https://existing.example.com',
      checks: [
        { id: 'health', ok: false, message: 'Health endpoint returned 500', httpStatus: 500 },
      ],
    });

    render(<SelfHostScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => {
      expect(screen.getByText('Overall: FAIL')).toBeInTheDocument();
    });
    expect(incrementAggregateEventCounterMock).not.toHaveBeenCalledWith(
      { id: 'mock-db' },
      'setup_completed:self_host',
    );
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
  });

  it('navigates back to hub settings from back button', () => {
    render(<SelfHostScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));

    expect(pushMock).toHaveBeenCalledWith('/(hub)/settings');
  });
});
