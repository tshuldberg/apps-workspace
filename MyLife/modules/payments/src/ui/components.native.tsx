import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import {
  PAY_ACCENT,
  PAY_BORDER,
  PAY_GLASS,
  PAY_RADIUS,
  PAY_SURFACES,
  PAY_TEXT,
  PAY_TEXT_MUTED,
  PAY_TEXT_SECONDARY,
  getPaymentDisclosureMeta,
  getPaymentStatusMeta,
  getPaymentTimelineStepMeta,
  getPaymentVerificationMeta,
} from './tokens';
import {
  PAY_FONT_BOLD,
  PAY_FONT_EXTRABOLD,
  PAY_FONT_MEDIUM,
  PAY_FONT_REGULAR,
  PAY_FONT_SEMIBOLD,
  PAY_NATIVE_TABULAR_NUMS,
} from './typography';
import {
  formatCounterpartyLabel,
  formatPaymentAmount,
  formatPaymentTimestamp,
} from './format';
import type {
  PaymentActivityItem,
  PaymentCounterparty,
  PaymentDisclosure,
  PaymentDisclosureTone,
  PaymentStatus,
  PaymentTimelineStep,
} from '../types';

interface PaymentGlassCardProps {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  footer?: ReactNode;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

interface AmountDisplayProps {
  amountCents: number;
  currency: string;
  direction?: 'incoming' | 'outgoing' | 'neutral';
  pending?: boolean;
  compact?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
  valueStyle?: StyleProp<TextStyle>;
}

interface ContactPillProps {
  counterparty: PaymentCounterparty;
  style?: StyleProp<ViewStyle>;
}

interface StatusBadgeProps {
  status?: PaymentStatus;
  tone?: PaymentDisclosureTone;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

interface DisclosureCalloutProps {
  disclosure: PaymentDisclosure | {
    tone: PaymentDisclosureTone;
    title: string;
    body: string;
    footnote?: string;
  };
  style?: StyleProp<ViewStyle>;
}

interface TimelineStepperProps {
  steps: PaymentTimelineStep[];
  style?: StyleProp<ViewStyle>;
}

interface TransactionRowProps {
  item: PaymentActivityItem;
  style?: StyleProp<ViewStyle>;
}

export function PaymentGlassCard({
  children,
  title,
  eyebrow,
  footer,
  accentColor = PAY_ACCENT,
  style,
}: PaymentGlassCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      {(eyebrow || title) ? (
        <View style={styles.cardHeader}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
        </View>
      ) : null}
      <View style={styles.cardBody}>{children}</View>
      {footer ? <View>{footer}</View> : null}
    </View>
  );
}

export function AmountDisplay({
  amountCents,
  currency,
  direction = 'neutral',
  pending = false,
  compact = false,
  label,
  style,
  valueStyle,
}: AmountDisplayProps) {
  return (
    <View style={[styles.amountWrap, style]}>
      {label ? <Text style={styles.amountLabel}>{label}</Text> : null}
      <Text style={[styles.amountValue, valueStyle]}>
        {formatPaymentAmount(
          { amountCents, currency },
          { direction, pending, compact, includeSign: direction !== 'neutral' },
        )}
      </Text>
    </View>
  );
}

export function ContactPill({ counterparty, style }: ContactPillProps) {
  const verification = getPaymentVerificationMeta(counterparty.verification);
  return (
    <View style={[styles.contactPill, style]}>
      <View style={[styles.statusDot, { backgroundColor: verification.dot }]} />
      <Text style={styles.contactName}>{counterparty.displayName}</Text>
      <Text style={styles.contactMeta}>{counterparty.handle ?? verification.label}</Text>
    </View>
  );
}

export function StatusBadge({ status, tone = 'info', label, style }: StatusBadgeProps) {
  const meta = status ? getPaymentStatusMeta(status) : getPaymentDisclosureMeta(tone);
  const badgeLabel = label ?? ('label' in meta ? meta.label : meta.eyebrow);
  const dot = 'dot' in meta ? meta.dot : meta.text;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: meta.background,
          borderColor: meta.border,
        },
        style,
      ]}
    >
      <View style={[styles.badgeDot, { backgroundColor: dot }]} />
      <Text style={[styles.badgeText, { color: meta.text }]}>{badgeLabel}</Text>
    </View>
  );
}

export function DisclosureCallout({ disclosure, style }: DisclosureCalloutProps) {
  const meta = getPaymentDisclosureMeta(disclosure.tone);
  return (
    <View
      style={[
        styles.disclosure,
        {
          backgroundColor: meta.background,
          borderColor: meta.border,
        },
        style,
      ]}
    >
      <Text style={[styles.disclosureEyebrow, { color: meta.text }]}>{meta.eyebrow}</Text>
      <Text style={styles.disclosureTitle}>{disclosure.title}</Text>
      <Text style={styles.disclosureBody}>{disclosure.body}</Text>
      {disclosure.footnote ? <Text style={styles.disclosureFootnote}>{disclosure.footnote}</Text> : null}
    </View>
  );
}

