import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getNotes,
  getNotesStats,
  getChecklistProgress,
  type Note,
} from '@mylife/notes';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { ChecklistProgressBadge } from '../../components/notes/ChecklistItem';
import { useDatabase } from '../../components/DatabaseProvider';

export default function NotesHomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tick] = useState(0);

  const notes = useMemo(() => getNotes(db, { limit: 20 }), [db, tick]);
  const pinnedNotes = useMemo(() => getNotes(db, { isPinned: true, limit: 8 }), [db, tick]);
  const stats = useMemo(() => getNotesStats(db), [db, tick]);

  const accentColor = colors.modules.notes;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Text variant="heading">Notes</Text>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            <ScrollView bounces={false}>
              {[
                { label: 'New Note', route: '/(notes)/note-editor' },
                { label: 'Daily', route: '/(notes)/daily' },
                { label: 'Folders', route: '/(notes)/folders' },
                { label: 'Search', route: '/(notes)/search' },
                { label: 'Templates', route: '/(notes)/templates' },
                { label: 'Graph', route: '/(notes)/graph' },
                { label: 'Canvas', route: '/(notes)/canvas-list' },
                { label: 'Databases', route: '/(notes)/databases' },
                { label: 'Plugins', route: '/(notes)/plugins' },
                { label: 'Web Clipper', route: '/(notes)/clipper' },
                { label: 'Discovery', route: '/(notes)/discovery' },
                { label: 'Analytics', route: '/(notes)/analytics' },
                { label: 'AI Assistant', route: '/(notes)/ai-assistant' },
                { label: 'Settings', route: '/(notes)/settings' },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={styles.menuItem}
                  onPress={() => { setMenuOpen(false); router.push(item.route as never); }}
                >
                  <Text variant="body" color={colors.text}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.metricsGrid}>
        <Metric label="Notes" value={String(stats.totalNotes)} accent={accentColor} />
        <Metric label="Folders" value={String(stats.totalFolders)} accent={accentColor} />
        <Metric label="Tags" value={String(stats.totalTags)} accent={accentColor} />
        <Metric label="Words" value={stats.totalWords > 999 ? `${(stats.totalWords / 1000).toFixed(1)}k` : String(stats.totalWords)} accent={accentColor} />
      </View>

      <Card>
        <Text variant="subheading">Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickAction label="New Note" icon="✍️" onPress={() => router.push('/(notes)/note-editor')} />
          <QuickAction label="Daily" icon="📅" onPress={() => router.push('/(notes)/daily')} />
          <QuickAction label="Search" icon="🔎" onPress={() => router.push('/(notes)/search')} />
        </View>
      </Card>

      {pinnedNotes.length > 0 ? (
        <Card>
          <Text variant="subheading">Pinned Notes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinnedRow}>
            {pinnedNotes.map((note) => (
              <Pressable key={note.id} onPress={() => router.push(`/(notes)/note-editor?id=${note.id}`)}>
                <Card style={styles.pinnedCard}>
                  <Text variant="body" numberOfLines={1}>{note.title || 'Untitled'}</Text>
                  <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
                    {note.body.slice(0, 96).replace(/\n/g, ' ') || 'Pinned note'}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        </Card>
      ) : null}

      <Card>
        <Text variant="subheading">Recent Notes</Text>
        <View style={styles.list}>
          {notes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="body" color={colors.textSecondary}>
                No notes yet. Tap New Note to create one!
              </Text>
            </View>
          ) : (
            notes.map((note) => (
              <NoteRow key={note.id} note={note} onPress={() => router.push(`/(notes)/note-editor?id=${note.id}`)} />
            ))
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

function NoteRow({ note, onPress }: { note: Note; onPress: () => void }) {
  const preview = note.body.slice(0, 80).replace(/\n/g, ' ');
  const progress = getChecklistProgress(note.body);
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.innerCard}>
        <View style={styles.rowBetween}>
          <View style={styles.mainCopy}>
            <View style={styles.titleRow}>
              {note.isPinned && <Text variant="caption" color={colors.modules.notes}>pin</Text>}
              <Text variant="body" numberOfLines={1}>{note.title || 'Untitled'}</Text>
            </View>
            <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
              {preview || 'Empty note'}
            </Text>
          </View>
          <View style={styles.rightMeta}>
            {progress && <ChecklistProgressBadge checked={progress.checked} total={progress.total} />}
            <Text variant="caption" color={colors.textTertiary}>
              {note.wordCount}w
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <Card style={styles.metricCard}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
    </Card>
  );
}

function QuickAction({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickActionCard} onPress={onPress}>
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text variant="caption" color={colors.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  menuItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { flex: 1, minWidth: 75, gap: spacing.xs },
  metricValue: { fontSize: 22, fontWeight: '700' },
  quickActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  quickActionIcon: { fontSize: 20 },
  pinnedRow: { gap: spacing.sm, paddingTop: spacing.sm },
  pinnedCard: {
    width: 220,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.glassBorder,
    gap: spacing.xs,
  },
  list: { marginTop: spacing.sm },
  innerCard: { marginBottom: spacing.sm, backgroundColor: colors.surfaceElevated },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  mainCopy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rightMeta: { alignItems: 'flex-end', gap: 2 },
  emptyState: { paddingVertical: spacing.lg, alignItems: 'center' },
});
