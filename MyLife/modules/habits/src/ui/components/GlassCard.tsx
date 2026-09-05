import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { HB_GLASS, HB_SURFACES, withAlpha } from '../tokens';

const SURFACE_LEVELS = [
  HB_SURFACES.lowest,
  HB_SURFACES.base,
  HB_SURFACES.low,
  HB_SURFACES.mid,
  HB_SURFACES.high,
  HB_SURFACES.highest,
] as const;

export interface GlassCardProps {
  children: ReactNode;
  level?: 0 | 1 | 2 | 3 | 4 | 5;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function GlassCard({
  children,
  level = 2,
  style,
  contentStyle,
  onPress,
}: GlassCardProps) {
  const backgroundColor = SURFACE_LEVELS[level] ?? HB_SURFACES.low;

  const content = (
    <View style={[styles.card, { backgroundColor }, style]}>
      <BlurView
        tint="dark"
        intensity={HB_GLASS.blur}
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: HB_GLASS.backgroundColor,
          },
        ]}
      />
      <View style={[styles.inner, contentStyle]}>
        {children}
      </View>
    </View>
  );

  if (onPress == null) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: withAlpha('#000000', 1),
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  inner: {
    padding: 16,
  },
});
