import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { WK_GLASS } from '../tokens';

export interface GlassPanelProps {
  children: ReactNode;
  intensity?: number;
  onPress?: () => void;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  // Only used when onPress is set (the panel becomes a button). A label is
  // strongly recommended so the pressable announces its purpose, not just its
  // child text.
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

function PanelShell({
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
        styles.panel,
        {
          padding,
          backgroundColor: pressed ? 'rgba(255, 255, 255, 0.08)' : WK_GLASS.backgroundColor,
        },
        style,
      ]}
    >
      <BlurView tint="dark" intensity={intensity} style={StyleSheet.absoluteFillObject} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function GlassPanel({
  children,
  intensity = WK_GLASS.blur,
  onPress,
  padding = 16,
  style,
  accessibilityLabel,
  accessibilityHint,
}: GlassPanelProps) {
  if (!onPress) {
    return (
      <PanelShell intensity={intensity} padding={padding} style={style}>
        {children}
      </PanelShell>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      {({ pressed }) => (
        <PanelShell
          intensity={intensity}
          padding={padding}
          pressed={pressed}
          style={style}
        >
          {children}
        </PanelShell>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  content: {
    zIndex: 1,
  },
});
