import { PaymentsLine, PaymentsPanel, PaymentsWebShell } from '../components';

export default function PaymentsSendPage() {
  return (
    <PaymentsWebShell title="Send" subtitle="Web send route shares domain command semantics with mobile.">
      <PaymentsPanel eyebrow="Runtime" title="Server action boundary">
        <PaymentsLine label="Recipients" value="Handle, phone, email, contact, previous counterparty" />
        <PaymentsLine label="Confirmation" value="Biometric or step-up where configured" />
      </PaymentsPanel>
    </PaymentsWebShell>
  );
}
