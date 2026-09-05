import { PaymentsLine, PaymentsPanel, PaymentsWebShell } from '../components';

export default async function PaymentsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PaymentsWebShell title="Transaction detail" subtitle="Desktop detail shell links back to the server-authoritative MyPay activity record.">
      <PaymentsPanel eyebrow="Reference" title={id}>
        <PaymentsLine label="Detail shell" value="Amount, parties, fee, timeline, provider reference, note, disclosures" />
        <PaymentsLine label="Issue reporting" value="Starts from this transaction" />
      </PaymentsPanel>
    </PaymentsWebShell>
  );
}
