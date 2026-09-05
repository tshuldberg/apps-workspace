import { PaymentsLine, PaymentsPanel, PaymentsWebShell } from '../components';

export default function PaymentsRemittancePage() {
  return (
    <PaymentsWebShell title="Remittance" subtitle="Cross-border quote, recipient, and tracking shell.">
      <PaymentsPanel eyebrow="Quote" title="US-MX corridor">
        <PaymentsLine label="Crypto terminology" value="Hidden from user contract" />
        <PaymentsLine label="History" value="Reuses transaction detail shell" />
      </PaymentsPanel>
    </PaymentsWebShell>
  );
}
