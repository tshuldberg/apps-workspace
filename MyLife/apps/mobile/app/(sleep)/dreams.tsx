import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  Dream,
  DreamType,
} from '@mylife/sleep';
import {
  buildDreamTimelineSections,
  DREAM_EMOTION_OPTIONS,
  filterDreams,
  getDreamExcerpt,
  getDreamTypeMeta,
  listDreams,
  searchDreams,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  SLEEP_ACCENT,
  SLEEP_DREAM_TYPE_TONES,
  SleepPlaceholderScreen,
} from './_ui';

const DREAM_TYPES: DreamType[] = [
  'normal',
  'vivid',
  'nightmare',
  'lucid',
  'recurring',
];

const DREAM_LIMIT = 250;

interface DreamListSection {
  title: string;
  monthKey: string;
  data: Dream[];
}

function buildThemeOptions(dreams: Dream[]): string[] {
  const counts = new Map<string, number>();

  for (const dream of dreams) {
    for (const theme of dream.themes) {
      counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 8)
    .map(([theme]) => theme);
}

export default function SleepDreamsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [archiveDreams, setArchiveDreams] = useState<Dream[]>([]);
  const [visibleDreams, setVisibleDreams] = useState<Dream[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<DreamType | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [lucidOnly, setLucidOnly] = useState(false);
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(queryInput.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [queryInput]);

  const loadDreams = useCallback(() => {
    setIsLoading(true);
    try {
      const fullArchive = listDreams(db, { limit: DREAM_LIMIT });
      const rows = debouncedQuery
        ? searchDreams(db, debouncedQuery, {
            type: selectedType ?? undefined,
            limit: DREAM_LIMIT,
          })
        : listDreams(db, {
            type: selectedType ?? undefined,
            limit: DREAM_LIMIT,
          });

      setArchiveDreams(fullArchive);
      setVisibleDreams(
        filterDreams(rows, {
          type: selectedType,
          theme: selectedTheme,
          emotion: selectedEmotion,
          lucidOnly,
          recurringOnly,
        }),
      );
      setError(null);
    } catch (reason) {
      setArchiveDreams([]);
      setVisibleDreams([]);
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not load the dream archive.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    db,
    debouncedQuery,
    lucidOnly,
    recurringOnly,
    selectedEmotion,
    selectedTheme,
    selectedType,
  ]);

  useEffect(() => {
    loadDreams();
  }, [loadDreams]);

  useFocusEffect(
    useCallback(() => {
      loadDreams();
    }, [loadDreams]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadDreams();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDreams]);

  const themeOptions = useMemo(
    () => buildThemeOptions(archiveDreams),
    [archiveDreams],
  );

  const sections = useMemo<DreamListSection[]>(
    () =>
      buildDreamTimelineSections(visibleDreams).map((section) => ({
        title: section.label,
        monthKey: section.monthKey,
        data: section.dreams,
      })),
    [visibleDreams],
  );

  const hasActiveFilters = Boolean(
    queryInput.trim() ||
      selectedType ||
      selectedTheme ||
      selectedEmotion ||
      lucidOnly ||
      recurringOnly,
  );

  const latestDream = visibleDreams[0] ?? archiveDreams[0] ?? null;

  if (!isLoading && archiveDreams.length === 0 && !error) {
    return (
      <SleepPlaceholderScreen
        eyebrow="Dreams"
        title="Record your first dream"
        subtitle="Dream capture is optimized for the few minutes after waking, when the story is vivid and friction needs to stay near zero."
        cards={[
          {
            emoji: '✨',
            title: 'Fast capture',
            body: 'Write first, tag second. The morning flow keeps the text box front and center so you can save in seconds.',
          },
          {
            emoji: '🗂️',
            title: 'Searchable archive',
            body: 'Every dream can carry a type, themes, people, emotions, and recurring-thread links that stay searchable later.',
          },
          {
            emoji: '🌙',
            title: 'Linked nights',
            body: 'Dreams can attach to the sleep log that produced them so one night holds both the numbers and the memory.',
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
    <View style={styles.screen}>
      <SectionList<Dream, DreamListSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={SLEEP_ACCENT}
          />
        )}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>Dream Archive</Text>
              <Text style={styles.heroTitle}>
                Search the dreams that stayed with you.
              </Text>
              <Text style={styles.heroSubtitle}>
                Instant search uses the dream index, then the filters refine by type, theme, emotion, and recurring flags.
              </Text>

              <View style={styles.heroPillRow}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>
                    {visibleDreams.length} results
                  </Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>
                    {archiveDreams.length} loaded
                  </Text>
                </View>
              </View>

              <View style={styles.quickLinkRow}>
                <Pressable
                  onPress={() => router.push('/(sleep)/dream/patterns' as never)}
                  style={styles.quickLinkButton}
                >
                  <Text style={styles.quickLinkText}>Dream Patterns</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(sleep)/dream/dictionary' as never)}
                  style={styles.quickLinkButton}
                >
                  <Text style={styles.quickLinkText}>Dream Dictionary</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.searchShell}>
              <TextInput
                value={queryInput}
                onChangeText={setQueryInput}
                placeholder="Search dream content, themes, or people"
                placeholderTextColor={colors.textSecondary}
                style={styles.searchInput}
              />
              <Text style={styles.helperCopy}>
                Search updates after 300ms so results stay fast while you type.
              </Text>
            </View>

            <FilterGroup
              label="Type"
              options={DREAM_TYPES.map((type) => ({
                key: type,
                label: getDreamTypeMeta(type).label,
                selected: selectedType === type,
                onPress: () =>
                  setSelectedType((current) => (current === type ? null : type)),
              }))}
            />

            {themeOptions.length > 0 && (
              <FilterGroup
                label="Themes"
                options={themeOptions.map((theme) => ({
                  key: theme,
                  label: theme,
                  selected: selectedTheme === theme,
                  onPress: () =>
                    setSelectedTheme((current) =>
                      current === theme ? null : theme,
                    ),
                }))}
              />
            )}

            <FilterGroup
              label="Emotions"
              options={DREAM_EMOTION_OPTIONS.map((emotion) => ({
                key: emotion,
                label: emotion,
                selected: selectedEmotion === emotion,
                onPress: () =>
                  setSelectedEmotion((current) =>
                    current === emotion ? null : emotion,
                  ),
              }))}
            />

            <FilterGroup
              label="Focus"
              options={[
                {
                  key: 'lucid',
                  label: 'Lucid only',
                  selected: lucidOnly,
                  onPress: () => setLucidOnly((value) => !value),
                },
                {
                  key: 'recurring',
                  label: 'Recurring only',
                  selected: recurringOnly,
                  onPress: () => setRecurringOnly((value) => !value),
                },
              ]}
            />

            {hasActiveFilters && (
              <Pressable
                onPress={() => {
                  setQueryInput('');
                  setDebouncedQuery('');
                  setSelectedType(null);
                  setSelectedTheme(null);
                  setSelectedEmotion(null);
                  setLucidOnly(false);
                  setRecurringOnly(false);
                }}
                style={styles.resetButton}
              >
                <Text style={styles.resetButtonText}>Clear Filters</Text>
              </Pressable>
            )}

            {latestDream && !hasActiveFilters && (
              <Pressable
                onPress={() =>
                  router.push(`/(sleep)/dream/${latestDream.id}` as never)
                }
                style={styles.latestCard}
              >
                <View style={styles.latestHeader}>
                  <View style={styles.latestCopy}>
                    <Text style={styles.cardEyebrow}>Latest Dream</Text>
                    <Text style={styles.latestTitle}>{latestDream.date}</Text>
                  </View>
                  <DreamTypeBadge type={latestDream.type} />
                </View>
                <Text style={styles.latestExcerpt}>
                  {getDreamExcerpt(latestDream.content_md, 160)}
                </Text>
              </Pressable>
            )}

            {error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            {isLoading ? (
              <ActivityIndicator color={SLEEP_ACCENT} />
            ) : (
              <>
                <Text style={styles.emptyTitle}>No dreams match this view</Text>
                <Text style={styles.emptyBody}>
                  Try a different search or clear a few filters to widen the archive again.
                </Text>
              </>
            )}
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(sleep)/dream/${item.id}` as never)}
            style={styles.dreamCard}
          >
            <View style={styles.dreamCardHeader}>
              <View style={styles.dreamCardCopy}>
                <Text style={styles.dreamDate}>{item.date}</Text>
                <Text style={styles.dreamExcerpt}>
                  {getDreamExcerpt(item.content_md, 140)}
                </Text>
              </View>
              <DreamTypeBadge type={item.type} />
            </View>

            {item.themes.length > 0 && (
              <View style={styles.chipWrap}>
                {item.themes.slice(0, 3).map((theme) => (
                  <View key={`${item.id}-${theme}`} style={styles.themeChip}>
                    <Text style={styles.themeChipText}>{theme}</Text>
                  </View>
                ))}
              </View>
            )}

            {item.emotions.length > 0 && (
              <View style={styles.emotionRow}>
                {item.emotions.slice(0, 3).map((emotion) => (
                  <Text key={`${item.id}-${emotion}`} style={styles.emotionText}>
                    {emotion}
                  </Text>
                ))}
              </View>
            )}
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => router.push('/(sleep)/dream/log' as never)}
        style={styles.fab}
      >
        <Text style={styles.fabText}>Log Dream</Text>
      </Pressable>
    </View>
  );
}

function FilterGroup({
  label,
  options,
}: {
  label: string;
  options: Array<{
    key: string;
    label: string;
    selected: boolean;
    onPress: () => void;
  }>;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <Pressable
            key={option.key}
            onPress={option.onPress}
            style={[
              styles.filterChip,
              option.selected && styles.filterChipSelected,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                option.selected && styles.filterChipTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DreamTypeBadge({ type }: { type: DreamType }) {
  const meta = getDreamTypeMeta(type);
  const tone = SLEEP_DREAM_TYPE_TONES[meta.tone];

  return (
    <View
      style={[
        styles.typeBadge,
        {
          backgroundColor: tone.backgroundColor,
          borderColor: tone.borderColor,
        },
      ]}
    >
      <Text style={[styles.typeBadgeText, { color: tone.textColor }]}>
        {meta.label}
      </Text>
    </View>
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
    paddingBottom: 180,
    gap: 12,
  },
  headerContent: {
    gap: 16,
    marginBottom: 20,
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
  heroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,15,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  quickLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickLinkButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickLinkText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  searchShell: {
    gap: 8,
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
  helperCopy: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  filterGroup: {
    gap: 10,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: {
    backgroundColor: 'rgba(167,139,250,0.16)',
    borderColor: 'rgba(167,139,250,0.36)',
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: '#E9DDFF',
  },
  resetButton: {
    minHeight: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  latestCard: {
    gap: 12,
    padding: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  latestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  latestCopy: {
    flex: 1,
    gap: 6,
  },
  cardEyebrow: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  latestTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
  },
  latestExcerpt: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
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
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  sectionTitle: {
    marginBottom: 10,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dreamCard: {
    gap: 12,
    padding: 18,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  dreamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  dreamCardCopy: {
    flex: 1,
    gap: 6,
  },
  dreamDate: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  dreamExcerpt: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  themeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeChipText: {
    color: '#E9DDFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emotionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    minHeight: 56,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_ACCENT,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  fabText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
});
