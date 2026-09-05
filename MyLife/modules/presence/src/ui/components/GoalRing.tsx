import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  PR_ACCENT_LIGHT,
  PR_ACCENT_GLOW,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
} from '../tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface GoalRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  value?: string;
  children?: ReactNode;
}

export function GoalRing({
  progress,
  size = 240,
  strokeWidth = 12,
  label,
  value,
  children,
}: GoalRingProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const animatedProgress = useRef(new Animated.Value(clampedProgress)).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: clampedProgress,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, clampedProgress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={PR_SURFACES.highest}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={PR_ACCENT_GLOW}
          strokeWidth={strokeWidth + 2}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          opacity={0.45}
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={PR_ACCENT_LIGHT}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      <View style={styles.content}>
        {children ?? (
          <>
            {label != null && <Text style={styles.label}>{label}</Text>}
            {value != null && <Text style={styles.value}>{value}</Text>}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  content: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_SECONDARY,
  },
  value: {
    ...PR_TYPOGRAPHY.displayLg,
    color: PR_TEXT,
  },
});
