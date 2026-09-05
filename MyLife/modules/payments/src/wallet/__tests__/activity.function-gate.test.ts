import { describe, expect, it } from 'vitest';

import type {
  PaymentsTransferRecord,
} from '../../engine/types';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  buildPaymentsActivityFeedViewModel,
} from '../activity';
import type {
  PaymentsActivityFeedSnapshot,
  PaymentsActivityFilter,
  PaymentsActivityRecord,
} from '../activity';
import type {
  PaymentsRequestRecord,
} from '../request';

const NOW = '2026-04-24T16:00:00.000Z';
const WALLET_ID = 'wallet_activity_fn_gate';
const OWNER_USER_ID = 'user_activity_fn_gate';
const FILTERS: PaymentsActivityFilter[] = [
  'all',
  'sent',
  'received',
  'pending',
  'requests',
  'card',
  'remittance',
];

function makeTransfer(
  index: number,
  overrides: Partial<PaymentsTransferRecord> = {},
): PaymentsTransferRecord {
  return {
    transferId: `transfer_${index}`,
    idempotencyKey: `key_transfer_${index}`,
    kind: 'p2p',
    status: 'completed',
    sourceWalletId: WALLET_ID,
    destinationWalletId: `wallet_counterparty_${index}`,
    sourceBalanceBucket: 'available',
    destinationBalanceBucket: 'available',
    sourceAmountCents: 500 + index * 25,
    sourceCurrency: 'USD',
    destinationAmountCents: 500 + index * 25,
    destinationCurrency: 'USD',
    feeAmountCents: index % 4 === 0 ? 25 : 0,
    feeWalletId: WALLET_ID,
    sourceRail: 'wallet',
    destinationRail: 'wallet',
    memo: `Transfer ${index}`,
    externalReference: `provider_${index}`,
    metadata: {},
    ...overrides,
  };
}

function makeRequest(index: number): PaymentsRequestRecord {
  return {
    requestId: `request_${index}`,
    idempotencyKey: `key_request_${index}`,
    status: index % 3 === 0 ? 'paid' : 'open',
    requesterWalletId: WALLET_ID,
    payerWalletId: `wallet_counterparty_${index}`,
    amountCents: 400 + index * 20,
    currency: 'USD',
    expiresAt: '2026-04-25T16:00:00.000Z',
    memo: `Request ${index}`,
    metadata: {},
    createdAt: `2026-04-24T${String(8 + (index % 8)).padStart(2, '0')}:00:00.000Z`,
    requesterDisplayName: 'Function Gate',
    payerDisplayName: `Counterparty ${index}`,
  };
}

function makeRecord(index: number): PaymentsActivityRecord {
  if (index % 5 === 0) {
    return {
      source: 'request',
      request: makeRequest(index),
      counterparty: {
        id: `user_counterparty_${index}`,
        displayName: `Counterparty ${index}`,
        verification: 'verified',
      },
    };
  }

  const transferKinds = [
    'p2p',
    'card_capture',
    'remittance_send',
    'escrow_hold',
    'withdraw_wallet',
  ] as const;
  const kind = transferKinds[index % transferKinds.length];
  return {
    source: 'transfer',
    occurredAt: `2026-04-${String(24 - (index % 2)).padStart(2, '0')}T${String(8 + (index % 8)).padStart(2, '0')}:30:00.000Z`,
    counterparty: {
      id: `user_counterparty_${index}`,
      displayName: `Counterparty ${index}`,
      verification: index % 7 === 0 ? 'review' : 'verified',
    },
    sourceDisplayName: 'Function Gate',
    destinationDisplayName: `Counterparty ${index}`,
    providerName: 'Function Provider',
    providerReference: `provider_${index}`,
    transfer: makeTransfer(index, {
      kind,
      status: kind === 'escrow_hold' ? 'pending_review' : 'completed',
      sourceWalletId: index % 6 === 0 ? `wallet_counterparty_${index}` : WALLET_ID,
      destinationWalletId: index % 6 === 0 ? WALLET_ID : `wallet_counterparty_${index}`,
      sourceRail:
        kind === 'card_capture'
          ? 'card'
          : kind === 'remittance_send'
            ? 'wallet'
            : 'wallet',
      destinationRail:
        kind === 'card_capture'
          ? 'merchant'
          : kind === 'remittance_send'
            ? 'remittance'
            : kind === 'withdraw_wallet'
              ? 'bank'
              : 'wallet',
    }),
  };
}

