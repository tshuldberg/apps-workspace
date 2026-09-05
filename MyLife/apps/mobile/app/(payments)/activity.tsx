import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  PaymentGlassCard,
  StatusBadge,
  TransactionRow,
  buildPaymentsActivityFeedViewModel,
  type PaymentsActivityFilter,
} from '@mylife/payments';
import { colors } from '@mylife/ui';
import {
  PAYMENTS_ACTIVITY_DEMO_BASE,
} from './_activityDemo';

const BackIcon = icons.ChevronLeft;
const FilterIcon = icons.ListFilter;
const DetailIcon = icons.ReceiptText;

export default function PaymentsActivityScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<PaymentsActivityFilter>('all');
  const viewModel = useMemo(
    () => buildPaymentsActivityFeedViewModel({
      ...PAYMENTS_ACTIVITY_DEMO_BASE,
      filter,
    }),
    [filter],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to wallet"
          style={styles.iconButton}
          onPress={() => router.back()}
        >
          <BackIcon size={20} color="#F5FBF8" strokeWidth={2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{viewModel.title}</Text>
          <Text style={styles.subtitle}>
            Filtered server activity with one detail shell for transfers, requests, card, remittance, and payouts
          </Text>
        </View>
      </View>

      <View style={styles.filterHeader}>
        <FilterIcon size={17} color="#BAE6FD" strokeWidth={2} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {viewModel.filters.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item.id }}
              style={[styles.chip, filter === item.id && styles.chipActive]}
              onPress={() => setFilter(item.id)}
            >
              <Text style={[styles.chipText, filter === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
              <Text style={[styles.chipCount, filter === item.id && styles.chipTextActive]}>
                {item.count}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {viewModel.groups.length > 0 ? (
        viewModel.groups.map((group) => (
          <PaymentGlassCard key={group.id} eyebrow="Feed" title={group.title}>
            <View style={styles.rowStack}>
              {group.rows.map((row) => (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${row.item.title}`}
                  style={styles.activityPressable}
                  onPress={() => router.push(`/(payments)/${row.id}` as never)}
                >
                  <View style={styles.rowMeta}>
                    <View style={styles.kindPill}>
                      <DetailIcon size={13} color="#BAE6FD" strokeWidth={2} />
                      <Text style={styles.kindPillText}>{row.kindLabel}</Text>
                    </View>
                    <StatusBadge status={row.item.status} label={row.statusLabel} />
                  </View>
                  <TransactionRow item={row.item} />
                  <Text style={styles.rowFootnote}>
                    {row.railLabel} activity opens in the shared transaction shell
                  </Text>
                </Pressable>
              ))}
            </View>
          </PaymentGlassCard>
        ))
      ) : (
        <PaymentGlassCard eyebrow="Feed" title={viewModel.emptyState.title}>
          <Text style={styles.emptyBody}>{viewModel.emptyState.body}</Text>
        </PaymentGlassCard>
      )}
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
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(245,251,248,0.68)',
    fontSize: 15,
    lineHeight: 21,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterRow: {
    gap: 8,
    paddingRight: 20,
  },
  chip: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(186,230,253,0.20)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipActive: {
    backgroundColor: '#BAE6FD',
    borderColor: '#BAE6FD',
  },
  chipText: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '700',
  },
  chipCount: {
    color: 'rgba(245,251,248,0.64)',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#061511',
  },
  rowStack: {
    gap: 12,
  },
  activityPressable: {
    gap: 8,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  kindPill: {
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
  kindPillText: {
    color: '#BAE6FD',
    fontSize: 12,
    fontWeight: '700',
  },
  rowFootnote: {
    color: 'rgba(245,251,248,0.54)',
    fontSize: 12,
    lineHeight: 17,
  },
  emptyBody: {
    color: 'rgba(245,251,248,0.68)',
    fontSize: 14,
    lineHeight: 20,
  },
});
