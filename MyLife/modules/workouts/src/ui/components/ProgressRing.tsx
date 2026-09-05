import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { WK_ACCENT, WK_SURFACES } from '../tokens';
import { WK_FONTS } from '../typography';

export interface ProgressRingProps {
  progress: number;
  size: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  centerLabel?: string;
  centerValue?: string;
  children?: ReactNode;
}

export function ProgressRing({
  progress,
  size,
  strokeWidth = 4,
  color = WK_ACCENT,
  backgroundColor = WK_SURFACES.highest,
  centerLabel,
  centerValue,
  children,
}: ProgressRingProps) {
  const clampedProgress = Math.max(0, Math.min(progress, 1));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const dashOffset = circumference - circumference * clampedProgress;

  return (
    <View style={[styles.host, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90, ${center}, ${center})`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </G>
      </Svg>

      <View style={styles.center}>
        {children ?? (
          <>
            {centerValue ? <Text style={[styles.value, { color }]}>{centerValue}</Text> : null}
            {centerLabel ? <Text style={styles.label}>{centerLabel}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  value: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: -0.5,
  },
  label: {
    fontFamily: WK_FONTS.medium,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(214, 195, 181, 0.72)',
  },
});
