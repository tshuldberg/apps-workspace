import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  estimatePageCount,
  getPageDimensions,
  MAX_ENTRIES_PER_BOOK,
  WORDS_PER_PAGE,
  listJournalEntries,
  getJournalDashboard,
} from '@mylife/journal';
import type { PageSize } from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.journal;
const PAGE_SIZES: PageSize[] = ['6x9', '5.5x8.5', '8.5x11'];

export default function BookBuilderScreen() {
  const db = useDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const dashboard = useMemo(() => getJournalDashboard(db, today), [db, today]);
  const entries = useMemo(() => listJournalEntries(db, {}), [db]);

  const totalWords = entries.reduce((sum, e) => sum + (e.wordCount ?? 0), 0);
  const estimate = estimatePageCount(totalWords, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Book Builder</Text>
      <Text style={styles.subtitle}>Compile your journal entries into a printable book.</Text>

      {/* Stats */}
      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{entries.length}</Text>
            <Text style={styles.statLabel}>Entries</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalWords.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Words</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{estimate.estimatedPages}</Text>
            <Text style={styles.statLabel}>Est. Pages</Text>
          </View>
        </View>
      </Card>

      {/* Page Size Options */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Page Sizes</Text>
        {PAGE_SIZES.map((size) => {
          const dims = getPageDimensions(size);
          return (
            <View key={size} style={styles.sizeRow}>
              <Text style={styles.sizeName}>{size}</Text>
              <Text style={styles.sizeDims}>{dims.widthPt}pt x {dims.heightPt}pt</Text>
            </View>
          );
        })}
      </Card>

      {/* Chapter Preview */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Chapter Preview</Text>
        <Text style={styles.chapterHint}>
          Entries auto-grouped by month. {entries.length > 0
            ? `Covering ${entries[entries.length - 1]?.entryDate?.slice(0, 7) ?? ''} to ${entries[0]?.entryDate?.slice(0, 7) ?? ''}.`
            : 'Write entries to see chapters.'}
        </Text>
        {(() => {
          const months = new Set(entries.map((e) => e.entryDate.slice(0, 7)));
          return Array.from(months).slice(0, 6).map((m) => {
            const count = entries.filter((e) => e.entryDate.slice(0, 7) === m).length;
            return (
              <View key={m} style={styles.chapterRow}>
                <Text style={styles.chapterMonth}>{m}</Text>
                <Text style={styles.chapterCount}>{count} entries</Text>
              </View>
            );
          });
        })()}
      </Card>

      {/* Limits */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Book Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Max entries per book</Text>
          <Text style={styles.detailValue}>{MAX_ENTRIES_PER_BOOK}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Words per page</Text>
          <Text style={styles.detailValue}>~{WORDS_PER_PAGE}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Text pages</Text>
          <Text style={styles.detailValue}>{estimate.estimatedTextPages}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Export formats</Text>
          <Text style={styles.detailValue}>PDF, Print-ready</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  statsCard: { padding: spacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: ACCENT },
  statLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sizeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  sizeName: { fontSize: 14, fontWeight: '600', color: colors.text },
  sizeDims: { fontSize: 14, color: colors.textSecondary },
  chapterHint: { fontSize: 12, color: colors.textTertiary },
  chapterRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  chapterMonth: { fontSize: 14, color: colors.text },
  chapterCount: { fontSize: 14, color: colors.textSecondary },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  detailLabel: { fontSize: 14, color: colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.text },
});
