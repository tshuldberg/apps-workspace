import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  DisclosureCallout,
  PaymentGlassCard,
  StatusBadge,
  TimelineStepper,
  buildPaymentsActivityFeedViewModel,
} from '@mylife/payments';
import { colors } from '@mylife/ui';
import {
  PAYMENTS_ACTIVITY_DEMO_BASE,
} from './_activityDemo';

const BackIcon = icons.ChevronLeft;
const IssueIcon = icons.ShieldAlert;
const ReferenceIcon = icons.FileText;

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export default function PaymentsActivityDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id);
  const viewModel = useMemo(
    () => buildPaymentsActivityFeedViewModel({
      ...PAYMENTS_ACTIVITY_DEMO_BASE,
      selectedActivityId: id,
    }),
    [id],
  );
  const detail = viewModel.selectedDetail;

  if (!detail) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to activity"
            style={styles.iconButton}
            onPress={() => router.back()}
          >
            <BackIcon size={20} color="#F5FBF8" strokeWidth={2} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Transaction</Text>
            <Text style={styles.subtitle}>Activity record not found</Text>
          </View>
        </View>
        <PaymentGlassCard eyebrow="Missing" title="No transaction detail">
          <Text style={styles.bodyText}>
            This activity ID is not present in the current server feed snapshot.
          </Text>
        </PaymentGlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to activity"
          style={styles.iconButton}
          onPress={() => router.back()}
        >
          <BackIcon size={20} color="#F5FBF8" strokeWidth={2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{detail.title}</Text>
          <Text style={styles.subtitle}>{detail.subtitle}</Text>
        </View>
      </View>

      <PaymentGlassCard eyebrow={detail.kindLabel} title={detail.amountLabel}>
        <View style={styles.heroMeta}>
          <StatusBadge status={detail.status} label={detail.statusLabel} />
          <View style={styles.railPill}>
            <ReferenceIcon size={13} color="#BAE6FD" strokeWidth={2} />
            <Text style={styles.railPillText}>{detail.railLabel}</Text>
          </View>
        </View>
        {detail.note ? <Text style={styles.noteText}>{detail.note}</Text> : null}
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Parties" title="People and accounts">
        <View style={styles.lineStack}>
          {detail.parties.map((party) => (
            <View key={party.id} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{party.label}</Text>
              <Text style={styles.lineValue}>{party.value}</Text>
            </View>
          ))}
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Fees" title="Balance impact">
        <View style={styles.lineStack}>
          {detail.feeBreakdown.map((line) => (
            <View key={line.id} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{line.label}</Text>
              <Text
                style={[
                  styles.lineValue,
                  line.emphasis === 'warning' && styles.warningText,
                  line.emphasis === 'positive' && styles.positiveText,
                  line.emphasis === 'danger' && styles.dangerText,
                ]}
              >
                {line.value}
              </Text>
            </View>
          ))}
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Timeline" title="Status history">
        <TimelineStepper steps={detail.timeline} />
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="References" title="Provider and ledger IDs">
        <View style={styles.lineStack}>
          {detail.references.map((reference) => (
            <View key={reference.id} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{reference.label}</Text>
              <Text style={styles.referenceValue}>{reference.value}</Text>
            </View>
          ))}
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Issue" title={detail.issueEntryPoint.label}>
        <View style={styles.issueHeader}>
          <View style={styles.issueIconWrap}>
            <IssueIcon size={18} color="#FED7AA" strokeWidth={2} />
          </View>
          <View style={styles.issueText}>
            <Text style={styles.issueTitle}>
              {detail.issueEntryPoint.enabled ? 'Available from this transaction' : 'Not available here'}
            </Text>
            <Text style={styles.issueBody}>
              {detail.issueEntryPoint.reason ??
                detail.issueEntryPoint.draft?.nextStep ??
                'Choose a reason and attach evidence from this transaction detail.'}
            </Text>
          </View>
        </View>
      </PaymentGlassCard>

      {detail.disclosures.map((disclosure) => (
        <DisclosureCallout key={disclosure.id} disclosure={disclosure} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: 18,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#F5FBF8',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(245,251,248,0.68)',
    fontSize: 15,
    lineHeight: 21,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  railPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(186,230,253,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(56,189,248,0.10)',
  },
  railPillText: {
    color: '#BAE6FD',
    fontSize: 12,
    fontWeight: '700',
  },
  noteText: {
    color: 'rgba(245,251,248,0.72)',
    fontSize: 14,
    lineHeight: 20,
  },
  bodyText: {
    color: 'rgba(245,251,248,0.70)',
    fontSize: 14,
    lineHeight: 20,
  },
  lineStack: {
    gap: 12,
  },
  lineRow: {
    gap: 5,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  lineLabel: {
    color: 'rgba(245,251,248,0.54)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  lineValue: {
    color: '#F5FBF8',
    fontSize: 15,
    fontWeight: '700',
  },
  referenceValue: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '700',
  },
  warningText: {
    color: '#FED7AA',
  },
  positiveText: {
    color: '#A7F3D0',
  },
  dangerText: {
    color: '#FECACA',
  },
  issueHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  issueIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,146,60,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.24)',
  },
  issueText: {
    flex: 1,
    gap: 4,
  },
  issueTitle: {
    color: '#F5FBF8',
    fontSize: 15,
    fontWeight: '700',
  },
  issueBody: {
    color: 'rgba(245,251,248,0.68)',
    fontSize: 13,
    lineHeight: 19,
  },
});
