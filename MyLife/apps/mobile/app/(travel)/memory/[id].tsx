import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  deleteJournalMemory,
  getJournalEntry,
  type JournalEntryRow,
  type JournalMemoryKind,
  type JournalMemoryRow,
} from '@mylife/travel';
import { useDatabase } from '../../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from '../_ui';

const KIND_ICONS: Record<JournalMemoryKind, string> = {
  photo: '\u{1F4F7}',
  quote: '\u{1F4AC}',
  souvenir: '\u{1F381}',
  video: '\u{1F3A5}',
  audio: '\u{1F3A7}',
  other: '\u{2728}',
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function MemoryDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [status, setStatus] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [memory, setMemory] = useState<JournalMemoryRow | null>(null);
  const [entry, setEntry] = useState<JournalEntryRow | null>(null);

  const load = useCallback(() => {
    if (!id) {
      setError('Missing memory id.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      const rows = db.query<JournalMemoryRow>(
        `SELECT * FROM tv_journal_memories WHERE id = ?`,
        [id],
      );
      const mem = rows[0] ?? null;
      if (!mem) {
        setError('Memory not found.');
        setStatus('error');
        return;
      }
      setMemory(mem);
      setEntry(getJournalEntry(db, mem.entry_id));
      setError(null);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load memory');
      setStatus('error');
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = () => {
    if (!memory) return;
    Alert.alert('Delete memory?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteJournalMemory(db, memory.id);
            router.back();
          } catch (e) {
            Alert.alert(
              'Could not delete',
              e instanceof Error ? e.message : 'Unknown error',
            );
          }
        },
      },
    ]);
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={TRAVEL_ACCENT} />
        <Text style={styles.muted}>Loading memory...</Text>
      </View>
    );
  }

  if (status === 'error' || !memory) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Memory not available.'}</Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          {KIND_ICONS[memory.kind]} {memory.kind}
        </Text>
        <Text style={styles.title}>
          {memory.caption || memory.media_ref || 'Untitled memory'}
        </Text>
        {entry ? (
          <Text style={styles.metaText}>
            from entry on {entry.entry_date}
            {entry.title ? ` · ${entry.title}` : ''}
          </Text>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() =>
            router.push(`/(travel)/memory/${memory.id}/edit` as never)
          }
        >
          <Text style={styles.secondaryBtnText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.dangerBtn} onPress={confirmDelete}>
          <Text style={styles.dangerBtnText}>Delete</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.kv}>
          <Text style={styles.kvLabel}>Kind</Text>
          <Text style={styles.kvValue}>{memory.kind}</Text>
        </View>
        {memory.media_ref ? (
          <View style={styles.kv}>
            <Text style={styles.kvLabel}>Media</Text>
            <Text style={styles.kvValue} selectable>
              {memory.media_ref}
            </Text>
          </View>
        ) : null}
        {memory.caption ? (
          <View style={styles.kv}>
            <Text style={styles.kvLabel}>Caption</Text>
            <Text style={styles.kvValue} selectable>
              {memory.caption}
            </Text>
          </View>
        ) : null}
        <View style={styles.kv}>
          <Text style={styles.kvLabel}>Created</Text>
          <Text style={styles.kvValue}>
            {memory.created_at.slice(0, 10)}
          </Text>
        </View>
      </View>

      {entry ? (
        <Pressable
          style={styles.linkBtn}
          onPress={() =>
            router.push(`/(travel)/journal/${entry.id}` as never)
          }
        >
          <Text style={styles.linkBtnText}>Open parent entry</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: surfaceTiers.lowest,
    padding: 20,
  },
  hero: {
    gap: 6,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  dangerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93000A',
    backgroundColor: 'rgba(147,0,10,0.24)',
    alignItems: 'center',
  },
  dangerBtnText: { color: '#FFB4AB', fontSize: 14, fontWeight: '700' },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  kv: { gap: 4 },
  kvLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  kvValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  linkBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
    alignItems: 'center',
  },
  linkBtnText: {
    color: TRAVEL_ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  errorText: { color: '#FFB4AB', fontSize: 14, lineHeight: 20 },
  retryBtn: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
  },
  retryText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
