import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GOLD_GRADIENT } from '../tokens';

interface GoldGradientViewProps {
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
 * Renders the are-blaze champion gold gradient. Used for podium / 1st-place
 * surfaces, hero crowns, and ranking medals.
 */
export function GoldGradientView({ style, children }: GoldGradientViewProps) {
  const { start, end } = angleToVector(GOLD_GRADIENT.angle);
  return (
    <LinearGradient
      colors={[GOLD_GRADIENT.from, GOLD_GRADIENT.to]}
      start={start}
      end={end}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
