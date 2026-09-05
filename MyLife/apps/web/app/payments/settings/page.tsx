import { PaymentsLine, PaymentsPanel, PaymentsWebShell } from '../components';

export default function PaymentsSettingsPage() {
  return (
    <PaymentsWebShell title="Settings" subtitle="Profile, privacy, identifiers, limits, fees, and close-wallet state.">
      <PaymentsPanel eyebrow="Profile" title="Visibility and limits">
        <PaymentsLine label="Discoverability" value="Contacts only" />
        <PaymentsLine label="Limits" value="Product limits are separate from compliance ceilings" />
      </PaymentsPanel>
    </PaymentsWebShell>
  );
}
