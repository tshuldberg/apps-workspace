import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AmountDisplay,
  ContactPill,
  DisclosureCallout,
  PaymentGlassCard,
  TimelineStepper,
  TransactionRow,
  type PaymentActivityItem,
  type PaymentCounterparty,
  type PaymentDisclosure,
  type PaymentTimelineStep,
} from '@mylife/payments';
import { colors } from '@mylife/ui';

export const DEMO_COUNTERPARTY: PaymentCounterparty = {
  id: 'demo-counterparty',
  displayName: 'Avery Stone',
  handle: '@avery',
  verification: 'verified',
};

export const DEMO_ACTIVITY_ITEMS: PaymentActivityItem[] = [
  {
    id: 'txn-1',
    title: 'Dinner split',
    subtitle: 'Dining projection ready',
    amountCents: 4825,
    currency: 'USD',
    direction: 'incoming',
    status: 'posted',
    rail: 'internal',
    counterparty: DEMO_COUNTERPARTY,
    occurredAt: '2026-04-20T18:25:00.000Z',
  },
  {
    id: 'txn-2',
    title: 'Cash out to bank',
    subtitle: 'Settlement review path',
    amountCents: 12000,
    currency: 'USD',
    direction: 'outgoing',
    status: 'pending',
    rail: 'bank',
    counterparty: DEMO_COUNTERPARTY,
    occurredAt: '2026-04-20T19:05:00.000Z',
    pendingReason: 'Standard ACH hold',
  },
];

export const DEMO_DISCLOSURE: PaymentDisclosure = {
  id: 'disclosure-1',
  tone: 'warning',
  title: 'Remittance and dispute disclosures stay first-class.',
  body:
    'This scaffold keeps legal copy, fee transparency, and operator review states reusable from the first screen instead of bolted on later.',
  footnote: 'Phase 0 keeps Payments hidden until the runtime, ledger, and compliance layers exist.',
};

export const DEMO_TIMELINE_STEPS: PaymentTimelineStep[] = [
  {
    id: 'step-1',
    title: 'Ledger intent created',
    detail: 'Server runtime writes the authoritative payment intent.',
    state: 'complete',
    timestamp: 'Apr 20 · 6:25 PM',
  },
  {
    id: 'step-2',
    title: 'Provider orchestration',
    detail: 'Fake provider mode exercises the full path without live rails.',
    state: 'current',
    timestamp: 'Apr 20 · 6:26 PM',
  },
  {
    id: 'step-3',
    title: 'Projection fanout',
    detail: 'Budget, Market, RSVP, and Dining consume projections later.',
    state: 'upcoming',
  },
];

interface PaymentsScaffoldScreenProps {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}

export function PaymentsScaffoldScreen({
  title,
  subtitle,
  children,
}: PaymentsScaffoldScreenProps) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {children}
    </ScrollView>
  );
}

export function PaymentsOverviewContent() {
  return (
    <View style={styles.stack}>
      <PaymentGlassCard eyebrow="Phase 0" title="Hidden payments scaffold">
        <AmountDisplay
          amountCents={248560}
          currency="USD"
          direction="incoming"
          label="Authoritative balance preview"
        />
        <ContactPill counterparty={DEMO_COUNTERPARTY} />
        <DisclosureCallout disclosure={DEMO_DISCLOSURE} />
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Activity" title="Shared transaction row">
        {DEMO_ACTIVITY_ITEMS.map((item) => (
          <TransactionRow key={item.id} item={item} />
        ))}
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Runtime" title="Settlement timeline">
        <TimelineStepper steps={DEMO_TIMELINE_STEPS} />
      </PaymentGlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  title: {
    color: '#F5FBF8',
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(245, 251, 248, 0.68)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  stack: {
    gap: 16,
  },
});
