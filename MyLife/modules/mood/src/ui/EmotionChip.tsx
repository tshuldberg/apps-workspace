import { Pressable, StyleSheet, Text } from 'react-native';
import { MOOD_ACCENT, MOOD_SURFACES, MOOD_TYPOGRAPHY } from './tokens';
import { colors } from '@mylife/ui';

interface EmotionChipProps {
  label: string;
  selected?: boolean;
  color?: string;
  onPress?: () => void;
}

export function EmotionChip({
  label,
  selected = false,
  color,
  onPress,
}: EmotionChipProps) {
  const chipColor = color ?? MOOD_ACCENT;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && [
          styles.chipSelected,
          {
            shadowColor: chipColor,
            backgroundColor: `${chipColor}18`,
          },
        ],
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: selected ? chipColor : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: MOOD_SURFACES.focus,
  },
  chipSelected: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    fontFamily: MOOD_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 13,
    fontWeight: '500',
  },
});
