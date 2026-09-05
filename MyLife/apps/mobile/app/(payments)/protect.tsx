import { DisclosureCallout, PaymentGlassCard, TimelineStepper } from '@mylife/payments';
import {
  DEMO_DISCLOSURE,
  DEMO_TIMELINE_STEPS,
  PaymentsScaffoldScreen,
} from './_demo';

export default function PaymentsProtectScreen() {
  return (
    <PaymentsScaffoldScreen
      title="Protect"
      subtitle="Fraud review, disputes, and operator approvals use the same disclosure and timeline system from day one."
    >
      <PaymentGlassCard eyebrow="Ops" title="Risk and dispute shell">
        <TimelineStepper steps={DEMO_TIMELINE_STEPS} />
        <DisclosureCallout disclosure={DEMO_DISCLOSURE} />
      </PaymentGlassCard>
    </PaymentsScaffoldScreen>
  );
}
