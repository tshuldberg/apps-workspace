import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GARDEN_SURFACES } from './tokens';

const SURFACE_LEVELS = [
  GARDEN_SURFACES.depth,
  GARDEN_SURFACES.base,
  GARDEN_SURFACES.lift,
  GARDEN_SURFACES.focus,
  GARDEN_SURFACES.highest,
] as const;

interface GlassCardProps {
  children: ReactNode;
  level?: 0 | 1 | 2 | 3 | 4;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  ghostBorder?: boolean;
}

export function GlassCard({
  children,
  level = 2,
  style,
  onPress,
  ghostBorder = false,
}: GlassCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const bg = SURFACE_LEVELS[level];

  const cardStyle = [
    styles.card,
    { backgroundColor: bg },
    ghostBorder && styles.ghostBorder,
    style,
  ];

  if (onPress == null) {
    return <View style={cardStyle}>{children}</View>;
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
      <Animated.View style={[cardStyle, { transform: [{ scale }] }]}>
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
  ghostBorder: {
    borderWidth: 1,
    borderColor: 'rgba(159, 142, 129, 0.15)',
  },
});
