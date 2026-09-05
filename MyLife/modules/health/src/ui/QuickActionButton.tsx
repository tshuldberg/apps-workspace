import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HEALTH_TYPOGRAPHY, HEALTH_SURFACES } from './tokens';
import { colors } from '@mylife/ui';

interface QuickActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
}

export function QuickActionButton({ icon, label, onPress }: QuickActionButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    width: 80,
    height: 80,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
    lineHeight: 32,
  },
  label: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
