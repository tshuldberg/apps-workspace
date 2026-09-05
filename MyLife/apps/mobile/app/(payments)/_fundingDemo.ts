import type {
  PaymentsFundingFlowSnapshot,
  PaymentsFundingIntentRecord,
  PaymentsFundingLinkedAccount,
  PaymentsMoneyMovementFlow,
  PaymentsWalletSnapshot,
} from '@mylife/payments';

const SERVER_NOW = '2026-04-24T16:00:00.000Z';

const wallet: PaymentsWalletSnapshot = {
  walletId: 'wallet_sender',
  ownerUserId: 'user_sender',
  status: 'active',
  defaultCurrency: 'USD',
  balances: {
    available: 12_840,
    pending: 2_450,
    reserved: 750,
    escrow: 22_500,
  },
  complianceHold: 'none',
  sendLimitRemainingCents: 50_000,
  receiveLimitRemainingCents: 75_000,
};

const linkedAccounts: PaymentsFundingLinkedAccount[] = [
  {
    id: 'bank_thread_6789',
    institutionName: 'Thread Bank',
    displayName: 'Primary checking',
    last4: '6789',
    verificationState: 'verified',
    supportsInstantFunding: true,
    supportsInstantPayout: true,
    removable: false,
  },
  {
    id: 'bank_union_1122',
    institutionName: 'Union Credit',
    displayName: 'Savings',
    last4: '1122',
    verificationState: 'review',
    supportsInstantFunding: false,
    supportsInstantPayout: false,
    removable: true,
    relinkRequired: true,
  },
];

const intents: PaymentsFundingIntentRecord[] = [
  {
    intentId: 'funding_intent_0424',
    flow: 'add_money',
    status: 'pending',
    linkedAccountId: 'bank_thread_6789',
    amountCents: 2_450,
    currency: 'USD',
    speed: 'standard',
    feeCents: 0,
    initiatedAt: '2026-04-24T15:05:00.000Z',
    updatedAt: '2026-04-24T15:20:00.000Z',
    providerReference: 'pay_funding_intents/demo-0424',
  },
  {
    intentId: 'payout_intent_0423',
    flow: 'withdraw',
    status: 'returned',
    linkedAccountId: 'bank_thread_6789',
    amountCents: 5_000,
    currency: 'USD',
    speed: 'instant',
    feeCents: 50,
    initiatedAt: '2026-04-23T15:05:00.000Z',
    updatedAt: '2026-04-23T15:12:00.000Z',
    returnedReason: 'Provider returned the payout after account verification changed.',
    providerReference: 'pay_payout_intents/demo-0423',
  },
];

export function createFundingDemoSnapshot(
  flow: PaymentsMoneyMovementFlow,
): PaymentsFundingFlowSnapshot {
  return {
    wallet,
    linkedAccounts,
    intents,
    serverNow: SERVER_NOW,
    locale: 'en-US',
    partnerBankName: 'Thread Bank',
    custodialEntityName: 'MyPay Custody Partner',
    supportContact: 'support@mylife.app',
    draft: {
      flow,
      selectedLinkedAccountId: 'bank_thread_6789',
      amountText: flow === 'add_money' ? '25.00' : '40.00',
      speed: flow === 'add_money' ? 'standard' : 'instant',
      clientSubmissionId: `mobile-${flow}`,
    },
  };
}
