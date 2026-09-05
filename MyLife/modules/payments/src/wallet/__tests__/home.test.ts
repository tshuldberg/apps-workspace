import { describe, expect, it } from 'vitest';

import {
  buildPaymentsProfile,
} from '../../compliance/profile';
import type {
  PaymentsWalletSnapshot,
} from '../../engine/types';
import type {
  PaymentActivityItem,
} from '../../types';
import {
  buildPaymentsWalletHomeViewModel,
  type PaymentsWalletHomeSnapshot,
  type PaymentsWalletLinkedAccount,
} from '../home';

const verifiedProfile = buildPaymentsProfile({
  ownerUserId: 'user_1',
  primaryWalletId: 'wallet_1',
  handle: '@trey',
  displayName: 'Trey',
  identityStatus: 'verified',
  verificationState: 'verified',
  approvedTier: 'basic',
  fields: {
    legalName: 'Trey Example',
    email: 'trey@example.com',
    phoneE164: '+15555550123',
    dateOfBirth: '1990-01-01',
    addressLine1: '1 Main St',
    city: 'Austin',
    regionCode: 'TX',
    postalCode: '78701',
    governmentIdLast4: '1234',
  },
});

function makeWallet(
  overrides: Partial<PaymentsWalletSnapshot> = {},
): PaymentsWalletSnapshot {
  return {
    walletId: 'wallet_1',
    ownerUserId: 'user_1',
    status: 'active',
    defaultCurrency: 'USD',
    balances: {
      available: 12_500,
      pending: 0,
      reserved: 0,
      escrow: 0,
    },
    complianceHold: 'none',
    sendLimitRemainingCents: 50_000,
    receiveLimitRemainingCents: 75_000,
    ...overrides,
  };
}

function makeLinkedAccount(
  overrides: Partial<PaymentsWalletLinkedAccount> = {},
): PaymentsWalletLinkedAccount {
  return {
    id: 'bank_1',
    label: 'Checking',
    institutionName: 'Thread Bank',
    kind: 'bank',
    verificationState: 'verified',
    last4: '6789',
    primary: true,
    ...overrides,
  };
}

function makeActivity(): PaymentActivityItem {
  return {
    id: 'activity_1',
    title: 'Dinner split',
    amountCents: 2_400,
    currency: 'USD',
    direction: 'incoming',
    status: 'posted',
    rail: 'wallet',
    occurredAt: '2026-04-24T12:00:00.000Z',
  };
}

function makeSnapshot(
  overrides: Partial<PaymentsWalletHomeSnapshot> = {},
): PaymentsWalletHomeSnapshot {
  return {
    profile: verifiedProfile,
    wallet: makeWallet(),
    linkedAccounts: [makeLinkedAccount()],
    recentActivity: [makeActivity()],
    serverRefreshedAt: '2026-04-24T12:00:00.000Z',
    realtime: {
      connected: true,
      lastEventAt: '2026-04-24T12:00:00.000Z',
    },
    ...overrides,
  };
}

describe('payments wallet home view model', () => {
  it('explains brand-new wallet setup and disables money movement', () => {
    const viewModel = buildPaymentsWalletHomeViewModel(
      makeSnapshot({
        profile: null,
        wallet: null,
        linkedAccounts: [],
        recentActivity: [],
      }),
    );

    expect(viewModel.isBrandNew).toBe(true);
    expect(viewModel.balanceHero.state).toBe('brand_new');
    expect(viewModel.balanceHero.availableCents).toBe(0);
    expect(viewModel.balanceHero.canSend).toBe(false);
    expect(viewModel.balanceHero.canSendReason).toContain('Create a wallet');
    expect(viewModel.quickActions.find((action) => action.id === 'send')?.enabled).toBe(false);
    expect(viewModel.linkedAccountSummary.state).toBe('none');
    expect(viewModel.realtimePath.balanceChannel).toBe('payments.wallet.new_wallet.balances');
  });

  it('surfaces pending balance without marking pending funds spendable', () => {
    const viewModel = buildPaymentsWalletHomeViewModel(
      makeSnapshot({
        wallet: makeWallet({
          balances: {
            available: 0,
            pending: 4_250,
            reserved: 0,
            escrow: 0,
          },
        }),
        recentActivity: [],
      }),
    );

    expect(viewModel.balanceHero.state).toBe('pending');
    expect(viewModel.balanceHero.pendingIndicator).toBe('$42.50 pending');
    expect(viewModel.balanceHero.canSend).toBe(false);
    expect(viewModel.balanceHero.canSendReason).toContain('Add money');
    expect(viewModel.balanceHero.disclosure.id).toContain('custodial_account');
  });

  it('switches to read-only mode when the service is degraded', () => {
    const viewModel = buildPaymentsWalletHomeViewModel(
      makeSnapshot({
        systemMode: 'degraded',
        systemMessage: 'Provider writes are paused during reconciliation.',
      }),
    );

    expect(viewModel.readOnly).toBe(true);
    expect(viewModel.readOnlyBanner?.id).toBe('wallet_home_read_only_degraded');
    expect(viewModel.balanceHero.state).toBe('held');
    expect(viewModel.quickActions.every((action) => !action.enabled)).toBe(true);
    expect(viewModel.realtimePath.activityChannel).toBe('payments.wallet.wallet_1.activity');
  });

  it('keeps a held wallet readable and preserves extension hooks', () => {
    const viewModel = buildPaymentsWalletHomeViewModel(
      makeSnapshot({
        wallet: makeWallet({
          status: 'restricted',
          complianceHold: 'freeze',
          balances: {
            available: 9_900,
            pending: 1_100,
            reserved: 0,
            escrow: 0,
          },
        }),
        accountHoldReason: 'Manual compliance review is open.',
      }),
    );

    expect(viewModel.readOnly).toBe(true);
    expect(viewModel.balanceHero.state).toBe('held');
    expect(viewModel.balanceHero.availableCents).toBe(9_900);
    expect(viewModel.balanceHero.pendingIndicator).toBe('$11.00 pending');
    expect(viewModel.readOnlyBanner?.body).toBe('Manual compliance review is open.');
    expect(viewModel.extensionHooks.map((hook) => hook.id)).toEqual([
      'cards',
      'remittance',
      'disputes',
    ]);
  });
});
