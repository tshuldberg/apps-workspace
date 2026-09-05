import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@mylife/ui';
import { RECIPES_SURFACES } from '../tokens';

export interface CircleIconButtonProps {
  /** Icon node rendered centered in the button. */
  icon: ReactNode;
  onPress: () => void;
  /** Already-translated accessibility label. */
  accessibilityLabel: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * 38pt floating round button, ultraThinMaterial blur background, white
 * stroke border. Used for back / share / bookmark buttons that float on top
 * of imagery (Recipe Detail header, Chef banner). Falls back to a tinted
 * surface on platforms without blur support.
 */
export function CircleIconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 38,
  style,
}: CircleIconButtonProps) {
  const theme = useTheme();
  const supportsBlur = Platform.OS === 'ios';
  const radius = size / 2;
  const baseStyle: StyleProp<ViewStyle> = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[baseStyle, style]}
    >
      {supportsBlur ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.glass.strongFill ?? RECIPES_SURFACES.focus, opacity: 0.7 },
          ]}
        />
      )}
      <View style={styles.icon}>{icon}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
