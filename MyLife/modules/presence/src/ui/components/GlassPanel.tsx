import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  PR_CARD_RADIUS,
  PR_CYAN_GLOW_STYLE,
  PR_GLASS,
  PR_SURFACES,
} from '../tokens';

export interface GlassPanelProps {
  children: ReactNode;
  intensity?: number;
  padding?: number;
  onPress?: () => void;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GlassPanel({
  children,
  intensity = PR_GLASS.blur,
  padding = 16,
  onPress,
  glow = false,
  style,
}: GlassPanelProps) {
  const content = (pressedOrHovered = false) => (
    <BlurView
      tint="dark"
      intensity={intensity}
      style={[
        styles.panel,
        {
          padding,
          backgroundColor: pressedOrHovered
            ? 'rgba(255, 255, 255, 0.08)'
            : PR_GLASS.backgroundColor,
        },
        glow && PR_CYAN_GLOW_STYLE,
        style,
      ]}
    >
      {children}
    </BlurView>
  );

  if (onPress == null) {
    return content();
  }

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: PR_CARD_RADIUS,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: PR_GLASS.backgroundColor,
    shadowColor: PR_SURFACES.lowest,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});
