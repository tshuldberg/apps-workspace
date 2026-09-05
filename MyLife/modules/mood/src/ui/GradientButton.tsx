import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MOOD_TYPOGRAPHY, MOOD_CTA_GRADIENT } from './tokens';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
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

  const grad = variant === 'danger' ? DANGER_GRADIENT : MOOD_CTA_GRADIENT;

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
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1008',
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
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
});
