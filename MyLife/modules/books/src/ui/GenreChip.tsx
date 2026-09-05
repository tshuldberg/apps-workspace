import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { BOOKS_SURFACES } from './tokens';
import { JAKARTA_FONTS } from './typography';

export interface GenreChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function GenreChip({ label, selected, onPress, style }: GenreChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        style,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
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
    backgroundColor: BOOKS_SURFACES.focus,
  },
  chipSelected: {
    backgroundColor: BOOKS_SURFACES.focus,
    shadowColor: '#C9894D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#D6C3B5',
  },
  labelSelected: {
    color: '#C9894D',
  },
});
