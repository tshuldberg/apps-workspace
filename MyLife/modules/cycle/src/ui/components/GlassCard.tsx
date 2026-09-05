import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { CYCLE_SURFACES } from '../tokens';

export type GlassCardVariant = 'low' | 'high';

interface GlassCardProps {
  children: ReactNode;
  variant?: GlassCardVariant;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

/**
 * Obsidian Noir glass card wrapper used across all MyCycle screens.
 * Uses surface color shifts (no 1px borders) and optional press scale.
 */
export function GlassCard({ children, variant = 'low', style, onPress }: GlassCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const backgroundColor =
    variant === 'high' ? CYCLE_SURFACES.high : CYCLE_SURFACES.low;

  if (onPress == null) {
    return (
      <View style={[styles.card, { backgroundColor }, style]}>{children}</View>
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
          { backgroundColor, transform: [{ scale }] },
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
});
