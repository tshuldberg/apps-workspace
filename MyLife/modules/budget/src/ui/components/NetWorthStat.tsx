import { StyleSheet, Text, View } from 'react-native';
import { BG_TEXT_SECONDARY, BG_TX_TYPES } from '../tokens';
import { BG_FONTS } from '../typography';
import { AmountDisplay } from './AmountDisplay';
import { MaterialSymbol } from './MaterialSymbol';

function formatPercent(value: number): string {
  return `${Math.abs(value * 100).toFixed(1)}%`;
}

export interface NetWorthStatProps {
  value: number;
  delta: number;
  period: string;
}

export function NetWorthStat({
  value,
  delta,
  period,
}: NetWorthStatProps) {
  const baseline = value - delta;
  const percent = baseline === 0 ? 0 : delta / baseline;
  const positive = delta >= 0;
  const tone = positive ? BG_TX_TYPES.income : BG_TX_TYPES.expense;

  return (
    <View style={styles.container}>
      <AmountDisplay cents={value} size="xl" type="neutral" />
      <View style={styles.deltaRow}>
        <MaterialSymbol
          name={positive ? 'arrow_upward' : 'arrow_downward'}
          size={16}
          color={tone}
        />
        <Text style={[styles.deltaText, { color: tone }]}>
          {positive ? '+' : '-'}
          <AmountDisplay cents={delta} size="sm" type={positive ? 'income' : 'expense'} />
          {' • '}
          {formatPercent(percent)}
        </Text>
      </View>
      <Text style={styles.periodText}>{period}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deltaText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  periodText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
});
