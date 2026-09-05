import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemeColors } from '@mylife/ui';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export interface FlowChipOption {
  id: string;
  label: string;
}

export interface FlowChipsProps {
  options: FlowChipOption[];
  selected?: string | null;
  onChange?: (id: string) => void;
  /** Optional icon rendered before each chip. Used for trending flame. */
  leadingIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wrapping chip flow used for trending dishes and tag clouds. Wraps to
 * multiple lines instead of horizontally scrolling. Optional leading icon
 * (e.g. a flame for trending) rendered inside each chip.
 */
export function FlowChips({ options, selected, onChange, leadingIcon, style }: FlowChipsProps) {
  const theme = useTheme();
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  return (
    <View style={[styles.flow, style]}>
      {options.map((option) => {
        const isSelected = option.id === selected;
        const tint = isSelected ? '#F26A3A22' : theme.glass.cardFill;
        const borderTone = isSelected ? '#F26A3A55' : theme.glass.cardBorder;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange?.(option.id)}
            style={[
              styles.chip,
              { backgroundColor: tint, borderColor: borderTone },
            ]}
          >
            {leadingIcon != null && <View style={styles.leading}>{leadingIcon}</View>}
            <Text
              style={[
                styles.label,
                { color: isSelected ? '#F26A3A' : colors.textSecondary, fontFamily },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '600',
  },
});
