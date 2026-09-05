import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import { GARDEN_ACCENT, GARDEN_SURFACES, GARDEN_TYPOGRAPHY } from './tokens';

interface ZoneChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}

export function ZoneChip({ label, active = false, onPress, color }: ZoneChipProps) {
  const accent = color ?? GARDEN_ACCENT;
  const content = (
    <View
      style={[
        styles.chip,
        active && {
          shadowColor: accent,
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: active ? accent : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  if (onPress == null) {
    return content;
  }

  return (
    <Pressable onPress={onPress} hitSlop={4}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: GARDEN_SURFACES.highest,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  label: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
  },
});
