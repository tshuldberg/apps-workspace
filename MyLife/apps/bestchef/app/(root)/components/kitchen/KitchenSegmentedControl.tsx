import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';

interface KitchenSegmentedControlProps {
  active: 'pantry' | 'grocery';
  onChange: (value: 'pantry' | 'grocery') => void;
}

const SEGMENTS: Array<{ key: 'pantry' | 'grocery'; labelKey: string }> = [
  { key: 'pantry', labelKey: 'Pantry' },
  { key: 'grocery', labelKey: 'Grocery' },
];

export function KitchenSegmentedControl({ active, onChange }: KitchenSegmentedControlProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const slideAnim = useRef(new Animated.Value(active === 'pantry' ? 0 : 1)).current;

  const handlePress = (key: 'pantry' | 'grocery') => {
    if (key === active) return;
    Animated.timing(slideAnim, {
      toValue: key === 'pantry' ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onChange(key);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
      {SEGMENTS.map((seg) => {
        const isActive = seg.key === active;
        return (
          <Pressable
            key={seg.key}
            style={[
              styles.pill,
              isActive && { backgroundColor: HERO_GRADIENT.from },
            ]}
            onPress={() => handlePress(seg.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.label,
                { color: isActive ? '#FFFFFF' : tc.textSecondary },
              ]}
            >
              {t(seg.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  pill: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    lineHeight: 18,
  },
});
