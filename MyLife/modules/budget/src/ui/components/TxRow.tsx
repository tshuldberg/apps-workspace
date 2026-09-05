import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BudgetTransaction } from '../../types';
import {
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TX_TYPES,
} from '../tokens';
import { BG_FONTS } from '../typography';
import { AmountDisplay } from './AmountDisplay';
import type { BudgetCategoryLike } from './CategoryChip';
import { CategoryChip } from './CategoryChip';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

function directionToDisplayType(direction: BudgetTransaction['direction']) {
  if (direction === 'inflow') return 'income' as const;
  if (direction === 'transfer') return 'transfer' as const;
  return 'expense' as const;
}

function directionIcon(direction: BudgetTransaction['direction']): string {
  if (direction === 'inflow') return 'arrow_upward';
  if (direction === 'transfer') return 'currency_exchange';
  return 'arrow_downward';
}

export interface TxRowProps {
  tx: BudgetTransaction;
  showDate?: boolean;
  onPress?: () => void;
  category?: BudgetCategoryLike;
  merchantLogo?: ReactNode;
  hasSplit?: boolean;
}

export function TxRow({
  tx,
  showDate = true,
  onPress,
  category,
  merchantLogo,
  hasSplit = false,
}: TxRowProps) {
  const displayType = directionToDisplayType(tx.direction);

  return (
    <GlassCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.leadingCircle}>
            {merchantLogo ?? (
              <MaterialSymbol
                name={directionIcon(tx.direction)}
                size={18}
                color={
                  displayType === 'income'
                    ? BG_TX_TYPES.income
                    : displayType === 'transfer'
                      ? BG_TX_TYPES.transfer
                      : BG_TX_TYPES.expense
                }
              />
            )}
          </View>

          <View style={styles.copy}>
            <View style={styles.titleLine}>
              <Text numberOfLines={1} style={styles.title}>
                {tx.merchant?.trim() || 'Transaction'}
              </Text>
              {hasSplit ? (
                <MaterialSymbol name="currency_exchange" size={14} color={BG_TEXT_TERTIARY} />
              ) : null}
            </View>

            <View style={styles.metaLine}>
              {category ? <CategoryChip category={category} size="sm" /> : null}
              {showDate ? <Text style={styles.metaText}>{tx.occurred_on}</Text> : null}
            </View>
          </View>
        </View>

        <AmountDisplay
          cents={tx.amount}
          size="md"
          type={displayType}
          showSign
          style={styles.amount}
        />
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
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  leadingCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
    flex: 1,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_SECONDARY,
  },
  amount: {
    textAlign: 'right',
    flexShrink: 0,
  },
});
