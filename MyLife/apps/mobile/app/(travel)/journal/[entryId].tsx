import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  createJournalMemory,
  deleteJournalEntry,
  deleteJournalMemory,
  getJournalEntry,
  JournalMemoryKindSchema,
  listJournalMemories,
  reorderJournalMemories,
  updateJournalEntry,
  type JournalEntryRow,
  type JournalMemoryKind,
  type JournalMemoryRow,
} from '@mylife/travel';
import { useDatabase } from '../../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from '../_ui';

const MOOD_ICONS: Record<number, string> = {
  1: '\u{1F614}',
  2: '\u{1F615}',
  3: '\u{1F610}',
  4: '\u{1F642}',
  5: '\u{1F604}',
};

const KINDS: JournalMemoryKind[] = [
  'photo',
  'quote',
  'souvenir',
  'video',
  'audio',
  'other',
];

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function TravelJournalDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ entryId: string }>();
  const entryId = typeof params.entryId === 'string' ? params.entryId : '';

  const [status, setStatus] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<JournalEntryRow | null>(null);
  const [memories, setMemories] = useState<JournalMemoryRow[]>([]);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eTitle, setETitle] = useState('');
  const [eBody, setEBody] = useState('');
  const [eMood, setEMood] = useState<number | null>(null);
  const [eWeather, setEWeather] = useState('');
  const [eLocation, setELocation] = useState('');
  const [eDate, setEDate] = useState('');

  const [memKind, setMemKind] = useState<JournalMemoryKind>('photo');
  const [memRef, setMemRef] = useState('');
  const [memCaption, setMemCaption] = useState('');
  const [memSaving, setMemSaving] = useState(false);

  const load = useCallback(() => {
    if (!entryId) {
      setError('Missing entry id.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      const row = getJournalEntry(db, entryId);
      if (!row) {
        setError('Entry not found.');
        setStatus('error');
        return;
      }
      setEntry(row);
      setETitle(row.title ?? '');
      setEBody(row.body_md);
      setEMood(row.mood);
      setEWeather(row.weather ?? '');
      setELocation(row.location_label ?? '');
      setEDate(row.entry_date);
      setMemories(listJournalMemories(db, entryId));
      setStatus('ready');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entry');
      setStatus('error');
    }
  }, [db, entryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveEdits = async () => {
    if (!entry) return;
    const date = eDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD.');
      return;
    }
    setSaving(true);
    try {
      updateJournalEntry(db, entry.id, {
        entry_date: date,
        title: eTitle.trim() || null,
        body_md: eBody,
        mood: eMood,
        weather: eWeather.trim() || null,
        location_label: eLocation.trim() || null,
      });
      setEditing(false);
      load();
    } catch (e) {
      Alert.alert(
        'Could not save',
        e instanceof Error ? e.message : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!entry) return;
    Alert.alert('Delete entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteJournalEntry(db, entry.id);
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

  const addMemory = async () => {
    if (!entry) return;
    const parsed = JournalMemoryKindSchema.safeParse(memKind);
    if (!parsed.success) {
      Alert.alert('Pick a memory kind');
      return;
    }
    setMemSaving(true);
    try {
      createJournalMemory(db, {
        entry_id: entry.id,
        kind: parsed.data,
        media_ref: memRef.trim() || undefined,
        caption: memCaption.trim() || undefined,
      });
      setMemRef('');
      setMemCaption('');
      setMemKind('photo');
      setMemories(listJournalMemories(db, entry.id));
    } catch (e) {
      Alert.alert(
        'Could not add memory',
        e instanceof Error ? e.message : 'Unknown error',
      );
    } finally {
      setMemSaving(false);
    }
  };

  const removeMemory = (id: string) => {
    Alert.alert('Delete memory?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteJournalMemory(db, id);
            if (entry) setMemories(listJournalMemories(db, entry.id));
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

  const moveMemory = (index: number, dir: -1 | 1) => {
    if (!entry) return;
    const next = [...memories];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    try {
      reorderJournalMemories(
        db,
        next.map((m) => m.id),
      );
      setMemories(listJournalMemories(db, entry.id));
    } catch (e) {
      Alert.alert(
        'Could not reorder',
        e instanceof Error ? e.message : 'Unknown error',
      );
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={TRAVEL_ACCENT} />
        <Text style={styles.muted}>Loading entry...</Text>
      </View>
    );
  }

  if (status === 'error' || !entry) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Entry not available.'}</Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const paragraphs = entry.body_md.split('\n').filter((p) => p.trim().length > 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{entry.entry_date}</Text>
        <Text style={styles.title}>{entry.title || 'Untitled entry'}</Text>
        <View style={styles.metaRow}>
          {entry.mood != null ? (
            <Text style={styles.metaBadge}>{MOOD_ICONS[entry.mood] ?? ''}</Text>
          ) : null}
          {entry.weather ? (
            <Text style={styles.metaText}>{entry.weather}</Text>
          ) : null}
          {entry.location_label ? (
            <Text style={styles.metaText}>{entry.location_label}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => setEditing((v) => !v)}
        >
          <Text style={styles.secondaryBtnText}>
            {editing ? 'Cancel' : 'Edit'}
          </Text>
        </Pressable>
        <Pressable style={styles.dangerBtn} onPress={confirmDelete}>
          <Text style={styles.dangerBtnText}>Delete</Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Edit entry</Text>

          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            value={eDate}
            onChangeText={setEDate}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            value={eTitle}
            onChangeText={setETitle}
            style={styles.input}
            placeholder="Optional"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.fieldLabel}>Body</Text>
          <TextInput
            value={eBody}
            onChangeText={setEBody}
            style={[styles.input, styles.inputMultiline]}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>Mood</Text>
          <View style={styles.chipRow}>
            {[1, 2, 3, 4, 5].map((m) => (
              <Pressable
                key={m}
                style={[
                  styles.moodChip,
                  eMood === m ? styles.moodChipActive : null,
                ]}
                onPress={() => setEMood(eMood === m ? null : m)}
              >
                <Text style={styles.moodChipText}>{MOOD_ICONS[m]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Weather</Text>
          <TextInput
            value={eWeather}
            onChangeText={setEWeather}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.fieldLabel}>Location label</Text>
          <TextInput
            value={eLocation}
            onChangeText={setELocation}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />

          <Pressable
            style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]}
            onPress={saveEdits}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : 'Save changes'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Entry</Text>
          {paragraphs.length === 0 ? (
            <Text style={styles.muted}>No body yet.</Text>
          ) : (
            paragraphs.map((p, i) => (
              <Text key={`p-${i}`} style={styles.body}>
                {p}
              </Text>
            ))
          )}
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Memories</Text>
        {memories.length === 0 ? (
          <Text style={styles.muted}>
            No memories attached. Add a photo ref, quote, or souvenir.
          </Text>
        ) : (
          <View style={styles.memoryList}>
            {memories.map((m, idx) => (
              <View key={m.id} style={styles.memoryRow}>
                <Text style={styles.memoryKind}>{m.kind}</Text>
                <View style={styles.memoryMain}>
                  {m.media_ref ? (
                    <Text style={styles.memoryRef} numberOfLines={2}>
                      {m.media_ref}
                    </Text>
                  ) : null}
                  {m.caption ? (
                    <Text style={styles.memoryCaption} numberOfLines={3}>
                      {m.caption}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.memoryActions}>
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => moveMemory(idx, -1)}
                    accessibilityLabel="Move up"
                  >
                    <Text style={styles.smallBtnText}>{'\u2191'}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => moveMemory(idx, 1)}
                    accessibilityLabel="Move down"
                  >
                    <Text style={styles.smallBtnText}>{'\u2193'}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => removeMemory(m.id)}
                    accessibilityLabel="Delete memory"
                  >
                    <Text style={styles.smallBtnText}>{'\u2715'}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.fieldLabel}>Add memory</Text>
        <View style={styles.chipRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k}
              style={[
                styles.pickChip,
                memKind === k ? styles.pickChipActive : null,
              ]}
              onPress={() => setMemKind(k)}
            >
              <Text style={styles.pickChipText}>{k}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={memRef}
          onChangeText={setMemRef}
          style={styles.input}
          placeholder="Media ref (url, path, id)"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
        />
        <TextInput
          value={memCaption}
          onChangeText={setMemCaption}
          style={[styles.input, styles.inputMultiline]}
          placeholder="Caption"
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.saveBtn, memSaving ? styles.saveBtnDisabled : null]}
          onPress={addMemory}
          disabled={memSaving}
        >
          <Text style={styles.saveBtnText}>
            {memSaving ? 'Adding...' : 'Add memory'}
          </Text>
        </Pressable>
      </View>
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
    gap: 8,
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
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  metaRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  metaBadge: {
    fontSize: 20,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
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
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginTop: 4,
  },
  input: {
    backgroundColor: surfaceTiers.container,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 100 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  moodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moodChipActive: {
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderColor: TRAVEL_ACCENT,
  },
  moodChipText: { fontSize: 18 },
  pickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickChipActive: {
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderColor: TRAVEL_ACCENT,
  },
  pickChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: TRAVEL_ACCENT,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
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
  memoryList: { gap: 8 },
  memoryRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memoryKind: {
    color: TRAVEL_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    minWidth: 62,
  },
  memoryMain: { flex: 1, gap: 4 },
  memoryRef: { color: colors.text, fontSize: 13, fontWeight: '600' },
  memoryCaption: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  memoryActions: { flexDirection: 'row', gap: 4 },
  smallBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.low,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
