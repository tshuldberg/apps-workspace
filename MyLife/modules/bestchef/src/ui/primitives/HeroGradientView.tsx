import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HERO_GRADIENT, HERO_GRADIENT_DARK, type GradientToken } from '../tokens';

interface HeroGradientViewProps {
  /**
   * When true, uses the deeper dark variant of the hero gradient. Useful when
   * the gradient sits on a near-black canvas.
   */
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

function angleToVector(angle: number): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  const radians = (angle * Math.PI) / 180;
  const x = Math.cos(radians);
  const y = Math.sin(radians);
  return {
    start: { x: 0.5 - x / 2, y: 0.5 - y / 2 },
    end: { x: 0.5 + x / 2, y: 0.5 + y / 2 },
  };
}

/**
 * Renders the are-blaze BestChef hero gradient (terracotta to saffron).
 * Pass dark to swap to the deeper terracotta variant for very dark canvases.
 */
export function HeroGradientView({ dark, style, children }: HeroGradientViewProps) {
  const token: GradientToken = dark ? HERO_GRADIENT_DARK : HERO_GRADIENT;
  const { start, end } = angleToVector(token.angle);
  return (
    <LinearGradient
      colors={[token.from, token.to]}
      start={start}
      end={end}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
