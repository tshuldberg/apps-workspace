import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { THEME_PRESETS } from '@mylife/ui';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppTheme, useAppThemeColors } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';

const PICKER_PRESETS = [
  { id: 'bestchef-warm-charcoal', labelKey: 'Warm Charcoal' as const },
  { id: 'bestchef-warm-cream', labelKey: 'Warm Cream' as const },
  { id: 'bestchef-obsidian', labelKey: 'Cool Obsidian' as const },
] as const;

const HERO_GRADIENT_START = '#F26B4D';
const HERO_GRADIENT_END = '#FFC74D';

function MiniPreview({ presetId }: { presetId: string }) {
  const preset = THEME_PRESETS[presetId];
  if (!preset) return null;
  const c = preset.colors;
  return (
    <View style={[styles.miniPreview, { backgroundColor: c.background }]}>
      <View style={[styles.miniCard, { backgroundColor: preset.glass.cardFill, borderColor: preset.glass.cardBorder }]}>
        <View style={[styles.miniDot, { backgroundColor: c.accent }]} />
        <View style={[styles.miniDot, { backgroundColor: c.primary }]} />
        <View style={[styles.miniBar, { backgroundColor: c.surface }]} />
        <View style={[styles.miniBarShort, { backgroundColor: c.surfaceElevated }]} />
      </View>
      <View style={styles.miniDotsRow}>
        <View style={[styles.miniSmallDot, { backgroundColor: c.accent }]} />
        <View style={[styles.miniSmallDot, { backgroundColor: c.text }]} />
        <View style={[styles.miniSmallDot, { backgroundColor: c.textSecondary }]} />
      </View>
    </View>
  );
}

export function ThemePickerSection() {
  const tc = useAppThemeColors();
  const { themeId, setTheme } = useAppTheme();
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <Text style={[styles.hint, { color: tc.textSecondary }]}>
        {t('Choose a theme to match your kitchen')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {PICKER_PRESETS.map(({ id, labelKey }) => {
          const isSelected = themeId === id;
          const preset = THEME_PRESETS[id];
          if (!preset) return null;
          return (
            <Pressable
              key={id}
              onPress={() => setTheme(id)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: preset.glass.cardFill, borderColor: preset.glass.cardBorder },
                isSelected && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t(labelKey)}
              accessibilityState={{ selected: isSelected }}
            >
              {isSelected && (
                <View style={styles.selectedBorder} pointerEvents="none">
                  <View style={[styles.selectedBorderInner, { borderColor: HERO_GRADIENT_START }]} />
                </View>
              )}
              <MiniPreview presetId={id} />
              <View style={styles.cardBottom}>
                <Text style={[styles.cardLabel, { color: preset.colors.text }]} numberOfLines={1}>
                  {t(labelKey)}
                </Text>
                <View style={[styles.radioOuter, { borderColor: isSelected ? HERO_GRADIENT_END : preset.colors.textTertiary }]}>
                  {isSelected && (
                    <View style={[styles.radioInner, { backgroundColor: HERO_GRADIENT_END }]} />
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const CARD_W = 120;
const CARD_H = 160;

const styles = StyleSheet.create({
  container: { gap: 12 },
  hint: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12 },
  scroll: { gap: 12, paddingVertical: 2 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cardSelected: {},
  cardPressed: { opacity: 0.85 },
  selectedBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    zIndex: 10,
  },
  selectedBorderInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 3,
  },
  miniPreview: {
    flex: 1,
    padding: 10,
    gap: 6,
    justifyContent: 'center',
  },
  miniCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    gap: 5,
  },
  miniDot: { width: 18, height: 6, borderRadius: 3 },
  miniBar: { width: '100%', height: 4, borderRadius: 2 },
  miniBarShort: { width: '60%', height: 4, borderRadius: 2 },
  miniDotsRow: { flexDirection: 'row', gap: 5, justifyContent: 'center' },
  miniSmallDot: { width: 8, height: 8, borderRadius: 4 },
  cardBottom: {
    height: 44,
    paddingHorizontal: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    flex: 1,
    marginRight: 6,
  },
  radioOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 6, height: 6, borderRadius: 3 },
});
