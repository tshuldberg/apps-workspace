import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemeColors } from '@mylife/ui';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';
import { HERO_GRADIENT } from '../tokens';

export interface StatPillProps {
  /** Tinted icon node placed top-left in the tinted square. */
  icon?: ReactNode;
  /** Tint color for the icon background square. Defaults to hero terracotta. */
  tint?: string;
  /** Big numeric or short text value (e.g. "1,243"). */
  value: string;
  /** Tiny caption shown below value (already-translated; pass t(...)). */
  caption: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze StatPill: tinted icon top-left, big number, tiny caption. Used
 * across Home stats strip and chef profile stats row. Column layout, fills
 * available width.
 */
export function StatPill({ icon, tint, value, caption, style }: StatPillProps) {
  const theme = useTheme();
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  const tintColor = tint ?? HERO_GRADIENT.from;
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
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 6,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcTitle.fontSize,
    fontWeight: RECIPES_TYPOGRAPHY_ROUNDED.bcTitle.fontWeight,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcTitle.letterSpacing,
  },
  caption: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.fontSize,
    fontWeight: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.fontWeight,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.letterSpacing,
  },
});
