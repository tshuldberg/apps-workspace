import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemeColors } from '@mylife/ui';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export interface StatBoxProps {
  icon?: ReactNode;
  tint?: string;
  value: string;
  caption: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Smaller sibling of StatPill. Used on Recipe Detail headline strip where
 * three stat boxes sit in a tight row. Padding 12, value bcHeadline (not
 * bcTitle), caption bcTiny.
 */
export function StatBox({ icon, tint, value, caption, style }: StatBoxProps) {
  const theme = useTheme();
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  const tintColor = tint ?? '#F26A3A';
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
        style,
      ]}
    >
      {icon != null && (
        <View style={[styles.iconWrap, { backgroundColor: tintColor + '22' }]}>
          {icon}
        </View>
      )}
      <Text style={[styles.value, { color: colors.text, fontFamily }]}>{value}</Text>
      <Text style={[styles.caption, { color: colors.textSecondary, fontFamily }]}>
        {caption.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.fontSize,
    fontWeight: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.fontWeight,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.letterSpacing,
  },
  caption: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.fontSize,
    fontWeight: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.fontWeight,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.letterSpacing,
  },
});
