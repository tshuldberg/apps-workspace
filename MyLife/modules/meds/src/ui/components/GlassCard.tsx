import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { MD_CARD_RADIUS, MD_GLASS } from '../tokens';

export interface GlassCardProps {
  children: ReactNode;
  intensity?: number;
  onPress?: () => void;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

function CardShell({
  children,
  intensity,
  padding,
  pressed,
  style,
}: {
  children: ReactNode;
  intensity: number;
  padding: number;
  pressed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          padding,
          backgroundColor: pressed
            ? 'rgba(255, 255, 255, 0.08)'
            : MD_GLASS.backgroundColor,
        },
        style,
      ]}
    >
      <BlurView tint="dark" intensity={intensity} style={StyleSheet.absoluteFillObject} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function GlassCard({
  children,
  intensity = MD_GLASS.blur,
  onPress,
  padding = 16,
  style,
}: GlassCardProps) {
  if (!onPress) {
    return (
      <CardShell intensity={intensity} padding={padding} style={style}>
        {children}
      </CardShell>
    );
  }

  return (
    <Pressable onPress={onPress}>
      {({ pressed }: { pressed: boolean }) => (
        <CardShell
          intensity={intensity}
          padding={padding}
          pressed={pressed}
          style={style}
        >
          {children}
        </CardShell>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: MD_CARD_RADIUS,
    overflow: 'hidden',
    borderWidth: 0,
  },
  content: {
    zIndex: 1,
  },
});
