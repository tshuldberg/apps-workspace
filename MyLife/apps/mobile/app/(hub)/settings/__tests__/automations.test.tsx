/**
 * Smoke test for Settings → Automations.
 *
 * Mocks @mylife/automations.listRules to return the receipt-to-budget rule,
 * mocks the hub DB with an in-memory enabled flag, then toggles the Switch
 * on and off and asserts the SQL adapter sees both writes with the expected
 * enabled value.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// -----------------------------------------------------------------------------
// Mocks (must come before the module-under-test import)
// -----------------------------------------------------------------------------

const listRulesMock = vi.fn();

vi.mock('@mylife/automations', () => ({
  listRules: () => listRulesMock(),
}));

/**
 * In-memory stub for hub_automation_rules. Tracks enabled flag per ruleId
 * via a Map so the screen reads back the value it just wrote.
 */
const ruleState = new Map<string, number>();
const executeMock = vi.fn((sql: string, params?: unknown[]) => {
  if (/INSERT INTO hub_automation_rules/i.test(sql)) {
    const [id, enabled] = (params ?? []) as [string, number];
    ruleState.set(id, enabled);
  }
});
const queryMock = vi.fn((sql: string, params?: unknown[]) => {
  if (/FROM hub_automation_rules/i.test(sql)) {
    const [id] = (params ?? []) as [string];
    const enabled = ruleState.get(id) ?? 0;
    return [{ enabled }];
  }
  return [];
});

vi.mock('../../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({
    execute: executeMock,
    query: queryMock,
    transaction: (fn: () => void) => fn(),
  }),
}));

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
    },
    surfaceTiers: { high: '#2A292F', highest: '#35343A' },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  };
});

import AutomationsSettingsScreen from '../automations';

describe('Hub SettingsScreen → Automations (mobile)', () => {
  beforeEach(() => {
    ruleState.clear();
    executeMock.mockClear();
    queryMock.mockClear();
    listRulesMock.mockReturnValue([
      {
        id: 'receipt-to-budget',
        label: 'Attach receipts to budget transactions',
        description: 'Wire a photo to a new transaction atomically.',
        clusters: ['money'],
        check: () => null,
        previewCard: () => ({
          title: 't',
          subtitle: 's',
          cta: { apply: 'a', dismiss: 'd' },
        }),
        apply: () => ({}),
      },
    ]);
  });

  it('renders the receipt-to-budget rule row from the registry', () => {
    render(<AutomationsSettingsScreen />);

    expect(
      screen.getByText('Attach receipts to budget transactions'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Wire a photo to a new transaction atomically.'),
    ).toBeInTheDocument();
  });

  it('toggles the rule on, then off, writing enabled=1 then enabled=0', () => {
    render(<AutomationsSettingsScreen />);

    const toggle = screen.getByLabelText(
      'toggle-receipt-to-budget',
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);
    expect(ruleState.get('receipt-to-budget')).toBe(1);

    const insertCalls = executeMock.mock.calls.filter(([sql]) =>
      /INSERT INTO hub_automation_rules/i.test(String(sql)),
    );
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.[1]).toEqual(['receipt-to-budget', 1]);

    fireEvent.click(toggle);
    expect(ruleState.get('receipt-to-budget')).toBe(0);

    const secondInsert = executeMock.mock.calls.filter(([sql]) =>
      /INSERT INTO hub_automation_rules/i.test(String(sql)),
    );
    expect(secondInsert).toHaveLength(2);
    expect(secondInsert[1]?.[1]).toEqual(['receipt-to-budget', 0]);
  });
});
