import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemeColors } from '@mylife/ui';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';
import { HERO_GRADIENT } from '../tokens';

export interface InfoCardProps {
  /** Lightbulb / info / hint icon node. */
  icon?: ReactNode;
  /** Already-translated card title. */
  title: string;
  /** Already-translated body copy. */
  message: string;
  /** Tint for the icon backdrop. Default hero terracotta. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze InfoCard from SubmitSteps: tinted icon (typically a lightbulb)
 * with a short title and longer message body. Used as inline tips through
 * the submission wizard, kitchen flows, and detail view.
 */
export function InfoCard({ icon, title, message, tint, style }: InfoCardProps) {
  const theme = useTheme();
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  const tintColor = tint ?? HERO_GRADIENT.to;
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
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text, fontFamily }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.textSecondary, fontFamily }]}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.fontSize,
    fontWeight: '700',
  },
  message: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcBody.fontSize,
    fontWeight: '400',
    lineHeight: 22,
  },
});
