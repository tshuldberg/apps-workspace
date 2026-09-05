import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors } from '../tokens/colors';

interface Props {
  current: number;
  target: number;
  size?: number;
  label?: string;
  style?: ViewStyle;
}

/**
 * Circular progress ring built with React Native Views.
 * Uses a rotated half-circle clipping technique for cross-platform compatibility
 * (no SVG dependency). Renders a track circle and a filled arc on top.
 */
export function ReadingGoalRing({
  current,
  target,
  size = 120,
  label,
  style,
}: Props) {
  const strokeWidth = Math.round(size * 0.08);
  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  const degrees = progress * 360;

  const outerRadius = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Track circle (background) */}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: outerRadius,
            borderWidth: strokeWidth,
            borderColor: colors.surfaceElevated,
          },
        ]}
      />

      {/* Progress: right half (0-180 degrees) */}
      <View style={[styles.halfContainer, { width: size / 2, height: size, left: size / 2, overflow: 'hidden' }]}>
        <View
          style={[
            styles.halfCircle,
            {
              width: size,
              height: size,
              borderRadius: outerRadius,
              borderWidth: strokeWidth,
              borderColor: colors.accent,
              left: -(size / 2),
              transform: [{ rotate: `${Math.min(degrees, 180)}deg` }],
            },
          ]}
        />
      </View>

      {/* Progress: left half (180-360 degrees) */}
      {degrees > 180 && (
        <View style={[styles.halfContainer, { width: size / 2, height: size, left: 0, overflow: 'hidden' }]}>
          <View
            style={[
              styles.halfCircle,
              {
                width: size,
                height: size,
                borderRadius: outerRadius,
                borderWidth: strokeWidth,
                borderColor: colors.accent,
                left: size / 2,
                transform: [{ rotate: `${degrees - 180}deg` }],
              },
            ]}
          />
        </View>
      )}

      {/* Center label */}
      <View style={styles.labelContainer}>
        <Text variant="stat" color={colors.text} style={{ fontSize: Math.round(size * 0.22) }}>
          {current}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {label ?? `of ${target}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
  },
  halfContainer: {
    position: 'absolute',
    top: 0,
  },
  halfCircle: {
    position: 'absolute',
    top: 0,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
