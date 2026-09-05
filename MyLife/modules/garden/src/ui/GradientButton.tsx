import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GARDEN_CTA_GRADIENT,
  GARDEN_LIBRARY_GRADIENT,
  GARDEN_TYPOGRAPHY,
} from './tokens';

type GradientButtonVariant = 'primary' | 'secondary' | 'gold' | 'danger';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  variant?: GradientButtonVariant;
}

const DANGER_GRADIENT = { from: '#F87171', to: '#EF4444' } as const;

export function GradientButton({
  title,
  onPress,
  variant = 'primary',
}: GradientButtonProps) {
  if (variant === 'secondary') {
    return (
      <Pressable onPress={onPress} style={styles.secondary}>
        <Text style={styles.secondaryText}>{title}</Text>
      </Pressable>
    );
  }

  const grad =
    variant === 'danger'
      ? DANGER_GRADIENT
      : variant === 'gold'
        ? GARDEN_LIBRARY_GRADIENT
        : GARDEN_CTA_GRADIENT;

  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={[grad.from, grad.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text
          style={[
            styles.primaryText,
            variant === 'danger' && styles.dangerText,
          ]}
        >
          {title}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: '#0B1a04',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  secondary: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryText: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
});
