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
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  createJournalMemory,
  listJournalEntries,
  type JournalEntryRow,
  type JournalMemoryKind,
} from '@mylife/travel';
import { useDatabase } from '../../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from '../_ui';

const KINDS: JournalMemoryKind[] = [
  'photo',
  'quote',
  'souvenir',
  'video',
  'audio',
  'other',
];

const KIND_ICONS: Record<JournalMemoryKind, string> = {
  photo: '\u{1F4F7}',
  quote: '\u{1F4AC}',
  souvenir: '\u{1F381}',
  video: '\u{1F3A5}',
  audio: '\u{1F3A7}',
  other: '\u{2728}',
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function NewMemoryScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [status, setStatus] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);

  const [entryId, setEntryId] = useState<string | null>(null);
  const [kind, setKind] = useState<JournalMemoryKind>('photo');
  const [mediaRef, setMediaRef] = useState('');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setStatus('loading');
    try {
      const rows = listJournalEntries(db, {});
      setEntries(rows);
      if (rows.length > 0 && !entryId) {
        setEntryId(rows[0]!.id);
      }
      setError(null);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entries');
      setStatus('error');
    }
  }, [db, entryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const submit = async () => {
    if (!entryId) {
      Alert.alert('Pick an entry', 'Memories must be attached to an entry.');
      return;
    }
    setSaving(true);
    try {
      const created = createJournalMemory(db, {
        entry_id: entryId,
        kind,
        media_ref: mediaRef.trim() || undefined,
        caption: caption.trim() || undefined,
      });
      router.replace(`/(travel)/memory/${created.id}` as never);
    } catch (e) {
      Alert.alert(
        'Could not save memory',
        e instanceof Error ? e.message : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={TRAVEL_ACCENT} />
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {error ?? 'Something went wrong.'}
        </Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Memories</Text>
          <Text style={styles.title}>Add memory</Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>No entries yet</Text>
          <Text style={styles.muted}>
            Memories attach to journal entries. Create an entry first, then
            come back here to add a memory.
          </Text>
          <Pressable
            style={styles.saveBtn}
            onPress={() => router.replace('/(travel)/journal' as never)}
          >
            <Text style={styles.saveBtnText}>Go to Journal</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Memories</Text>
        <Text style={styles.title}>Add memory</Text>
        <Text style={styles.subtitle}>
          Attach a photo, quote, souvenir, or other highlight to a journal
          entry.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.fieldLabel}>Kind</Text>
        <View style={styles.chipRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k}
              style={[
                styles.pickChip,
                kind === k ? styles.pickChipActive : null,
              ]}
              onPress={() => setKind(k)}
            >
              <Text style={styles.pickChipText}>
                {KIND_ICONS[k]} {k}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Entry</Text>
        <View style={styles.chipRow}>
          {entries.slice(0, 40).map((e) => {
            const label = e.title || e.entry_date;
            return (
              <Pressable
                key={e.id}
                style={[
                  styles.pickChip,
                  entryId === e.id ? styles.pickChipActive : null,
                ]}
                onPress={() => setEntryId(e.id)}
              >
                <Text style={styles.pickChipText} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Media ref (optional)</Text>
        <TextInput
          value={mediaRef}
          onChangeText={setMediaRef}
          style={styles.input}
          placeholder="url, file path, or id"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.fieldLabel}>Caption (optional)</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          style={[styles.input, styles.inputMultiline]}
          placeholder="A short caption..."
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]}
          onPress={submit}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : 'Save memory'}
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
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginTop: 4,
  },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 200,
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
  saveBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: TRAVEL_ACCENT,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
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
