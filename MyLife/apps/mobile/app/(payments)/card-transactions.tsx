import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  PaymentGlassCard,
  StatusBadge,
  buildPaymentsCardActivityRows,
} from '@mylife/payments';
import { colors } from '@mylife/ui';
import { DEMO_CARD_TRANSACTIONS } from './_cardsDemo';

const BackIcon = icons.ChevronLeft;

export default function PaymentsCardTransactionsScreen() {
  const router = useRouter();
  const rows = useMemo(
    () => buildPaymentsCardActivityRows({ transactions: DEMO_CARD_TRANSACTIONS }),
    [],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <BackIcon size={20} color="#F5FBF8" strokeWidth={2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Card feed</Text>
          <Text style={styles.subtitle}>Pending authorizations, posted settlements, and dispute links</Text>
        </View>
      </View>

      <PaymentGlassCard eyebrow="Activity" title="Card purchases">
        {rows.map((row) => (
          <Pressable
            key={row.id}
            style={styles.row}
            onPress={() => router.push(row.myPayDetailLink as never)}
          >
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{row.merchantName}</Text>
              <Text style={styles.rowMeta}>{row.budgetCategory}</Text>
              <Text style={styles.rowMeta}>{row.settlementLabel}</Text>
            </View>
            <View style={styles.rowEnd}>
              <Text style={styles.amount}>{row.amountLabel}</Text>
              <StatusBadge
                tone={row.disputeEntryEnabled ? 'success' : 'info'}
                label={row.disputeEntryEnabled ? 'Issue eligible' : 'Pending'}
              />
            </View>
          </Pressable>
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
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowCopy: { flex: 1, gap: 3 },
  rowEnd: { alignItems: 'flex-end', gap: 6 },
  rowTitle: { color: '#F5FBF8', fontSize: 15, fontWeight: '800' },
  rowMeta: { color: 'rgba(245,251,248,0.58)', fontSize: 12 },
  amount: { color: '#F5FBF8', fontSize: 14, fontWeight: '800' },
});
