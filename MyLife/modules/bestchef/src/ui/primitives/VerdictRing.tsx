import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useThemeColors } from '@mylife/ui';
import { HERO_GRADIENT } from '../tokens';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export interface VerdictRingProps {
  /** Progress 0..1 used to draw the gradient stroke arc. */
  progress: number;
  /** Diameter of the ring in pixels. Default 72. */
  size?: number;
  /** Stroke width in pixels. Default 8. */
  strokeWidth?: number;
  /** Centered percentage label, already-translated when not numeric. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze VerdictRing: circular progress arc using the hero terracotta-to-
 * saffron gradient. Pass progress in 0..1 (clamped). Centered percentage
 * label defaults to floor(progress * 100) + '%' when label is omitted.
 */
export function VerdictRing({
  progress,
  size = 72,
  strokeWidth = 8,
  label,
  style,
}: VerdictRingProps) {
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * clamped;
  const center = size / 2;
  const text = label ?? `${Math.floor(clamped * 100)}%`;
  return (
    <View style={[{ width: size, height: size }, styles.wrap, style]}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="verdict-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={HERO_GRADIENT.from} />
            <Stop offset="1" stopColor={HERO_GRADIENT.to} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#verdict-ring-gradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <Text style={[styles.text, { color: colors.text, fontFamily }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    position: 'absolute',
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '700',
  },
});
