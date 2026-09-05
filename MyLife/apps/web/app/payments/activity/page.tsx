import { buildPaymentsActivityFeedViewModel } from '@mylife/payments';
import { PaymentsLine, PaymentsPanel, PaymentsWebShell } from '../components';

const feed = buildPaymentsActivityFeedViewModel({
  ownerUserId: 'user_web',
  walletId: 'wallet_web',
  now: '2026-04-24T16:00:00.000Z',
  items: [
    {
      source: 'transfer',
      occurredAt: '2026-04-24T15:00:00.000Z',
      transfer: {
        transferId: 'web_transfer_1',
        idempotencyKey: 'web_transfer_1',
        kind: 'p2p',
        status: 'completed',
        sourceWalletId: 'wallet_web',
        destinationWalletId: 'wallet_avery',
        sourceBalanceBucket: 'available',
        destinationBalanceBucket: 'available',
        sourceAmountCents: 2450,
        sourceCurrency: 'USD',
        destinationAmountCents: 2450,
        destinationCurrency: 'USD',
        feeAmountCents: 0,
        feeWalletId: null,
        sourceRail: 'wallet',
        destinationRail: 'wallet',
        memo: 'Dinner',
        externalReference: 'web_provider_1',
        metadata: {},
      },
    },
  ],
});

export default function PaymentsActivityPage() {
  return (
    <PaymentsWebShell title="Activity" subtitle="Responsive MyPay feed using the shared transaction view model.">
      <PaymentsPanel eyebrow="Feed" title={`${feed.rows.length} rows`}>
        {feed.rows.map((row) => (
          <PaymentsLine key={row.id} label={row.kindLabel} value={row.statusLabel} />
        ))}
      </PaymentsPanel>
    </PaymentsWebShell>
  );
}
