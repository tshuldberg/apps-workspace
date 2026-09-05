import { StyleSheet, Text, View } from 'react-native';
import type { BudgetSubscription } from '../../types';
import { normalizeToMonthly } from '../../subscriptions/cost';
import {
  BG_ACCENT,
  BG_DANGER,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
} from '../tokens';
import { BG_FONTS } from '../typography';
import { AmountDisplay } from './AmountDisplay';
import { CategoryChip } from './CategoryChip';
import { GlassCard } from './GlassCard';

function getStatusTone(status: BudgetSubscription['status']): string {
  switch (status) {
    case 'active':
      return BG_MONEY;
    case 'trial':
      return BG_ACCENT;
    case 'paused':
      return BG_TEXT_SECONDARY;
    default:
      return BG_DANGER;
  }
}

export interface SubscriptionRowProps {
  subscription: BudgetSubscription;
  onPress?: () => void;
  categoryLabel?: string;
}

export function SubscriptionRow({
  subscription,
  onPress,
  categoryLabel,
}: SubscriptionRowProps) {
  const monthly = normalizeToMonthly(
    subscription.price,
    subscription.billing_cycle,
    subscription.custom_days,
  );
  const tone = getStatusTone(subscription.status);

  return (
    <GlassCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.leadingCircle}>
          <Text style={styles.leadingIcon}>{subscription.icon ?? '💳'}</Text>
        </View>

        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {subscription.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Renews {subscription.next_renewal}</Text>
            {categoryLabel ? (
              <CategoryChip category={{ name: categoryLabel, color: subscription.color }} size="sm" />
            ) : null}
          </View>
        </View>

        <View style={styles.trailing}>
          <AmountDisplay
            cents={monthly}
            currencyCode={subscription.currency}
            size="md"
            type="expense"
          />
          <View style={[styles.statusPill, { backgroundColor: `${tone}22` }]}>
            <Text style={[styles.statusText, { color: tone }]}>
              {subscription.status}
            </Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BG_SURFACES.low,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leadingCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingIcon: {
    fontSize: 18,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'capitalize',
  },
});
