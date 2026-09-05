'use client';

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

interface LoadingStateProps {
  rows?: number;
}

function SkeletonRow({ width }: { width: string }) {
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // useNativeDriver: false is required here. With the native driver, the
    // useEffect cleanup races with RCTNativeAnimatedNodesManager and triggers
    // a fatal `'childNode' is a required parameter` Foundation assertion when
    // any consumer of LoadingState unmounts (every loading skeleton in the app).
    // Skeleton opacity does not need 60fps native interpolation.
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: false }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      opacity.stopAnimation();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.row,
        { width: width as unknown as number, opacity },
      ]}
    />
  );
}

export function LoadingState({ rows = 3 }: LoadingStateProps) {
  const widths = ['90%', '75%', '60%', '85%', '70%'];
  return (
    <View style={styles.container}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} width={widths[i % widths.length]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  row: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
});