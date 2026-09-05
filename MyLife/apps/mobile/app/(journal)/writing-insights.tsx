import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  listJournalEntries,
  listJournalTags,
  computeWritingInsights,
} from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.journal;

export default function WritingInsightsScreen() {
  const db = useDatabase();
  const entries = useMemo(() => listJournalEntries(db, { limit: 500 }), [db]);
  const tags = useMemo(() => listJournalTags(db), [db]);

  const insights = useMemo(() => {
    if (entries.length < 3) return null;
    const mapped = entries.map((e) => ({
      id: e.id,
      wordCount: e.wordCount ?? 0,
      entryDate: e.entryDate,
      createdAt: e.createdAt,
      mood: e.mood,
      body: e.body,
    }));
    // Build entry-tag pairs from tags table
    const entryTags: Array<{ entryId: string; tagName: string }> = [];
    for (const t of tags) {
      // Tags are global; pair with entries that have matching tags
      for (const e of entries) {
        if (e.tags?.includes(t.name)) {
          entryTags.push({ entryId: e.id, tagName: t.name });
        }
      }
    }
    return computeWritingInsights(mapped, entryTags);
  }, [entries, tags]);

  if (!insights) {
    return (
      <View style={styles.container}>
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 40 }}>📊</Text>
          <Text style={styles.emptyTitle}>Not Enough Data</Text>
          <Text style={styles.emptyText}>Write at least 3 entries to see writing insights.</Text>
        </Card>
      </View>
    );
  }

  const trendLabel = insights.wordCountTrend === 'increasing'
    ? 'Your writing is getting longer over time.'
    : insights.wordCountTrend === 'decreasing'
      ? 'Your entries are getting shorter.'
      : 'Your writing length is consistent.';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Writing Insights</Text>

      {/* Summary */}
      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{insights.totalWords.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Words</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{insights.avgWordsPerEntry}</Text>
            <Text style={styles.statLabel}>Avg/Entry</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{insights.totalEntries}</Text>
            <Text style={styles.statLabel}>Entries</Text>
          </View>
        </View>
      </Card>

      {/* Vocabulary & Trend */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Writing Quality</Text>
        <StatRow label="Vocabulary richness" value={`${(insights.vocabularyRichness * 100).toFixed(1)}%`} />
        <StatRow label="Longest entry" value={`${insights.longestEntryWordCount} words`} />
        <StatRow label="Shortest entry" value={`${insights.shortestEntryWordCount} words`} />
        <StatRow label="Word count trend" value={insights.wordCountTrend} />
        <Text style={styles.trendNote}>{trendLabel}</Text>
      </Card>

      {/* Top Tags */}
      {insights.topTags.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Most-Used Tags</Text>
          {insights.topTags.slice(0, 8).map((t) => (
            <View key={t.tag} style={styles.tagRow}>
              <Text style={styles.tagName}>#{t.tag}</Text>
              <Text style={styles.tagCount}>{t.entryCount} entries</Text>
              {t.avgMood != null && (
                <Text style={styles.tagMood}>mood: {t.avgMood.toFixed(1)}</Text>
              )}
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  emptyCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  statsCard: { padding: spacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: ACCENT },
  statLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowLabel: { fontSize: 14, color: colors.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  trendNote: { fontSize: 12, color: colors.textTertiary, fontStyle: 'italic' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  tagName: { fontSize: 14, color: ACCENT, fontWeight: '600', flex: 1 },
  tagCount: { fontSize: 12, color: colors.textSecondary },
  tagMood: { fontSize: 11, color: colors.textTertiary },
});
