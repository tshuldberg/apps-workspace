import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import {
  BG_TEXT,
  BG_TYPOGRAPHY,
  BG_TX_TYPES,
  type BudgetTransactionTone,
} from '../tokens';

type AmountDisplaySize = 'sm' | 'md' | 'lg' | 'xl';
type AmountDisplayType = BudgetTransactionTone | 'neutral';

const SIZE_STYLES: Record<AmountDisplaySize, TextStyle> = {
  sm: {
    fontFamily: BG_TYPOGRAPHY.amountDisplay.fontFamily,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.42,
    fontVariant: [...BG_TYPOGRAPHY.amountDisplay.fontVariant],
  },
  md: {
    fontFamily: BG_TYPOGRAPHY.amountDisplay.fontFamily,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.6,
    fontVariant: [...BG_TYPOGRAPHY.amountDisplay.fontVariant],
  },
  lg: {
    fontFamily: BG_TYPOGRAPHY.amountDisplay.fontFamily,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.84,
    fontVariant: [...BG_TYPOGRAPHY.amountDisplay.fontVariant],
  },
  xl: {
    fontFamily: BG_TYPOGRAPHY.amountDisplay.fontFamily,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.44,
    fontVariant: [...BG_TYPOGRAPHY.amountDisplay.fontVariant],
  },
};

function formatCurrencyValue(cents: number, currencyCode: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(cents) / 100);
}

function getPrefix(
  cents: number,
  type: AmountDisplayType,
  showSign: boolean,
): string {
  if (!showSign || cents === 0) {
    return '';
  }
  if (cents < 0 || type === 'expense') {
    return '-';
  }
  if (cents > 0 || type === 'income') {
    return '+';
  }
  return '';
}

function getColor(type: AmountDisplayType): string {
  if (type === 'neutral') {
    return BG_TEXT;
  }
  return BG_TX_TYPES[type];
}

export interface AmountDisplayProps {
  cents: number;
  currencyCode?: string;
  size?: AmountDisplaySize;
  type?: AmountDisplayType;
  showSign?: boolean;
  style?: StyleProp<TextStyle>;
}

export function AmountDisplay({
  cents,
  currencyCode = 'USD',
  size = 'md',
  type = 'neutral',
  showSign = false,
  style,
}: AmountDisplayProps) {
  return (
    <Text style={[styles.base, SIZE_STYLES[size], { color: getColor(type) }, style]}>
      {getPrefix(cents, type, showSign)}
      {formatCurrencyValue(cents, currencyCode)}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontWeight: '800',
  },
});