function makeSnapshot(input: {
  count?: number;
  filter?: PaymentsActivityFilter;
  selectedIndex?: number | null;
} = {}): PaymentsActivityFeedSnapshot {
  const count = input.count ?? 12;
  const items = Array.from({ length: count }, (_, index) => makeRecord(index));
  const selected = input.selectedIndex === null
    ? null
    : items[Math.min(input.selectedIndex ?? 1, Math.max(items.length - 1, 0))];
  const selectedActivityId = selected?.source === 'transfer'
    ? selected.transfer.transferId
    : selected?.request.requestId ?? null;

  return {
    ownerUserId: OWNER_USER_ID,
    walletId: WALLET_ID,
    now: NOW,
    locale: 'en-US',
    filter: input.filter,
    selectedActivityId,
    items,
  };
}

describe('buildPaymentsActivityFeedViewModel function quality gate', () => {
  it('matches contract behavior for feed filters and selected detail', () => {
    const all = buildPaymentsActivityFeedViewModel(makeSnapshot());
    const card = buildPaymentsActivityFeedViewModel(makeSnapshot({ filter: 'card' }));
    const detail = all.selectedDetail;

    expect(all.filters).toHaveLength(FILTERS.length);
    expect(all.rows).toHaveLength(12);
    expect(card.rows.every((row) => row.kind === 'card_purchase')).toBe(true);
    expect(detail?.id).toBe('transfer_1');
    expect(detail?.issueEntryPoint.label).toBe('Report an issue');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildPaymentsActivityFeedViewModel fuzz',
      iterations: 70,
      seed: 44,
      makeCase: (rng) => makeSnapshot({
        count: randomInt(rng, 1, 44),
        filter: FILTERS[randomInt(rng, 0, FILTERS.length - 1)],
        selectedIndex: rng() > 0.16 ? randomInt(rng, 0, 43) : null,
      }),
      assertCase: async (input) => {
        const result = buildPaymentsActivityFeedViewModel(input);

        expect(result.title).toBe('Activity');
        expect(result.filters.map((filter) => filter.id)).toEqual(FILTERS);
        expect(result.rows.length).toBeLessThanOrEqual(input.items.length);
        for (const group of result.groups) {
          expect(group.rows.length).toBeGreaterThan(0);
        }
        if (input.filter && input.filter !== 'all') {
          expect(result.rows.every((row) => (
            row.filterTags.includes(input.filter as PaymentsActivityFilter)
          ))).toBe(true);
        }
        if (input.selectedActivityId) {
          expect(result.selectedDetail?.id).toBe(input.selectedActivityId);
        } else {
          expect(result.selectedDetail).toBeNull();
        }
      },
    });
  });

  it('keeps runtime growth bounded for larger feeds', async () => {
    await assertComplexitySlope({
      label: 'buildPaymentsActivityFeedViewModel complexity',
      sizes: [16, 32, 64, 128],
      warmupRuns: 1,
      sampleRuns: 4,
      setup: (size) => makeSnapshot({ count: size, selectedIndex: size - 1 }),
      run: (input) => {
        for (let index = 0; index < 20; index += 1) {
          buildPaymentsActivityFeedViewModel(input);
        }
      },
      maxRatios: [3.5, 3.5, 3.5],
    });
  }, 10_000);

  it('stays within a modest memory budget for generated feed state', async () => {
    await assertMemoryBudget({
      label: 'buildPaymentsActivityFeedViewModel memory',
      setup: () => makeSnapshot({ count: 80, selectedIndex: 12 }),
      run: (input) => {
        buildPaymentsActivityFeedViewModel(input);
      },
      repeats: 8,
      maxHeapDeltaBytes: 10_000_000,
    });
  });
});
