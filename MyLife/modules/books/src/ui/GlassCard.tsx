import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { BOOKS_SURFACES, BOOKS_GHOST_BORDER } from './tokens';

const LEVEL_MAP = [
  BOOKS_SURFACES.depth,
  BOOKS_SURFACES.base,
  BOOKS_SURFACES.lift,
  BOOKS_SURFACES.focus,
  BOOKS_SURFACES.highest,
] as const;

export interface GlassCardProps {
  children: React.ReactNode;
  level?: 0 | 1 | 2 | 3 | 4;
  style?: ViewStyle;
  onPress?: () => void;
}

// Layout-related style keys must live on the outer Pressable so percentage
// widths and flex sizing resolve against the real layout parent (the grid),
// not the inner Animated.View whose Pressable parent has no defined width.
const OUTER_LAYOUT_KEYS = new Set<string>([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'flex', 'flexBasis', 'flexGrow', 'flexShrink', 'alignSelf',
  'position', 'top', 'bottom', 'left', 'right', 'zIndex',
]);

function splitStyle(style: ViewStyle | undefined): { outer: ViewStyle; inner: ViewStyle } {
  if (!style) return { outer: {}, inner: {} };
  const flat = StyleSheet.flatten(style) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (OUTER_LAYOUT_KEYS.has(key)) {
      outer[key] = value;
    } else {
      inner[key] = value;
    }
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

export function GlassCard({ children, level = 2, style, onPress }: GlassCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const borderOpacity = useRef(new Animated.Value(0)).current;

  const bg = LEVEL_MAP[level];

  if (!onPress) {
    return (
      <Animated.View style={[styles.card, { backgroundColor: bg }, style]}>
        {children}
      </Animated.View>
    );
  }

  // Both animations must use the SAME driver. borderColor cannot run on the
  // native driver, so the spring must run on JS too. Mixing native + JS in a
  // parallel composition triggered "Cannot read property 'default' of
  // undefined" when ScrollView fired rapid onPressIn/onPressOut on the
  // Pressables it scrolled over: the native nodes manager disconnected
  // animated nodes asynchronously, and the JS side then tried to dereference
  // an already-disconnected node. Same family as the SkeletonRow fix in
  // commit d9626903b.
  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.02, useNativeDriver: false }),
      Animated.timing(borderOpacity, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: false }),
      Animated.timing(borderOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const animatedBorder = borderOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', BOOKS_GHOST_BORDER],
  });

  const { outer, inner } = splitStyle(style);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={outer}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: bg,
            transform: [{ scale }],
            borderColor: animatedBorder,
            borderWidth: 1,
            alignSelf: 'stretch',
          },
          inner,
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
