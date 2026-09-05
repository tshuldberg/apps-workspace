import {
  buildPaymentsProfile,
  type PaymentsSettingsSnapshot,
} from '@mylife/payments';

export function createPaymentsSettingsDemoSnapshot(): PaymentsSettingsSnapshot {
  const profile = buildPaymentsProfile({
    ownerUserId: 'user_sender',
    primaryWalletId: 'wallet_sender',
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

  return {
    profile,
    wallet: {
      walletId: 'wallet_sender',
      ownerUserId: 'user_sender',
      status: 'active',
      defaultCurrency: 'USD',
      balances: {
        available: 12_840,
        pending: 2_450,
        reserved: 0,
        escrow: 0,
      },
      complianceHold: 'none',
      sendLimitRemainingCents: 50_000,
      receiveLimitRemainingCents: 75_000,
    },
    discoverability: 'contacts_only',
    preferredContactMethod: 'handle',
    identifiers: [
      {
        id: 'handle',
        kind: 'handle',
        label: 'Handle',
        value: '@trey',
        verificationState: 'verified',
        preferred: true,
      },
      {
        id: 'email',
        kind: 'email',
        label: 'Email',
        value: 'trey@example.com',
        verificationState: 'verified',
        preferred: false,
      },
      {
        id: 'phone',
        kind: 'phone',
        label: 'Phone',
        value: '+1 555 555 0123',
        verificationState: 'verified',
        preferred: false,
      },
    ],
    contacts: [
      {
        id: 'user_avery',
        displayName: 'Avery Stone',
        handle: '@avery',
        verification: 'verified',
      },
      {
        id: 'user_riley',
        displayName: 'Riley Chen',
        handle: '@riley',
        verification: 'review',
      },
    ],
    favoriteCounterpartyIds: ['user_avery'],
    notifications: [
      { topic: 'payments', channel: 'push', enabled: true },
      { topic: 'requests', channel: 'push', enabled: true },
      { topic: 'disputes', channel: 'email', enabled: true },
      { topic: 'funding', channel: 'email', enabled: true },
      { topic: 'marketing', channel: 'email', enabled: false },
    ],
    selfImposedLimits: [
      {
        id: 'daily_send',
        label: 'Daily send',
        amountCents: 20_000,
        complianceLimitCents: 50_000,
        currency: 'USD',
      },
      {
        id: 'single_card',
        label: 'Single card purchase',
        amountCents: 15_000,
        complianceLimitCents: 50_000,
        currency: 'USD',
      },
    ],
    feeSchedule: [
      {
        id: 'p2p',
        label: 'Wallet transfers',
        value: '$0.00',
        disclosure: 'Standard wallet transfers are free in this demo configuration.',
      },
      {
        id: 'instant_payout',
        label: 'Instant withdrawal',
        value: '1%, $0.50 minimum',
        disclosure: 'Instant availability depends on provider support and risk review.',
      },
      {
        id: 'remittance',
        label: 'International send',
        value: 'Shown in quote',
        disclosure: 'Fees, FX rate, and recipient amount are disclosed before confirmation.',
      },
    ],
    walletClose: {
      exportReady: true,
    },
    generatedAt: '2026-04-24T16:00:00.000Z',
    locale: 'en-US',
    partnerBankName: 'Thread Bank',
    custodialEntityName: 'MyPay Custody Partner',
    supportContact: 'support@mylife.app',
  };
}
