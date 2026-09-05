import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  DisclosureCallout,
  PaymentGlassCard,
  StatusBadge,
  buildPaymentsCardActivityRows,
  buildPaymentsCardManagementViewModel,
} from '@mylife/payments';
import { colors } from '@mylife/ui';
import { DEMO_CARD, DEMO_CARD_TRANSACTIONS } from './_cardsDemo';

const CardIcon = icons.CreditCard;
const ListIcon = icons.List;
const ScanIcon = icons.ScanLine;

export default function PaymentsCardsScreen() {
  const router = useRouter();
  const cardState = useMemo(
    () => buildPaymentsCardManagementViewModel({ card: DEMO_CARD }),
    [],
  );
  const rows = useMemo(
    () => buildPaymentsCardActivityRows({ transactions: DEMO_CARD_TRANSACTIONS }),
    [],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cards</Text>
      <Text style={styles.subtitle}>Token-first card management and merchant activity</Text>

      <PaymentGlassCard eyebrow="Card" title={cardState.maskedDisplay}>
        <View style={styles.cardVisual}>
          <CardIcon size={24} color="#BAE6FD" strokeWidth={2} />
          <View style={styles.cardCopy}>
            <Text style={styles.cardName}>{cardState.card?.holderName}</Text>
            <Text style={styles.cardMeta}>{cardState.maskedDisplay}</Text>
          </View>
          <StatusBadge tone="success" label={cardState.card?.status ?? 'none'} />
        </View>
        <View style={styles.actionGrid}>
          {cardState.actions.map((action) => (
            <View key={action.id} style={[styles.actionPill, !action.enabled && styles.disabled]}>
              <Text style={styles.actionText}>{action.label}</Text>
            </View>
          ))}
        </View>
        <DisclosureCallout disclosure={cardState.disclosure} />
      </PaymentGlassCard>

      <View style={styles.routeGrid}>
        <Pressable style={styles.routeButton} onPress={() => router.push('/(payments)/card-transactions' as never)}>
          <ListIcon size={18} color="#061511" strokeWidth={2} />
          <Text style={styles.routeText}>Card feed</Text>
        </Pressable>
        <Pressable style={styles.routeButton} onPress={() => router.push('/(payments)/scan' as never)}>
          <ScanIcon size={18} color="#061511" strokeWidth={2} />
          <Text style={styles.routeText}>QR pay</Text>
        </Pressable>
      </View>

      <PaymentGlassCard eyebrow="Recent card activity" title="MCC to Budget mapping">
        {rows.map((row) => (
          <View key={row.id} style={styles.txnRow}>
            <View style={styles.cardCopy}>
              <Text style={styles.cardName}>{row.merchantName}</Text>
              <Text style={styles.cardMeta}>{row.budgetCategory} · {row.settlementLabel}</Text>
            </View>
            <Text style={styles.amount}>{row.amountLabel}</Text>
          </View>
        ))}
      </PaymentGlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: 18, padding: 20 },
  title: { color: '#F5FBF8', fontSize: 30, fontWeight: '700' },
  subtitle: { color: 'rgba(245,251,248,0.68)', fontSize: 15, lineHeight: 21 },
  cardVisual: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardCopy: { flex: 1, gap: 3 },
  cardName: { color: '#F5FBF8', fontSize: 15, fontWeight: '700' },
  cardMeta: { color: 'rgba(245,251,248,0.60)', fontSize: 12, lineHeight: 17 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(186,230,253,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(186,230,253,0.22)',
  },
  disabled: { opacity: 0.45 },
  actionText: { color: '#BAE6FD', fontSize: 12, fontWeight: '800' },
  routeGrid: { flexDirection: 'row', gap: 10 },
  routeButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  routeText: { color: '#061511', fontSize: 14, fontWeight: '800' },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  amount: { color: '#F5FBF8', fontSize: 14, fontWeight: '800' },
});
