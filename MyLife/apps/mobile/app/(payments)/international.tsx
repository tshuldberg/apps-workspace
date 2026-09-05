import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  DisclosureCallout,
  PaymentGlassCard,
  StatusBadge,
  buildPaymentsInternationalQuoteViewModel,
} from '@mylife/payments';
import { colors } from '@mylife/ui';
import { REMITTANCE_QUOTE, REMITTANCE_RECIPIENT } from './_remittanceDemo';

const BackIcon = icons.ChevronLeft;

export default function PaymentsInternationalScreen() {
  const router = useRouter();
  const quote = useMemo(
    () => buildPaymentsInternationalQuoteViewModel({
      quote: REMITTANCE_QUOTE,
      recipient: REMITTANCE_RECIPIENT,
    }),
    [],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <BackIcon size={20} color="#F5FBF8" strokeWidth={2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>International</Text>
          <Text style={styles.subtitle}>Corridor quote with explicit fee, FX, ETA, and recipient amount</Text>
        </View>
      </View>

      <PaymentGlassCard eyebrow="Corridor" title={quote.corridor}>
        <View style={styles.badgeRow}>
          <StatusBadge tone="success" label={quote.state} />
          <StatusBadge tone="info" label={quote.recipientMethodLabel} />
        </View>
        <View style={styles.lineStack}>
          <Line label="You send" value={quote.senderAmountLabel} />
          <Line label="Fee" value={quote.feeLabel} />
          <Line label="Rate" value={quote.exchangeRate} />
          <Line label="Recipient gets" value={quote.recipientAmountLabel} />
          <Line label="ETA" value={quote.etaLabel} />
        </View>
      </PaymentGlassCard>

      <DisclosureCallout disclosure={quote.disclosure} />

      <Pressable style={styles.trackButton} onPress={() => router.push('/(payments)/remittance/remit_sam_0424' as never)}>
        <Text style={styles.trackButtonText}>Open tracking</Text>
      </Pressable>
    </ScrollView>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
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
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
  lineValue: { color: '#F5FBF8', fontSize: 14, fontWeight: '800', textAlign: 'right' },
  trackButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackButtonText: { color: '#061511', fontSize: 15, fontWeight: '800' },
});
