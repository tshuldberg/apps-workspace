import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import { GARDEN_ACCENT, GARDEN_SURFACES, GARDEN_TYPOGRAPHY } from './tokens';

interface QuickActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
  accent?: string;
}

export function QuickActionButton({
  icon,
  label,
  onPress,
  accent,
}: QuickActionButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const iconColor = accent ?? GARDEN_ACCENT;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: `${iconColor}1F` },
          ]}
        >
          <Text style={[styles.icon, { color: iconColor }]}>{icon}</Text>
        </View>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GARDEN_SURFACES.highest,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
    minWidth: 88,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
    lineHeight: 26,
  },
  label: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
