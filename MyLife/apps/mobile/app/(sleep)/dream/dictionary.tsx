import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getDreamDictionary,
  getDreamDictionaryNotes,
  listAllDreams,
  searchDreamDictionary,
  setDreamDictionaryNote,
  sortDreamDictionary,
} from '@mylife/sleep';
import type {
  Dream,
  DreamDictionaryNotesMap,
  DreamDictionarySort,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  SLEEP_ACCENT,
  SleepPlaceholderScreen,
} from '../_ui';

const SORT_OPTIONS: DreamDictionarySort[] = [
  'frequency',
  'recency',
  'alphabetical',
];

export default function SleepDreamDictionaryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [notes, setNotes] = useState<DreamDictionaryNotesMap>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DreamDictionarySort>('frequency');
  const [savingTheme, setSavingTheme] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDictionary = useCallback(() => {
    setIsLoading(true);
    try {
      const nextDreams = listAllDreams(db);
      const nextNotes = getDreamDictionaryNotes(db);
      setDreams(nextDreams);
      setNotes(nextNotes);
      setDraftNotes(nextNotes);
      setError(null);
    } catch (reason) {
      setDreams([]);
      setNotes({});
      setDraftNotes({});
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not load the dream dictionary.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadDictionary();
    }, [loadDictionary]),
  );

  const entries = useMemo(() => {
    const dictionary = getDreamDictionary(dreams, notes);
    return sortDreamDictionary(searchDreamDictionary(dictionary, query), sort);
  }, [dreams, notes, query, sort]);

  if (!isLoading && !error && dreams.length === 0) {
    return (
      <SleepPlaceholderScreen
        eyebrow="Dream Dictionary"
        title="The dictionary builds from saved themes"
        subtitle="Log a few dreams with theme tags and this screen will start collecting recurring symbols, emotions, and personal notes."
        cards={[
          {
            emoji: '🗂️',
            title: 'Auto-built entries',
            body: 'Each theme becomes a private reference entry with counts, date range, and example excerpts.',
          },
          {
            emoji: '✍️',
            title: 'Personal notes',
            body: 'Add your own interpretation of what a theme usually means in your dreams.',
          },
          {
            emoji: '🔎',
            title: 'Searchable and sortable',
            body: 'Search across themes, emotions, notes, and excerpts, then sort by frequency, recency, or alphabetically.',
          },
        ]}
        footer={(
          <Pressable
            onPress={() => router.push('/(sleep)/dream/log' as never)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Log Dream</Text>
          </Pressable>
        )}
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Dream Dictionary</Text>
        <Text style={styles.heroTitle}>
          Build a private symbol library from your own archive.
        </Text>
        <Text style={styles.heroSubtitle}>
          Each entry comes from logged themes, then your own notes make the meaning personal.
        </Text>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => router.push('/(sleep)/dream/patterns' as never)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Dream Patterns</Text>
          </Pressable>
          <View style={styles.statPill}>
            <Text style={styles.statPillText}>{entries.length} themes</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchCard}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search themes, notes, emotions, or excerpts"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
        />
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setSort(option)}
              style={[
                styles.sortChip,
                sort === option && styles.sortChipActive,
              ]}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sort === option && styles.sortChipTextActive,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={SLEEP_ACCENT} />
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <View style={styles.entryList}>
          {entries.map((entry) => {
            const draftValue = draftNotes[entry.theme] ?? entry.note ?? '';
            const savedValue = notes[entry.theme] ?? '';
            const isSaving = savingTheme === entry.theme;
            const isDirty = draftValue !== savedValue;

            return (
              <View key={entry.theme} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View style={styles.entryCopy}>
                    <Text style={styles.entryEyebrow}>Theme</Text>
                    <Text style={styles.entryTitle}>{entry.theme}</Text>
                  </View>
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>
                      {entry.count} dreams
                    </Text>
                  </View>
                </View>

                <View style={styles.metaGrid}>
                  <View style={styles.metaBlock}>
                    <Text style={styles.metaLabel}>First logged</Text>
                    <Text style={styles.metaValue}>{entry.firstOccurrence}</Text>
                  </View>
                  <View style={styles.metaBlock}>
                    <Text style={styles.metaLabel}>Last logged</Text>
                    <Text style={styles.metaValue}>{entry.lastOccurrence}</Text>
                  </View>
                </View>

                <View style={styles.chipWrap}>
                  {entry.emotionCounts.map((emotion) => (
                    <View
                      key={`${entry.theme}-${emotion.emotion}`}
                      style={styles.emotionChip}
                    >
                      <Text style={styles.emotionChipText}>
                        {emotion.emotion} · {emotion.count}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.excerptList}>
                  {entry.exampleExcerpts.map((excerpt) => (
                    <Text
                      key={`${entry.theme}-${excerpt}`}
                      style={styles.excerptCard}
                    >
                      {excerpt}
                    </Text>
                  ))}
                </View>

                <Text style={styles.noteLabel}>Your interpretation</Text>
                <TextInput
                  value={draftValue}
                  onChangeText={(value) =>
                    setDraftNotes((current) => ({
                      ...current,
                      [entry.theme]: value,
                    }))
                  }
                  placeholder={`What does ${entry.theme} usually mean in your dreams?`}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  style={styles.noteInput}
                  textAlignVertical="top"
                />

                <View style={styles.entryActions}>
                  <Pressable
                    disabled={!isDirty || isSaving}
                    onPress={() => {
                      setSavingTheme(entry.theme);
                      setError(null);

                      try {
                        const nextNotes = setDreamDictionaryNote(
                          db,
                          entry.theme,
                          draftValue,
                        );
                        setNotes(nextNotes);
                        setDraftNotes((current) => ({
                          ...current,
                          [entry.theme]: nextNotes[entry.theme] ?? '',
                        }));
                      } catch (reason) {
                        setError(
                          reason instanceof Error
                            ? reason.message
                            : 'Could not save that dictionary note.',
                        );
                      } finally {
                        setSavingTheme(null);
                      }
                    }}
                    style={[
                      styles.saveButton,
                      (!isDirty || isSaving) && styles.saveButtonDisabled,
                    ]}
                  >
                    <Text style={styles.saveButtonText}>
                      {isSaving
                        ? 'Saving...'
                        : draftValue.trim()
                          ? 'Save Note'
                          : 'Clear Note'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      router.push(`/(sleep)/dream/${entry.latestDreamId}` as never)
                    }
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Latest Dream</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  hero: {
    gap: 12,
    padding: 22,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.24)',
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statPill: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  searchCard: {
    gap: 10,
    padding: 18,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: 'rgba(167,139,250,0.16)',
    borderColor: 'rgba(167,139,250,0.36)',
  },
  sortChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sortChipTextActive: {
    color: '#E9DDFF',
  },
  loadingCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.28)',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  entryList: {
    gap: 12,
  },
  entryCard: {
    gap: 14,
    padding: 20,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  entryCopy: {
    flex: 1,
    gap: 6,
  },
  entryEyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  entryTitle: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  countPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaBlock: {
    minWidth: '47%',
    gap: 6,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emotionChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  excerptList: {
    gap: 8,
  },
  excerptCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.1)',
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  noteLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  noteInput: {
    minHeight: 110,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  entryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  saveButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.36)',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: '#E9DDFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
