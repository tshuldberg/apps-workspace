import { describe, expect, it } from 'vitest';

import { buildPaymentsProfile } from '../../compliance/profile';
import {
  buildPaymentsSettingsViewModel,
  type PaymentsSettingsSnapshot,
} from '../settings';

function makeSnapshot(): PaymentsSettingsSnapshot {
  return {
    profile: buildPaymentsProfile({
      ownerUserId: 'user_1',
      primaryWalletId: 'wallet_1',
      handle: '@trey',
      displayName: 'Trey',
      identityStatus: 'verified',
      verificationState: 'verified',
      approvedTier: 'basic',
      fields: { legalName: 'Trey Example' },
    }),
    wallet: {
      walletId: 'wallet_1',
      ownerUserId: 'user_1',
      status: 'active',
      defaultCurrency: 'USD',
      balances: { available: 0, pending: 0, reserved: 0, escrow: 0 },
      complianceHold: 'none',
    },
    discoverability: 'contacts_only',
    identifiers: [],
    preferredContactMethod: 'handle',
    contacts: [],
    favoriteCounterpartyIds: [],
    notifications: [],
    selfImposedLimits: [
      {
        id: 'daily',
        label: 'Daily send',
        amountCents: 20000,
        complianceLimitCents: 50000,
        currency: 'USD',
      },
    ],
    feeSchedule: [],
    walletClose: { exportReady: true },
    generatedAt: '2026-04-24T16:00:00.000Z',
  };
}

describe('payments settings view model', () => {
  it('separates profile visibility, product limits, compliance limits, and close state', () => {
    const state = buildPaymentsSettingsViewModel(makeSnapshot());

    expect(state.discoverability.label).toBe('Contacts only');
    expect(state.limits.product[0]?.value).toBe('$200.00');
    expect(state.limits.compliance[0]?.value).toBe('$500.00');
    expect(state.walletClose.canClose).toBe(true);
  });
});
