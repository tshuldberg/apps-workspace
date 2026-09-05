import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import { getNoteGraph, getGraphStats } from '@mylife/notes';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.notes;

export default function GraphViewScreen() {
  const db = useDatabase();

  const graph = useMemo(() => {
    try {
      return getNoteGraph(db);
    } catch {
      return { nodes: [], edges: [] };
    }
  }, [db]);

  const stats = useMemo(() => {
    try {
      return getGraphStats(graph);
    } catch {
      return { nodeCount: 0, edgeCount: 0, orphanCount: 0, clusterCount: 0, avgLinkCount: 0 };
    }
  }, [graph]);

  return (
    <View style={styles.container}>
      <View style={styles.statsBar}>
        <StatBadge label="Notes" value={String(stats.nodeCount)} />
        <StatBadge label="Links" value={String(stats.edgeCount)} />
        <StatBadge label="Orphans" value={String(stats.orphanCount)} />
        <StatBadge label="Clusters" value={String(stats.clusterCount)} />
      </View>
      {graph.nodes.length === 0 ? (
        <View style={styles.graphArea}>
          <Text style={{ fontSize: 48 }}>{'🕸️'}</Text>
          <Text variant="subheading" style={{ marginTop: spacing.sm }}>Knowledge Graph</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', marginTop: spacing.xs }}>
            Create notes with [[backlinks]] to build your knowledge graph.
          </Text>
        </View>
      ) : (
        <View style={styles.graphArea}>
          <Text variant="subheading">{stats.nodeCount} Notes Connected</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', marginTop: spacing.xs }}>
            {stats.edgeCount} links across {stats.clusterCount} cluster{stats.clusterCount !== 1 ? 's' : ''}.
            {stats.orphanCount > 0 ? ` ${stats.orphanCount} orphan note${stats.orphanCount !== 1 ? 's' : ''}.` : ''}
          </Text>
          <Text variant="caption" color={colors.textTertiary} style={{ marginTop: spacing.md, textAlign: 'center' }}>
            Full graph visualization available on web.
          </Text>
        </View>
      )}
    </View>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: ACCENT }}>{value}</Text>
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stat: { alignItems: 'center' },
  graphArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
});
