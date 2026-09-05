import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelfHostSettingsPage from '../settings/self-host/page';
import {
  getModeConfigAction,
  setModeConfigAction,
  testSelfHostConnectionAction,
  recordOperationalEventAction,
  getSelfHostConnectionMethodAction,
  setSelfHostConnectionMethodAction,
} from '../actions';

vi.mock('../actions', () => ({
  getModeConfigAction: vi.fn(),
  setModeConfigAction: vi.fn().mockResolvedValue(undefined),
  testSelfHostConnectionAction: vi.fn(),
  recordOperationalEventAction: vi.fn().mockResolvedValue(undefined),
  getSelfHostConnectionMethodAction: vi.fn().mockResolvedValue('port_forward_tls'),
  setSelfHostConnectionMethodAction: vi.fn().mockResolvedValue(undefined),
}));

describe('SelfHostSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads saved mode config and allows save action', async () => {
    vi.mocked(getModeConfigAction).mockResolvedValue({
      mode: 'self_host',
      serverUrl: 'https://home.example.com',
    });
    vi.mocked(getSelfHostConnectionMethodAction).mockResolvedValue('port_forward_tls');
    vi.mocked(testSelfHostConnectionAction).mockResolvedValue({
      ok: true,
      baseUrl: 'https://home.example.com',
      checks: [],
    });

    const user = userEvent.setup();
    render(<SelfHostSettingsPage />);

    const input = await screen.findByLabelText('Server URL');
    expect(input).toHaveValue('https://home.example.com');

    await user.clear(input);
    await user.type(input, 'https://mylife.internal');
    await user.click(
      screen.getByRole('button', { name: 'Save and Use Self-Host' }),
    );

    await waitFor(() => {
      expect(setModeConfigAction).toHaveBeenCalledWith(
        'self_host',
        'https://mylife.internal',
      );
    });
    expect(
      screen.getByText('Saved self-host mode and server URL.'),
    ).toBeInTheDocument();
  });

  it('lets users compare methods with pros/cons and navigate wizard steps', async () => {
    vi.mocked(getModeConfigAction).mockResolvedValue({
      mode: 'local_only',
      serverUrl: null,
    });
    vi.mocked(getSelfHostConnectionMethodAction).mockResolvedValue('port_forward_tls');
    vi.mocked(testSelfHostConnectionAction).mockResolvedValue({
      ok: true,
      baseUrl: 'https://example.com',
      checks: [],
    });

    const user = userEvent.setup();
    render(<SelfHostSettingsPage />);

    const dynamicDnsCard = await screen.findByRole('button', {
      name: /Dynamic DNS \+ Port Forwarding/i,
    });
    expect(dynamicDnsCard).toHaveStyle('min-height: 220px');

    await user.click(dynamicDnsCard);
    await waitFor(() => {
      expect(setSelfHostConnectionMethodAction).toHaveBeenCalledWith('dynamic_dns');
    });

    expect(screen.getAllByText('Pros').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cons').length).toBeGreaterThan(0);
    expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next Step' }));
    expect(screen.getByText(/Step 2 of 6/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use Suggested URL' }));
    expect(screen.getByLabelText('Server URL')).toHaveValue('https://mylife-home.duckdns.org');
  });

  it('restores selected method, resets step when switching, and updates suggested URL', async () => {
    vi.mocked(getModeConfigAction).mockResolvedValue({
      mode: 'local_only',
      serverUrl: null,
    });
    vi.mocked(getSelfHostConnectionMethodAction).mockResolvedValue('dynamic_dns');
    vi.mocked(testSelfHostConnectionAction).mockResolvedValue({
      ok: true,
      baseUrl: 'https://example.com',
      checks: [],
    });

    const user = userEvent.setup();
    render(<SelfHostSettingsPage />);

    expect(
      await screen.findByText('Selected method: Dynamic DNS + Port Forwarding'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next Step' }));
    await user.click(screen.getByRole('button', { name: 'Next Step' }));
    expect(screen.getByText(/Step 3 of 6/)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Outbound Tunnel \(No Port Open\)/i }),
    );

    await waitFor(() => {
      expect(setSelfHostConnectionMethodAction).toHaveBeenCalledWith('outbound_tunnel');
    });
    expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument();
    expect(screen.getByText('Selected method: Outbound Tunnel (No Port Open)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use Suggested URL' }));
    expect(screen.getByLabelText('Server URL')).toHaveValue('https://mylife-node.trycloudflare.com');
  });

  it('keeps step navigation bounded at first and last step', async () => {
    vi.mocked(getModeConfigAction).mockResolvedValue({
      mode: 'local_only',
      serverUrl: null,
    });
    vi.mocked(getSelfHostConnectionMethodAction).mockResolvedValue('port_forward_tls');
    vi.mocked(testSelfHostConnectionAction).mockResolvedValue({
      ok: true,
      baseUrl: 'https://example.com',
      checks: [],
    });

    const user = userEvent.setup();
    render(<SelfHostSettingsPage />);

    await screen.findByText(/Step 1 of 6/);
    await user.click(screen.getByRole('button', { name: 'Previous Step' }));
    expect(screen.getByText(/Step 1 of 6/)).toBeInTheDocument();

    for (let i = 0; i < 10; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Next Step' }));
    }
    expect(screen.getByText(/Step 6 of 6/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next Step' }));
    expect(screen.getByText(/Step 6 of 6/)).toBeInTheDocument();
  });

  it('runs connection test and renders check results', async () => {
    vi.mocked(getModeConfigAction).mockResolvedValue({
      mode: 'local_only',
      serverUrl: null,
    });
    vi.mocked(getSelfHostConnectionMethodAction).mockResolvedValue('outbound_tunnel');
    vi.mocked(testSelfHostConnectionAction).mockResolvedValue({
      ok: false,
      baseUrl: 'https://mylife.internal',
      checks: [
        {
          id: 'health',
          ok: false,
          message: 'Health endpoint returned HTTP 500.',
          httpStatus: 500,
        },
      ],
    });

    const user = userEvent.setup();
    render(<SelfHostSettingsPage />);

    const input = await screen.findByLabelText('Server URL');
    await user.type(input, 'https://mylife.internal');
    await user.click(screen.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => {
      expect(testSelfHostConnectionAction).toHaveBeenCalledWith(
        'https://mylife.internal',
      );
    });

    expect(recordOperationalEventAction).not.toHaveBeenCalled();
    expect(screen.getByText('Overall: FAIL')).toBeInTheDocument();
    expect(screen.getByText('HEALTH')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
  });

  it('records setup completion counter when connection test passes', async () => {
    vi.mocked(getModeConfigAction).mockResolvedValue({
      mode: 'self_host',
      serverUrl: 'https://home.example.com',
    });
    vi.mocked(getSelfHostConnectionMethodAction).mockResolvedValue('port_forward_tls');
    vi.mocked(testSelfHostConnectionAction).mockResolvedValue({
      ok: true,
      baseUrl: 'https://home.example.com',
      checks: [
        { id: 'health', ok: true, message: 'ok', httpStatus: 200 },
      ],
    });

    const user = userEvent.setup();
    render(<SelfHostSettingsPage />);

    await user.click(screen.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => {
      expect(recordOperationalEventAction).toHaveBeenCalledWith('setup_completed:self_host');
    });
  });
});
