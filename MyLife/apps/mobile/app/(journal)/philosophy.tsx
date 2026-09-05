import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { getDayOfYear, getQuoteDayNumber, PhilosophyQuoteSchema } from '@mylife/journal';
import type { PhiloTradition } from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';

const ACCENT = colors.modules.journal;
const TRADITIONS: PhiloTradition[] = ['stoicism', 'buddhism', 'existentialism', 'pragmatism', 'general_wisdom'];

// Simple quote bank for display
const QUOTES: Array<{ text: string; author: string; tradition: PhiloTradition }> = [
  { text: 'The happiness of your life depends upon the quality of your thoughts.', author: 'Marcus Aurelius', tradition: 'stoicism' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein', tradition: 'general_wisdom' },
  { text: 'Peace comes from within. Do not seek it without.', author: 'Buddha', tradition: 'buddhism' },
  { text: 'Man is condemned to be free.', author: 'Jean-Paul Sartre', tradition: 'existentialism' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs', tradition: 'pragmatism' },
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca', tradition: 'stoicism' },
  { text: 'The mind is everything. What you think you become.', author: 'Buddha', tradition: 'buddhism' },
];

export default function PhilosophyScreen() {
  const [filter, setFilter] = useState<PhiloTradition | 'all'>('all');
  const dayOfYear = getDayOfYear(new Date().toISOString().slice(0, 10));
  const dailyIndex = dayOfYear % QUOTES.length;
  const dailyQuote = QUOTES[dailyIndex];

  const filtered = filter === 'all' ? QUOTES : QUOTES.filter((q) => q.tradition === filter);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Philosophy &amp; Affirmations</Text>

      {/* Quote of the Day */}
      <Card style={styles.dailyCard}>
        <Text style={styles.dailyLabel}>Quote of the Day</Text>
        <Text style={styles.dailyText}>&ldquo;{dailyQuote.text}&rdquo;</Text>
        <Text style={styles.dailyAuthor}>-- {dailyQuote.author}</Text>
        <View style={[styles.tradBadge, { backgroundColor: ACCENT }]}>
          <Text style={styles.tradText}>{dailyQuote.tradition}</Text>
        </View>
      </Card>

      {/* Tradition Filter */}
      <View style={styles.chipRow}>
        <Pressable style={[styles.chip, filter === 'all' ? styles.chipActive : null]}
          onPress={() => setFilter('all')}>
          <Text style={[styles.chipText, filter === 'all' ? { color: colors.background } : null]}>All</Text>
        </Pressable>
        {TRADITIONS.map((t) => (
          <Pressable key={t} style={[styles.chip, filter === t ? styles.chipActive : null]}
            onPress={() => setFilter(t)}>
            <Text style={[styles.chipText, filter === t ? { color: colors.background } : null]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Quotes List */}
      {filtered.map((q, i) => (
        <Card key={i} style={styles.quoteCard}>
          <Text style={styles.quoteText}>&ldquo;{q.text}&rdquo;</Text>
          <View style={styles.quoteFooter}>
            <Text style={styles.quoteAuthor}>{q.author}</Text>
            <View style={[styles.tradBadgeSmall, { backgroundColor: colors.glassStrong }]}>
              <Text style={styles.tradSmallText}>{q.tradition}</Text>
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  dailyCard: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  dailyLabel: { fontSize: 10, color: ACCENT, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  dailyText: { fontSize: 20, color: colors.text, textAlign: 'center', lineHeight: 28, fontStyle: 'italic' },
  dailyAuthor: { fontSize: 14, color: colors.textSecondary },
  tradBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  tradText: { fontSize: 10, color: colors.background, fontWeight: '600', textTransform: 'capitalize' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { fontSize: 11, color: colors.textSecondary, textTransform: 'capitalize' },
  quoteCard: { padding: spacing.md, gap: spacing.xs },
  quoteText: { fontSize: 15, color: colors.text, lineHeight: 22, fontStyle: 'italic' },
  quoteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteAuthor: { fontSize: 13, color: colors.textSecondary },
  tradBadgeSmall: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  tradSmallText: { fontSize: 9, color: colors.text, textTransform: 'capitalize' },
});
