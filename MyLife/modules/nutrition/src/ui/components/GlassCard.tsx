import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { NU_GLASS, NU_SURFACES } from '../tokens';

export interface GlassCardProps {
  children: ReactNode;
  intensity?: number;
  padding?: number;
  onPress?: () => void;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

function CardShell({
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
  const backgroundColor = elevated
    ? NU_SURFACES.high
    : pressed
      ? 'rgba(255, 255, 255, 0.08)'
      : NU_GLASS.backgroundColor;

  return (
    <View
      style={[
        styles.shell,
        {
          padding,
          backgroundColor,
        },
        style,
      ]}
    >
      {!elevated ? (
        <BlurView
          tint="dark"
          intensity={intensity}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function GlassCard({
  children,
  intensity = NU_GLASS.blur,
  padding = 16,
  onPress,
  elevated = false,
  style,
}: GlassCardProps) {
  if (!onPress) {
    return (
      <CardShell
        intensity={intensity}
        padding={padding}
        elevated={elevated}
        style={style}
      >
        {children}
      </CardShell>
    );
  }

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <CardShell
          intensity={intensity}
          padding={padding}
          elevated={elevated}
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
  shell: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  content: {
    zIndex: 1,
  },
});
