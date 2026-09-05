import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemeColors } from '@mylife/ui';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export interface HeaderStatProps {
  icon?: ReactNode;
  /** Numeric or short value, e.g. "12" or "3.1k". */
  value: string;
  /** Caption shown to the right of the value, e.g. "votes". */
  label: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact horizontal pill: icon + value + label. Used on the Vote tab session
 * bar to surface live up/down/reviewed counts above the swipe deck.
 */
export function HeaderStat({ icon, value, label, style }: HeaderStatProps) {
  const theme = useTheme();
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
        style,
      ]}
    >
      {icon != null && <View style={styles.iconWrap}>{icon}</View>}
      <Text style={[styles.value, { color: colors.text, fontFamily }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '700',
  },
  label: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '500',
  },
});
