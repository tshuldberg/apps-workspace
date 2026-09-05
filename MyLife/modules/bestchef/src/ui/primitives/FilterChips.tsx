import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemeColors } from '@mylife/ui';
import { HeroGradientView } from './HeroGradientView';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export interface FilterChipOption {
  /** Stable id used by selected and onChange. */
  id: string;
  /** Already-translated visible label. */
  label: string;
}

export interface FilterChipsProps {
  options: FilterChipOption[];
  selected: string;
  onChange: (id: string) => void;
  /** Optional icon rendered before the chip strip starts. */
  leadingIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Horizontal scroll strip of capsule chips. The selected chip uses the
 * are-blaze hero gradient; unselected chips use glass.cardFill. Wrap the
 * strip rather than rendering individual FilterChip rows by hand.
 */
export function FilterChips({ options, selected, onChange, leadingIcon, style }: FilterChipsProps) {
  const theme = useTheme();
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {leadingIcon != null && <View style={styles.leading}>{leadingIcon}</View>}
      {options.map((option) => {
        const isSelected = option.id === selected;
        if (isSelected) {
          return (
            <HeroGradientView
              key={option.id}
              style={styles.chipSelected}
            >
              <Pressable onPress={() => onChange(option.id)} style={styles.chipInner}>
                <Text
                  style={[styles.label, styles.labelSelected, { fontFamily }]}
                >
                  {option.label}
                </Text>
              </Pressable>
            </HeroGradientView>
          );
        }
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[
              styles.chip,
              { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
            ]}
          >
            <Text style={[styles.label, { color: colors.textSecondary, fontFamily }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  leading: {
    marginRight: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipSelected: {
    borderRadius: 999,
  },
  chipInner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  label: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '700',
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.letterSpacing,
  },
  labelSelected: {
    color: '#FFFFFF',
  },
});
