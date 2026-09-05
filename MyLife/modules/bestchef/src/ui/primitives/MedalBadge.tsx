import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MEDAL_BRONZE, MEDAL_GOLD, MEDAL_SILVER } from '../tokens';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export type MedalBadgeRank = 'gold' | 'silver' | 'bronze';

export interface MedalBadgeProps {
  /** Medal rank tier. Tints the circle backdrop. */
  rank: MedalBadgeRank;
  /**
   * Icon node. Consumers typically pass a lucide-react-native Crown or
   * Medal icon. If omitted, a simple text glyph is rendered.
   */
  icon?: ReactNode;
  /** Diameter of the circle in pixels. Default 28. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const TINT: Record<MedalBadgeRank, string> = {
  gold: MEDAL_GOLD,
  silver: MEDAL_SILVER,
  bronze: MEDAL_BRONZE,
};

/**
 * Small medal circle used on podium cards and chef badges. Backdrop is the
 * medal tint; icon sits centered. Falls back to a simple glyph if no icon
 * node is provided.
 */
export function MedalBadge({ rank, icon, size = 28, style }: MedalBadgeProps) {
  const fontFamily = getRoundedFontFamily();
  const fill = TINT[rank];
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: fill },
        style,
      ]}
    >
      {icon != null ? (
        icon
      ) : (
        <Text style={[styles.glyph, { color: '#3A1B00', fontFamily }]}>★</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '800',
  },
});
