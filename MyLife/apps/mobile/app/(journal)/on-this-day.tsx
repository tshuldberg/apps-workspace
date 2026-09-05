import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { listOnThisDayEntries, rankOnThisDayEntries } from '@mylife/journal';
import type { JournalOnThisDayItem } from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.journal;
const MOOD_EMOJIS: Record<string, string> = {
  low: '\uD83D\uDE14',
  okay: '\uD83D\uDE10',
  good: '\uD83D\uDE42',
  great: '\uD83D\uDE04',
  grateful: '\uD83E\uDD70',
};

export default function OnThisDayScreen() {
  const db = useDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const entries = useMemo(() => listOnThisDayEntries(db, today), [db, today]);

  // Rank and build display list joined to full entries
  const ranked = useMemo(() => {
    const scores = rankOnThisDayEntries(entries.map((e) => ({
      id: e.id,
      mood: e.mood,
      imageUris: [],
      wordCount: e.wordCount ?? 0,
      tags: e.tags ?? [],
      entryType: 'text',
      audioPath: null,
      latitude: null,
      yearsAgo: e.yearsAgo,
    })));
    const entryMap = new Map<string, JournalOnThisDayItem>();
    for (const e of entries) entryMap.set(e.id, e);
    return scores
      .map((s) => ({ ...s, entry: entryMap.get(s.id) }))
      .filter((s): s is typeof s & { entry: JournalOnThisDayItem } => !!s.entry);
  }, [entries]);

  if (ranked.length === 0) {
    return (
      <View style={styles.container}>
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 48 }}>📅</Text>
          <Text style={styles.emptyTitle}>No Memories Today</Text>
          <Text style={styles.emptyText}>
            Keep journaling and your past entries will appear here on their anniversary dates.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>On This Day</Text>
      <Text style={styles.subtitle}>
        {ranked.length} memor{ranked.length === 1 ? 'y' : 'ies'} from past years
      </Text>

      {ranked.map((item) => {
        const year = item.entry.entryDate.slice(0, 4);
        return (
          <Card key={item.id} style={styles.memoryCard}>
            <View style={styles.memoryHeader}>
              <View style={styles.yearBadge}>
                <Text style={styles.yearText}>{year}</Text>
              </View>
              <Text style={styles.yearsAgo}>
                {item.yearsAgo} year{item.yearsAgo !== 1 ? 's' : ''} ago
              </Text>
              {item.entry.mood && (
                <Text style={styles.moodEmoji}>
                  {MOOD_EMOJIS[item.entry.mood] ?? ''}
                </Text>
              )}
            </View>
            {item.entry.title && (
              <Text style={styles.memoryTitle}>{item.entry.title}</Text>
            )}
            <Text style={styles.memoryBody} numberOfLines={6}>
              {item.entry.body}
            </Text>
            <View style={styles.memoryMeta}>
              {(item.entry.wordCount ?? 0) > 0 && (
                <Text style={styles.metaText}>{item.entry.wordCount} words</Text>
              )}
              {item.entry.mood && (
                <Text style={styles.metaText}>mood: {item.entry.mood}</Text>
              )}
            </View>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreFill, { width: `${Math.min(100, item.score * 10)}%` }]} />
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  emptyCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  memoryCard: { padding: spacing.md, gap: spacing.sm },
  memoryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  yearBadge: { backgroundColor: ACCENT, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  yearText: { fontSize: 12, fontWeight: '700', color: colors.background },
  yearsAgo: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  moodEmoji: { fontSize: 18 },
  memoryTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  memoryBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  memoryMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metaText: { fontSize: 11, color: colors.textTertiary },
  scoreBar: { width: '100%', height: 3, backgroundColor: colors.surface, borderRadius: 2 },
  scoreFill: { height: 3, backgroundColor: ACCENT, borderRadius: 2 },
});
