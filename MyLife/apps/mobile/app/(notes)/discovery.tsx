import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getNotes,
  getNoteGraph,
  computeKnowledgeDiscovery,
} from '@mylife/notes';
import type { KnowledgeDiscoveryInsights } from '@mylife/notes';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.notes;

export default function DiscoveryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [randomSeed, setRandomSeed] = useState(0);

  const notes = useMemo(() => {
    try { return getNotes(db); } catch { return []; }
  }, [db]);

  const graph = useMemo(() => {
    try { return getNoteGraph(db); } catch { return { nodes: [], edges: [] }; }
  }, [db]);

  const discovery: KnowledgeDiscoveryInsights | null = useMemo(() => {
    if (notes.length === 0) return null;
    // computeKnowledgeDiscovery expects notes with body field
    const notesWithBody = notes.map((n) => ({ ...n, body: n.body ?? '' }));
    try { return computeKnowledgeDiscovery(notesWithBody, graph); } catch { return null; }
  }, [notes, graph]);

  // Pick a random "daily discovery" note, stable across renders until user shuffles.
  // randomSeed is intentionally a dep so tapping "Random Note" reshuffles the pick.
  const dailyNote = useMemo(() => {
    if (notes.length === 0) return null;
    const index = Math.floor(Math.random() * notes.length);
    return notes[index] ?? null;
  }, [notes, randomSeed]);

  if (notes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={{ fontSize: 48 }}>{'💡'}</Text>
        <Text variant="subheading" style={{ marginTop: spacing.sm }}>Knowledge Discovery</Text>
        <Text variant="body" color={colors.textSecondary} style={styles.emptyText}>
          Create notes to unlock AI-powered discovery insights.
        </Text>
      </View>
    );
  }

  const handleRandomNote = () => {
    if (notes.length === 0) return;
    const index = Math.floor(Math.random() * notes.length);
    const next = notes[index];
    if (next) {
      router.push(`/(notes)/note-editor?id=${next.id}`);
    }
    setRandomSeed((s) => s + 1);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="heading">Knowledge Discovery</Text>

      {/* Daily discovery */}
      {dailyNote && (
        <Card style={styles.dailyCard}>
          <Text variant="label" color={colors.textTertiary}>DAILY REDISCOVERY</Text>
          <Text variant="subheading" color={colors.text}>{dailyNote.title || 'Untitled'}</Text>
          <Text variant="body" color={colors.textSecondary} numberOfLines={3}>
            {dailyNote.body?.slice(0, 200) ?? ''}
          </Text>
          <Text variant="caption" color={colors.textTertiary}>
            Created {new Date(dailyNote.createdAt).toLocaleDateString()}
          </Text>
        </Card>
      )}

      {/* Suggested connections */}
      {discovery && discovery.suggestedLinks.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>SUGGESTED CONNECTIONS</Text>
          {discovery.suggestedLinks.slice(0, 5).map((pair, i) => (
            <View key={i} style={styles.suggestionRow}>
              <Text variant="body" color={colors.text} style={{ flex: 1 }}>
                {pair.titleA || 'Untitled'}
              </Text>
              <Text variant="caption" color={ACCENT}>{'<->'}</Text>
              <Text variant="body" color={colors.text} style={{ flex: 1, textAlign: 'right' }}>
                {pair.titleB || 'Untitled'}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Knowledge gaps */}
      {discovery && discovery.knowledgeGaps.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>KNOWLEDGE GAPS</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Terms mentioned frequently but without their own note:
          </Text>
          <View style={styles.gapRow}>
            {discovery.knowledgeGaps.slice(0, 8).map((gap) => (
              <View key={gap.term} style={styles.gapChip}>
                <Text variant="caption" color={colors.text}>{gap.term}</Text>
                <Text variant="caption" color={colors.textTertiary}>({gap.mentionCount})</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Stats summary */}
      {discovery && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>INSIGHTS</Text>
          <View style={styles.insightRow}>
            <Text variant="body" color={colors.textSecondary}>Total Notes</Text>
            <Text variant="body" color={colors.text}>{discovery.totalNotes}</Text>
          </View>
          <View style={styles.insightRow}>
            <Text variant="body" color={colors.textSecondary}>Orphan Notes</Text>
            <Text variant="body" color={colors.text}>{discovery.orphanCount}</Text>
          </View>
          <View style={styles.insightRow}>
            <Text variant="body" color={colors.textSecondary}>Avg Staleness</Text>
            <Text variant="body" color={colors.text}>{discovery.avgStaleness.toFixed(1)}</Text>
          </View>
        </Card>
      )}

      {/* Most connected notes */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>MOST CONNECTED</Text>
        {graph.nodes
          .sort((a, b) => b.linkCount - a.linkCount)
          .slice(0, 5)
          .map((node) => (
            <View key={node.id} style={styles.connectedRow}>
              <Text variant="body" color={colors.text} style={{ flex: 1 }}>{node.title}</Text>
              <Text variant="caption" color={ACCENT}>{node.linkCount} links</Text>
            </View>
          ))}
      </Card>

      {/* Random note */}
      <Pressable style={styles.randomBtn} onPress={handleRandomNote}>
        <Text variant="body" color={ACCENT}>{'🎲'} Random Note</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background, padding: spacing.lg,
  },
  emptyText: { textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xl },
  dailyCard: { borderLeftWidth: 3, borderLeftColor: ACCENT },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  gapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  gapChip: {
    flexDirection: 'row', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: 999, backgroundColor: colors.surfaceElevated,
  },
  insightRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  connectedRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  randomBtn: {
    paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: ACCENT,
  },
});
