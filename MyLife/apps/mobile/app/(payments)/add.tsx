import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  DisclosureCallout,
  PaymentGlassCard,
  StatusBadge,
  TimelineStepper,
  buildPaymentsFundingFlowViewModel,
} from '@mylife/payments';
import { colors } from '@mylife/ui';
import { createFundingDemoSnapshot } from './_fundingDemo';

const BackIcon = icons.ChevronLeft;
const BankIcon = icons.Landmark;

export default function PaymentsAddMoneyScreen() {
  const router = useRouter();
  const viewModel = useMemo(
    () => buildPaymentsFundingFlowViewModel(createFundingDemoSnapshot('add_money')),
    [],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <BackIcon size={20} color="#F5FBF8" strokeWidth={2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{viewModel.title}</Text>
          <Text style={styles.subtitle}>Provider-backed bank linking and funding intents</Text>
        </View>
      </View>

      <PaymentGlassCard eyebrow="Linked account" title={viewModel.selectedAccount?.displayName ?? 'Select account'}>
        {viewModel.linkedAccounts.map((account) => (
          <View key={account.id} style={styles.accountRow}>
            <BankIcon size={18} color="#BAE6FD" strokeWidth={2} />
            <View style={styles.accountCopy}>
              <Text style={styles.accountTitle}>{account.label}</Text>
              <Text style={styles.accountMeta}>
                {account.verificationState} · {account.actions.map((action) => action.label).join(' / ')}
              </Text>
            </View>
            <StatusBadge
              tone={account.verificationState === 'verified' ? 'success' : 'warning'}
              label={account.verificationState}
            />
          </View>
        ))}
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Preview" title="Funding impact">
        <View style={styles.lineStack}>
          {viewModel.previewLines.map((line) => (
            <View key={line.id} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{line.label}</Text>
              <Text style={[styles.lineValue, line.emphasis === 'warning' && styles.warningText]}>
                {line.value}
              </Text>
            </View>
          ))}
        </View>
        <DisclosureCallout disclosure={viewModel.pendingNotice} />
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Speed" title={viewModel.speed.selected}>
        <View style={styles.speedRow}>
          {viewModel.speed.options.map((option) => (
            <View key={option.id} style={[styles.speedCard, !option.enabled && styles.speedDisabled]}>
              <Text style={styles.speedTitle}>{option.label}</Text>
              <Text style={styles.speedMeta}>{option.etaLabel}</Text>
              <Text style={styles.speedMeta}>Fee {option.feeLabel}</Text>
            </View>
          ))}
        </View>
      </PaymentGlassCard>

      {viewModel.blockReason ? <DisclosureCallout disclosure={viewModel.blockReason} /> : null}

      <PaymentGlassCard eyebrow="Intents" title="Recent funding status">
        {viewModel.recentIntents.map((intent) => (
          <View key={intent.intentId} style={styles.intentBlock}>
            <View style={styles.intentHeader}>
              <Text style={styles.intentTitle}>{intent.amountLabel}</Text>
              <StatusBadge
                tone={intent.status === 'settled' ? 'success' : 'info'}
                label={intent.statusLabel}
              />
            </View>
            <TimelineStepper steps={intent.timeline} />
          </View>
        ))}
      </PaymentGlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: 18, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  headerText: { flex: 1, gap: 4 },
  title: { color: '#F5FBF8', fontSize: 30, fontWeight: '700' },
  subtitle: { color: 'rgba(245,251,248,0.68)', fontSize: 15, lineHeight: 21 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  accountCopy: { flex: 1, gap: 3 },
  accountTitle: { color: '#F5FBF8', fontSize: 15, fontWeight: '700' },
  accountMeta: { color: 'rgba(245,251,248,0.58)', fontSize: 12 },
  lineStack: { gap: 12 },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  lineLabel: { color: 'rgba(245,251,248,0.58)', fontSize: 13, fontWeight: '700' },
  lineValue: { color: '#F5FBF8', fontSize: 14, fontWeight: '700' },
  warningText: { color: '#FED7AA' },
  speedRow: { flexDirection: 'row', gap: 10 },
  speedCard: {
    flex: 1,
    gap: 4,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  speedDisabled: { opacity: 0.5 },
  speedTitle: { color: '#F5FBF8', fontSize: 14, fontWeight: '700' },
  speedMeta: { color: 'rgba(245,251,248,0.62)', fontSize: 12, lineHeight: 17 },
  intentBlock: { gap: 10, marginBottom: 14 },
  intentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intentTitle: { color: '#F5FBF8', fontSize: 16, fontWeight: '700' },
});
