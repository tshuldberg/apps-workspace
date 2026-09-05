import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BOOKS_CTA_GRADIENT } from './tokens';
import { JAKARTA_FONTS } from './typography';

export interface GradientButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function GradientButton({
  label,
  onPress,
  disabled,
  style,
}: GradientButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.wrapper,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={[BOOKS_CTA_GRADIENT.from, BOOKS_CTA_GRADIENT.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  label: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#1a1008',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
