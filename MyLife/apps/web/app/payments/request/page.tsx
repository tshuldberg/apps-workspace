import { PaymentsLine, PaymentsPanel, PaymentsWebShell } from '../components';

export default function PaymentsRequestPage() {
  return (
    <PaymentsWebShell title="Request" subtitle="Direct requests and payment links reuse the shared request selectors.">
      <PaymentsPanel eyebrow="Requests" title="Known user and payment link">
        <PaymentsLine label="Expiry" value="Explicit on every link" />
        <PaymentsLine label="Acceptance" value="Routes through the send engine" />
      </PaymentsPanel>
    </PaymentsWebShell>
  );
}