export function TimelineStepper({ steps, style }: TimelineStepperProps) {
  return (
    <View style={[styles.timeline, style]}>
      {steps.map((step, index) => {
        const meta = getPaymentTimelineStepMeta(step.state);
        return (
          <View key={step.id} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: meta.dot,
                    borderColor: meta.border,
                  },
                ]}
              />
              {index < steps.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineTitle, { color: meta.text }]}>{step.title}</Text>
              {step.detail ? <Text style={styles.timelineDetail}>{step.detail}</Text> : null}
              {step.timestamp ? <Text style={styles.timelineTimestamp}>{step.timestamp}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function TransactionRow({ item, style }: TransactionRowProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.rowText}>
        <View style={styles.rowTitleWrap}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.rowSubtitle}>
          {item.subtitle ?? formatCounterpartyLabel(item.counterparty)}
        </Text>
        <Text style={styles.rowTimestamp}>{formatPaymentTimestamp(item.occurredAt)}</Text>
      </View>
      <AmountDisplay
        amountCents={item.amountCents}
        currency={item.currency}
        direction={item.direction}
        pending={item.status === 'pending'}
        style={styles.rowAmount}
        valueStyle={styles.rowAmountValue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PAY_GLASS.strong,
    borderWidth: 1,
    borderColor: PAY_GLASS.border,
    borderRadius: PAY_RADIUS.card,
    padding: 20,
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 112,
    height: 4,
    borderRadius: PAY_RADIUS.pill,
  },
  cardHeader: {
    gap: 6,
  },
  cardBody: {
    gap: 14,
  },
  eyebrow: {
    color: PAY_TEXT_MUTED,
    fontFamily: PAY_FONT_SEMIBOLD,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: PAY_TEXT,
    fontFamily: PAY_FONT_BOLD,
    fontSize: 24,
  },
  amountWrap: {
    gap: 4,
  },
  amountLabel: {
    color: PAY_TEXT_MUTED,
    fontFamily: PAY_FONT_SEMIBOLD,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  amountValue: {
    color: PAY_TEXT,
    fontFamily: PAY_FONT_EXTRABOLD,
    fontSize: 24,
    letterSpacing: -0.6,
    fontVariant: PAY_NATIVE_TABULAR_NUMS,
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: PAY_RADIUS.pill,
    borderWidth: 1,
    borderColor: PAY_BORDER,
    backgroundColor: '#081E17',
  },
  contactName: {
    color: PAY_TEXT,
    fontFamily: PAY_FONT_SEMIBOLD,
    fontSize: 14,
  },
  contactMeta: {
    color: PAY_TEXT_SECONDARY,
    fontFamily: PAY_FONT_REGULAR,
    fontSize: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: PAY_RADIUS.badge,
    borderWidth: 1,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: PAY_RADIUS.badge,
  },
  badgeText: {
    fontFamily: PAY_FONT_SEMIBOLD,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  disclosure: {
    gap: 8,
    borderWidth: 1,
    borderRadius: PAY_RADIUS.row,
    padding: 16,
  },
  disclosureEyebrow: {
    fontFamily: PAY_FONT_SEMIBOLD,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  disclosureTitle: {
    color: PAY_TEXT,
    fontFamily: PAY_FONT_BOLD,
    fontSize: 15,
  },
  disclosureBody: {
    color: PAY_TEXT_SECONDARY,
    fontFamily: PAY_FONT_REGULAR,
    fontSize: 14,
    lineHeight: 20,
  },
  disclosureFootnote: {
    color: PAY_TEXT_MUTED,
    fontFamily: PAY_FONT_MEDIUM,
    fontSize: 12,
  },
  timeline: {
    gap: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 14,
  },
  timelineRail: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: PAY_RADIUS.badge,
    borderWidth: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 26,
    borderRadius: PAY_RADIUS.badge,
    backgroundColor: 'rgba(148, 163, 184, 0.24)',
  },
  timelineContent: {
    flex: 1,
    gap: 4,
  },
  timelineTitle: {
    fontFamily: PAY_FONT_SEMIBOLD,
    fontSize: 14,
  },
  timelineDetail: {
    color: PAY_TEXT_SECONDARY,
    fontFamily: PAY_FONT_REGULAR,
    fontSize: 13,
    lineHeight: 18,
  },
  timelineTimestamp: {
    color: PAY_TEXT_MUTED,
    fontFamily: PAY_FONT_MEDIUM,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    padding: 16,
    borderRadius: PAY_RADIUS.row,
    borderWidth: 1,
    borderColor: PAY_BORDER,
    backgroundColor: PAY_SURFACES.card,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  rowTitleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    color: PAY_TEXT,
    fontFamily: PAY_FONT_SEMIBOLD,
    fontSize: 15,
  },
  rowSubtitle: {
    color: PAY_TEXT_SECONDARY,
    fontFamily: PAY_FONT_REGULAR,
    fontSize: 13,
  },
  rowTimestamp: {
    color: PAY_TEXT_MUTED,
    fontFamily: PAY_FONT_MEDIUM,
    fontSize: 12,
  },
  rowAmount: {
    alignItems: 'flex-end',
  },
  rowAmountValue: {
    fontSize: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: PAY_RADIUS.badge,
  },
});
