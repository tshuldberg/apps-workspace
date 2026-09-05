import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemeColors } from '@mylife/ui';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export interface HintBubbleProps {
  /** Already-translated tip text. */
  text: string;
  /** Optional icon rendered to the left, typically a hand or info glyph. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze HintBubble from VoteView: capsule with a hand icon and short tip
 * text. Used to nudge users toward gestures or actions ("Swipe up to review").
 */
export function HintBubble({ text, icon, style }: HintBubbleProps) {
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
      {icon != null && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, { color: colors.text, fontFamily }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '600',
  },
});
