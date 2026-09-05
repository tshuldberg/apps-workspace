import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  FR_CARD_RADIUS,
  FR_GLASS,
  FR_PURPLE_GLOW_STYLE,
  FR_SURFACES,
} from '../tokens';

export interface GlassCardProps {
  children: ReactNode;
  intensity?: number;
  padding?: number;
  glow?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function renderPanel({
  children,
  intensity,
  padding,
  glow,
  style,
  pressed = false,
}: GlassCardProps & { pressed?: boolean }) {
  return (
    <BlurView
      tint="dark"
      intensity={intensity ?? FR_GLASS.blur}
      style={[
        styles.card,
        {
          padding: padding ?? 16,
          backgroundColor: pressed ? 'rgba(255, 255, 255, 0.08)' : FR_GLASS.backgroundColor,
        },
        glow ? FR_PURPLE_GLOW_STYLE : null,
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

export function GlassCard(props: GlassCardProps) {
  if (props.onPress == null) {
    return renderPanel(props);
  }

  return (
    <Pressable onPress={props.onPress}>
      {({ pressed }) => renderPanel({ ...props, pressed })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: FR_CARD_RADIUS,
    overflow: 'hidden',
    borderWidth: 0,
    shadowColor: FR_SURFACES.lowest,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});
