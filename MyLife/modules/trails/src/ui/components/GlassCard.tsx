import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { TR_CARD_RADIUS, TR_GLASS } from '../tokens';

export interface GlassCardProps {
  children: ReactNode;
  intensity?: number;
  padding?: number;
  onPress?: () => void;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

function GlassCardShell({
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
            : TR_GLASS.backgroundColor,
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
  intensity = TR_GLASS.blur,
  padding = 16,
  onPress,
  elevated = false,
  style,
}: GlassCardProps) {
  const mergedStyle = [style, elevated ? styles.elevated : null];

  if (!onPress) {
    return (
      <GlassCardShell intensity={intensity} padding={padding} style={mergedStyle}>
        {children}
      </GlassCardShell>
    );
  }

  return (
    <Pressable onPress={onPress}>
      {({ pressed }: PressableStateCallbackType) => (
        <GlassCardShell
          intensity={intensity}
          padding={padding}
          pressed={pressed}
          style={mergedStyle}
        >
          {children}
        </GlassCardShell>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: TR_CARD_RADIUS,
    overflow: 'hidden',
  },
  content: {
    zIndex: 1,
  },
  elevated: {
    shadowColor: 'rgba(0,0,0,0.4)',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
