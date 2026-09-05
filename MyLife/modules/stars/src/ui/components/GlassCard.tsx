import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { ST_GLASS, ST_SURFACES, withAlpha } from '../tokens';

export type GlassCardVariant = 'low' | 'high';

export interface GlassCardProps {
  children: ReactNode;
  variant?: GlassCardVariant;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  intensity?: number;
}

export function GlassCard({
  children,
  variant = 'low',
  style,
  contentStyle,
  onPress,
  intensity = ST_GLASS.blur,
}: GlassCardProps) {
  const backgroundColor =
    variant === 'high'
      ? withAlpha(ST_SURFACES.highest, 0.72)
      : withAlpha(ST_SURFACES.low, 0.76);

  const card = (
    <BlurView
      tint="dark"
      intensity={intensity}
      style={[styles.card, { backgroundColor }, style]}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </BlurView>
  );

  if (!onPress) {
    return card;
  }

  return <Pressable onPress={onPress}>{card}</Pressable>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  content: {
    backgroundColor: ST_GLASS.backgroundColor,
    padding: 16,
  },
});
