import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@/app/actions', () => ({
  listAutomationRulesAction: vi.fn().mockResolvedValue([
    {
      id: 'receipt-to-budget',
      label: 'Attach receipts to budget transactions',
      description:
        'Stores the photo in the hub attachment layer so the receipt can surface elsewhere.',
      clusters: ['money'],
      enabled: false,
    },
  ]),
  toggleAutomationRuleAction: vi.fn().mockResolvedValue(undefined),
}));

import AutomationsSettingsPage from '../page';
import {
  listAutomationRulesAction,
  toggleAutomationRuleAction,
} from '@/app/actions';

describe('Settings → Automations page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listAutomationRulesAction).mockResolvedValue([
      {
        id: 'receipt-to-budget',
        label: 'Attach receipts to budget transactions',
        description:
          'Stores the photo in the hub attachment layer so the receipt can surface elsewhere.',
        clusters: ['money'],
        enabled: false,
      },
    ]);
    vi.mocked(toggleAutomationRuleAction).mockResolvedValue(undefined);
  });

  it('renders the rule list and fires toggleAutomationRuleAction on click', async () => {
    const element = await AutomationsSettingsPage();
    render(element);

    expect(
      screen.getByText('Attach receipts to budget transactions'),
    ).toBeDefined();

    const toggle = screen.getByRole('switch', {
      name: /Enable Attach receipts to budget transactions/,
    });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    const user = userEvent.setup();
    await user.click(toggle);

    await waitFor(() => {
      expect(toggleAutomationRuleAction).toHaveBeenCalledWith(
        'receipt-to-budget',
        true,
      );
    });
  });
});
