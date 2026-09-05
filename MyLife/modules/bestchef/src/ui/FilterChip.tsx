import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@mylife/ui';
import {
  RECIPES_ACCENT,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from './tokens';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function FilterChip({ label, selected = false, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  chipSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
    shadowColor: RECIPES_ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  label: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  labelSelected: {
    color: RECIPES_ACCENT,
  },
});
