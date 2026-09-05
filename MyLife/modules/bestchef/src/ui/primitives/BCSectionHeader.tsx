import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeColors } from '@mylife/ui';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { HERO_GRADIENT } from '../tokens';
import { getRoundedFontFamily } from './rounded-platform';

export interface BCSectionHeaderAction {
  text: string;
  onPress: () => void;
}

export interface BCSectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: BCSectionHeaderAction;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze SectionHeader. Title uses bcHeadline, subtitle uses bcTiny in
 * uppercase, action right-aligned with hero terracotta tint. Co-exists with
 * the original FilterChip-era SectionHeader (./SectionHeader.tsx). Adopt
 * BCSectionHeader from P3+ screens; legacy callers stay on the original.
 */
export function BCSectionHeader({ title, subtitle, action, style }: BCSectionHeaderProps) {
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.text, fontFamily }]}>{title}</Text>
        {subtitle != null && (
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily }]}>
            {subtitle.toUpperCase()}
          </Text>
        )}
      </View>
      {action != null && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={[styles.action, { color: HERO_GRADIENT.from, fontFamily }]}>
            {action.text}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  left: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.fontSize,
    fontWeight: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.fontWeight,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.letterSpacing,
  },
  subtitle: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.fontSize,
    fontWeight: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.fontWeight,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.letterSpacing,
  },
  action: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '700',
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.letterSpacing,
  },
});
