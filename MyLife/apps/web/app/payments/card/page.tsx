import { buildPaymentsCardManagementViewModel } from '@mylife/payments';
import { PaymentsLine, PaymentsPanel, PaymentsWebShell } from '../components';

const card = buildPaymentsCardManagementViewModel({
  card: {
    cardId: 'web_card',
    form: 'virtual',
    status: 'active',
    maskedLabel: 'Virtual card ending 4242',
    holderName: 'Trey Example',
    spendLimitCents: 50000,
    currency: 'USD',
    physicalOrderStatus: 'not_ordered',
    provisioningProviders: ['apple_pay', 'google_pay'],
  },
});

export default function PaymentsCardPage() {
  return (
    <PaymentsWebShell title="Card" subtitle="Desktop card controls stay token-first.">
      <PaymentsPanel eyebrow="Card" title={card.maskedDisplay}>
        <PaymentsLine label="Sensitive data stored by MyLife" value={String(card.sensitiveDataStoredByMyLife)} />
        <PaymentsLine label="Reveal" value="Biometric gated" />
      </PaymentsPanel>
    </PaymentsWebShell>
  );
}
