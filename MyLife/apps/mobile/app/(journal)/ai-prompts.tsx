import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { generatePrompt, PROMPT_THEMES, getThemeDefinition, dateToHash } from '@mylife/journal';
import type { AiPromptTheme } from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';

const ACCENT = colors.modules.journal;

export default function AiPromptsScreen() {
  const [selectedTheme, setSelectedTheme] = useState<AiPromptTheme | null>(null);
  const [shuffleKey, setShuffleKey] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const seed = dateToHash(today) + shuffleKey;

  const prompt = useMemo(() => {
    return generatePrompt(
      {
        moodTrend: 'stable',
        recentMoods: [],
        avgWordCount: 100,
        streakDays: 0,
        daysSinceLastEntry: 0,
        recentThemes: selectedTheme ? [selectedTheme] : [],
      },
      seed,
    );
  }, [selectedTheme, seed]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Writing Prompts</Text>

      {/* Daily Featured */}
      <Card style={styles.featuredCard}>
        <Text style={styles.featuredLabel}>Today&apos;s Prompt</Text>
        <Text style={styles.featuredText}>{prompt.promptText}</Text>
        <View style={styles.featuredMeta}>
          <View style={[styles.themeBadge, { backgroundColor: ACCENT }]}>
            <Text style={styles.themeBadgeText}>{prompt.theme.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <Pressable style={styles.shuffleBtn} onPress={() => setShuffleKey((k) => k + 1)}>
          <Text style={styles.shuffleText}>Shuffle</Text>
        </Pressable>
      </Card>

      {/* Theme Filter */}
      <Text style={styles.sectionTitle}>Categories</Text>
      <View style={styles.chipRow}>
        <Pressable style={[styles.chip, !selectedTheme ? styles.chipActive : null]}
          onPress={() => setSelectedTheme(null)}>
          <Text style={[styles.chipText, !selectedTheme ? { color: colors.background } : null]}>All</Text>
        </Pressable>
        {PROMPT_THEMES.map((t) => (
          <Pressable key={t.theme} style={[styles.chip, selectedTheme === t.theme ? styles.chipActive : null]}
            onPress={() => setSelectedTheme(t.theme)}>
            <Text style={[styles.chipText, selectedTheme === t.theme ? { color: colors.background } : null]}>
              {t.icon} {t.theme.replace(/_/g, ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Theme List */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>All Themes</Text>
        {PROMPT_THEMES.map((t) => (
          <Pressable key={t.theme} style={styles.themeRow} onPress={() => setSelectedTheme(t.theme)}>
            <Text style={styles.themeIcon}>{t.icon}</Text>
            <Text style={styles.themeName}>{t.theme.replace(/_/g, ' ')}</Text>
            <Text style={styles.themeCount}>{t.templates.length} prompts</Text>
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  featuredCard: { padding: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  featuredLabel: { fontSize: 10, color: ACCENT, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  featuredText: { fontSize: 18, color: colors.text, textAlign: 'center', lineHeight: 26, fontStyle: 'italic' },
  featuredMeta: { flexDirection: 'row', gap: spacing.sm },
  themeBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  themeBadgeText: { fontSize: 10, color: colors.background, fontWeight: '600', textTransform: 'capitalize' },
  shuffleBtn: { borderWidth: 1, borderColor: ACCENT, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 },
  shuffleText: { fontSize: 13, color: ACCENT, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { fontSize: 11, color: colors.textSecondary, textTransform: 'capitalize' },
  section: { padding: spacing.md, gap: spacing.sm },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  themeIcon: { fontSize: 18 },
  themeName: { fontSize: 14, color: colors.text, flex: 1, textTransform: 'capitalize' },
  themeCount: { fontSize: 12, color: colors.textTertiary },
});
