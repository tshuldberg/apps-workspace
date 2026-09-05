import { useMemo, useState } from 'react';
import { Alert, View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { createCanvas, getCanvases, type Canvas } from '@mylife/notes';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.notes;

export default function CanvasListScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  const canvases = useMemo(() => {
    try {
      return getCanvases(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  function handleCreate() {
    try {
      const id = uuid();
      createCanvas(db, id, { title: 'Untitled Canvas' });
      setTick((t) => t + 1);
      router.push(`/(notes)/canvas?id=${id}`);
    } catch {
      Alert.alert('Error', 'Could not create canvas.');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="heading">Canvas</Text>
        <Pressable style={styles.createButton} onPress={handleCreate}>
          <Text variant="caption" color={ACCENT} style={{ fontWeight: '600' }}>+ New Canvas</Text>
        </Pressable>
      </View>

      {canvases.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48 }}>{'🎨'}</Text>
          <Text variant="subheading" style={{ marginTop: spacing.sm }}>No Canvases Yet</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xl }}>
            Create a canvas to arrange notes, images, and ideas on an infinite whiteboard.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {canvases.map((c: Canvas) => (
            <Pressable
              key={c.id}
              style={styles.card}
              onPress={() => router.push(`/(notes)/canvas?id=${c.id}`)}
            >
              <View style={styles.cardRow}>
                <Text variant="body">{c.title || 'Untitled Canvas'}</Text>
                {c.isPinned && <Text variant="caption" color={ACCENT}>pinned</Text>}
              </View>
              <Text variant="caption" color={colors.textSecondary}>
                {c.nodeCount} nodes, {c.edgeCount} edges
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, flexGrow: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  createButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: `${colors.modules.notes}33`,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
