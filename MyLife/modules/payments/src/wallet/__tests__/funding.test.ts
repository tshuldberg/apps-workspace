import { describe, expect, it } from 'vitest';

import type { PaymentsWalletSnapshot } from '../../engine/types';
import {
  buildPaymentsFundingFlowViewModel,
  type PaymentsFundingFlowSnapshot,
} from '../funding';

function makeWallet(): PaymentsWalletSnapshot {
  return {
    walletId: 'wallet_1',
    ownerUserId: 'user_1',
    status: 'active',
    defaultCurrency: 'USD',
    balances: { available: 10000, pending: 2500, reserved: 0, escrow: 0 },
    complianceHold: 'none',
  };
}

function makeSnapshot(flow: 'add_money' | 'withdraw'): PaymentsFundingFlowSnapshot {
  return {
    wallet: makeWallet(),
    linkedAccounts: [
      {
        id: 'bank_1',
        institutionName: 'Thread Bank',
        displayName: 'Checking',
        last4: '6789',
        verificationState: 'verified',
        supportsInstantFunding: true,
        supportsInstantPayout: true,
        removable: false,
      },
    ],
    intents: [],
    serverNow: '2026-04-24T16:00:00.000Z',
    draft: {
      flow,
      selectedLinkedAccountId: 'bank_1',
      amountText: '25.00',
      speed: 'instant',
      clientSubmissionId: `test-${flow}`,
    },
  };
}

describe('payments funding flow view model', () => {
  it('builds explicit funding and payout intent commands', () => {
    const add = buildPaymentsFundingFlowViewModel(makeSnapshot('add_money'));
    const withdraw = buildPaymentsFundingFlowViewModel(makeSnapshot('withdraw'));

    expect(add.commandPreview?.command.type).toBe('fund');
    expect(add.commandPreview?.command.metadata?.intentTable).toBe('pay_funding_intents');
    expect(withdraw.commandPreview?.command.type).toBe('withdraw');
    expect(withdraw.commandPreview?.command.metadata?.intentTable).toBe('pay_payout_intents');
  });
});
