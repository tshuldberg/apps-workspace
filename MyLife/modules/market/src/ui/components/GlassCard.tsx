import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  MK_CARD_RADIUS,
  MK_GLASS,
  MK_GLOW_STYLE,
} from '../tokens';

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
  elevated,
  pressed,
  style,
}: {
  children: ReactNode;
  intensity: number;
  padding: number;
  elevated: boolean;
  pressed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.card,
        elevated ? MK_GLOW_STYLE : null,
        {
          padding,
          backgroundColor: pressed
            ? 'rgba(255, 255, 255, 0.08)'
            : MK_GLASS.backgroundColor,
        },
        style,
      ]}
    >
      <BlurView
        tint="dark"
        intensity={intensity}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function GlassCard({
  children,
  intensity = MK_GLASS.blur,
  padding = 16,
  onPress,
  elevated = false,
  style,
}: GlassCardProps) {
  if (!onPress) {
    return (
      <GlassCardShell
        intensity={intensity}
        padding={padding}
        elevated={elevated}
        style={style}
      >
        {children}
      </GlassCardShell>
    );
  }

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <GlassCardShell
          intensity={intensity}
          padding={padding}
          elevated={elevated}
          pressed={pressed}
          style={style}
        >
          {children}
        </GlassCardShell>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: MK_CARD_RADIUS,
    overflow: 'hidden',
  },
  content: {
    zIndex: 1,
  },
});
