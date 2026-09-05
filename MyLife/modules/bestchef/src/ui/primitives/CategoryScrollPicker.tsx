import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme, useThemeColors } from '@mylife/ui';
import { HeroGradientView } from './HeroGradientView';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export interface CategoryPickerOption {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Optional alternate icon used when this option is selected (e.g. white-tinted). */
  iconActive?: ReactNode;
}

export interface CategoryScrollPickerProps {
  options: CategoryPickerOption[];
  selected: string;
  onChange: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Horizontal scroll of category capsules with optional icon. Selected
 * capsule fills with hero gradient; unselected uses glass.cardFill. A subtle
 * divider line sits below the strip to separate from the list area.
 */
export function CategoryScrollPicker({
  options,
  selected,
  onChange,
  style,
}: CategoryScrollPickerProps) {
  const theme = useTheme();
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  return (
    <View style={[styles.wrap, { borderBottomColor: theme.glass.cardBorder }, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {options.map((option) => {
          const isSelected = option.id === selected;
          if (isSelected) {
            const activeIcon = option.iconActive ?? option.icon;
            return (
              <HeroGradientView key={option.id} style={styles.capsuleSelected}>
                <Pressable onPress={() => onChange(option.id)} style={styles.capsuleInner}>
                  {activeIcon != null && <View style={styles.icon}>{activeIcon}</View>}
                  <Text style={[styles.label, styles.labelSelected, { fontFamily }]}>
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
                styles.capsule,
                { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
              ]}
            >
              {option.icon != null && <View style={styles.icon}>{option.icon}</View>}
              <Text style={[styles.label, { color: colors.textSecondary, fontFamily }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  capsuleSelected: {
    borderRadius: 999,
  },
  capsuleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '700',
  },
  labelSelected: {
    color: '#FFFFFF',
  },
});
