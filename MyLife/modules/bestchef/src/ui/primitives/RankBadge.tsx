import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { GoldGradientView } from './GoldGradientView';
import { MEDAL_BRONZE, MEDAL_SILVER } from '../tokens';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export type RankBadgeVariant = 'gold' | 'silver' | 'bronze' | 'default';

export interface RankBadgeProps {
  /** Numeric rank, e.g. 1, 4, 27. Renders as #N. */
  rank: number;
  variant?: RankBadgeVariant;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze RankBadge: small #N capsule. Gold variant uses GOLD_GRADIENT for
 * top-1 surfaces; silver and bronze use solid medal colors; default uses a
 * white-on-glass capsule for ranks 4-100.
 */
export function RankBadge({ rank, variant = 'default', style }: RankBadgeProps) {
  const fontFamily = getRoundedFontFamily();
  const text = `#${rank}`;
  if (variant === 'gold') {
    return (
      <GoldGradientView style={[styles.capsule, style]}>
        <Text style={[styles.text, { color: '#3A1B00', fontFamily }]}>{text}</Text>
      </GoldGradientView>
    );
  }
  const fill = resolveFill(variant);
  const tone = variant === 'default' ? '#3A1B00' : '#FFFFFF';
  return (
    <View style={[styles.capsule, { backgroundColor: fill }, style]}>
      <Text style={[styles.text, { color: tone, fontFamily }]}>{text}</Text>
    </View>
  );
}

function resolveFill(variant: RankBadgeVariant): string {
  if (variant === 'silver') return MEDAL_SILVER;
  if (variant === 'bronze') return MEDAL_BRONZE;
  return 'rgba(255,255,255,0.95)';
}

const styles = StyleSheet.create({
  capsule: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
