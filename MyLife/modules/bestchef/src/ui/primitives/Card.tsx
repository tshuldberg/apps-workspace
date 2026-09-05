import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@mylife/ui';
import { RECIPES_SURFACES } from '../tokens';

// Theme tokens don't expose shadowColor; raw black is intentional.
const SHADOW_COLOR = '#000000';

export type CardVariant = 'default' | 'subtle' | 'glass';

export interface CardProps {
  children?: ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze BCCard equivalent. Radius 20, padding 16, soft shadow.
 *
 * Variants:
 *  - default: lift surface, used for primary content cards
 *  - subtle: depth surface, used for less prominent cards
 *  - glass: glass.cardFill from active theme profile + glass.cardBorder line
 */
export function Card({ children, variant = 'default', style }: CardProps) {
  const theme = useTheme();
  const surface = resolveSurface(variant, theme.glass.cardFill);
  const borderColor = variant === 'glass' ? theme.glass.cardBorder : 'transparent';
  const borderWidth = variant === 'glass' ? StyleSheet.hairlineWidth : 0;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: surface, borderColor, borderWidth },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function resolveSurface(variant: CardVariant, glassFill: string): string {
  if (variant === 'glass') return glassFill;
  if (variant === 'subtle') return RECIPES_SURFACES.depth;
  return RECIPES_SURFACES.lift;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
});
