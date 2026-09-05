'use client';

import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MOOD_SURFACES } from './tokens';

const SURFACE_LEVELS = [
  MOOD_SURFACES.depth,
  MOOD_SURFACES.base,
  MOOD_SURFACES.lift,
  MOOD_SURFACES.focus,
  MOOD_SURFACES.highest,
] as const;

const GHOST_BORDER = 'rgba(82, 68, 58, 0.15)';

interface GlassCardProps {
  children: ReactNode;
  level?: 0 | 1 | 2 | 3 | 4;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function GlassCard({ children, level = 2, style, onPress }: GlassCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const bg = SURFACE_LEVELS[level];

  if (onPress == null) {
    return (
      <View style={[styles.card, { backgroundColor: bg }, style]}>
        {children}
      </View>
    );
  }

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 1.02,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[
          styles.card,
          styles.pressable,
          { backgroundColor: bg, transform: [{ scale }] },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
  },
  pressable: {
    borderWidth: 1,
    borderColor: GHOST_BORDER,
  },
});
