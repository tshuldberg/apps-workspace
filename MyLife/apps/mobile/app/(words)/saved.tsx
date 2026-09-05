import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing, glass, EmptyState } from '@mylife/ui';
import { useSavedWords, useWordLists } from '../../hooks/words';
import type { SavedWordSortBy } from '@mylife/words';
import type { SavedWordLight } from '@mylife/words';

const WORDS_ACCENT = colors.modules.words;
const PAGE_SIZE = 50;

type MasteryFilter = 'all' | 'favorites' | 'new' | 'learning' | 'known';

function computeMastery(
  lookedUpCount: number,
  lastLookedUpAt: string,
): { level: 'new' | 'learning' | 'familiar'; color: string } {
  const daysSince = Math.floor(
    (Date.now() - new Date(lastLookedUpAt).getTime()) / 86400000,
  );
  if (lookedUpCount <= 1) return { level: 'new', color: colors.danger };
  if (lookedUpCount <= 5 || daysSince > 30)
    return { level: 'learning', color: colors.warning };
  return { level: 'familiar', color: colors.success };
}

const SORT_OPTIONS: Array<{ key: SavedWordSortBy; label: string }> = [
  { key: 'recent', label: 'Recent' },
  { key: 'alphabetical', label: 'A-Z' },
  { key: 'mostLookedUp', label: 'Lookups' },
  { key: 'mastery', label: 'Mastery' },
];

export default function SavedWordsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<SavedWordSortBy>('recent');
  const [activeFilter, setActiveFilter] = useState<MasteryFilter>('all');
  const [languageFilter, setLanguageFilter] = useState<string | undefined>(
    undefined,
  );

  const filterOptions = useMemo(() => {
    const favoritesOnly = activeFilter === 'favorites' || undefined;
    const masteryRange =
      activeFilter === 'new'
        ? { masteryMin: 0, masteryMax: 1 }
        : activeFilter === 'learning'
          ? { masteryMin: 2, masteryMax: 3 }
          : activeFilter === 'known'
            ? { masteryMin: 4, masteryMax: 5 }
            : {};

    return {
      sortBy,
      search: searchText || undefined,
      favoritesOnly: favoritesOnly ? true : undefined,
      languageCode: languageFilter,
      limit: PAGE_SIZE,
      offset: 0,
      ...masteryRange,
    };
  }, [sortBy, searchText, activeFilter, languageFilter]);

  const {
    words,
    loading,
    totalCount,
    languageCounts,
    refresh,
    loadMore,
    toggleFavorite,
    remove,
  } = useSavedWords(filterOptions);

  const { lists } = useWordLists();

  const favCount = useMemo(
    () => words.filter((w) => w.isFavorite).length,
    [words],
  );
  const flashCount = useMemo(
    () => words.filter((w) => w.flashCardId).length,
    [words],
  );

  const handleDelete = useCallback(
    (id: string, word: string) => {
      Alert.alert(
        'Remove Word',
        `Remove "${word}" from your saved words?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => remove(id),
          },
        ],
      );
    },
    [remove],
  );

  const handleLoadMore = useCallback(() => {
    if (words.length >= PAGE_SIZE && words.length % PAGE_SIZE === 0) {
      loadMore(words.length);
    }
  }, [words.length, loadMore]);

  const renderItem = useCallback(
    ({ item }: { item: SavedWordLight }) => {
      const mastery = computeMastery(item.lookedUpCount, item.lastLookedUpAt);
      return (
        <Pressable
          style={styles.wordRow}
          onPress={() => router.push(`/saved/${item.id}` as never)}
          android_ripple={{ color: 'rgba(255,255,255,0.05)' }}
        >
          <View style={styles.wordRowMain}>
            <View style={styles.wordRowTop}>
              <Text variant="body" style={styles.wordText}>
                {item.word}
              </Text>
              <View style={styles.langBadge}>
                <Text variant="caption" color={colors.textSecondary}>
                  {item.languageCode.toUpperCase()}
                </Text>
              </View>
              {item.partOfSpeech ? (
                <View style={styles.posPill}>
                  <Text
                    variant="caption"
                    color={WORDS_ACCENT}
                    style={styles.posPillText}
                  >
                    {item.partOfSpeech}
                  </Text>
                </View>
              ) : null}
            </View>
            {item.definitionSummary ? (
              <Text
                variant="caption"
                color={colors.textSecondary}
                numberOfLines={1}
              >
                {item.definitionSummary}
              </Text>
            ) : null}
            <View style={styles.wordRowBottom}>
              <View
                style={[styles.masteryDot, { backgroundColor: mastery.color }]}
              />
              <Pressable
                onPress={() => toggleFavorite(item.id, item.isFavorite)}
                hitSlop={8}
                style={styles.iconButton}
              >
                <Text
                  variant="caption"
                  style={{ fontSize: 16, opacity: item.isFavorite ? 1 : 0.4 }}
                >
                  {item.isFavorite ? '\u2764\uFE0F' : '\u2661'}
                </Text>
              </Pressable>
              {item.flashCardId ? (
                <Text variant="caption" style={{ fontSize: 14, opacity: 0.6 }}>
                  {'\u26A1'}
                </Text>
              ) : null}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => handleDelete(item.id, item.word)}
                hitSlop={8}
                style={styles.iconButton}
              >
                <Text variant="caption" color={colors.danger} style={{ fontSize: 16 }}>
                  {'\uD83D\uDDD1'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      );
    },
    [router, toggleFavorite, handleDelete],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerContainer}>
        {/* Stats Bar */}
        <View style={[styles.statsBar, glass.dock]}>
          <View style={styles.stat}>
            <Text variant="body" style={styles.statNumber}>
              {totalCount}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              Saved
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="body" style={styles.statNumber}>
              {'\u2764\uFE0F'} {favCount}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              Favorites
            </Text>
          </View>
          <Pressable
            style={styles.stat}
            onPress={() => {
              /* lists bottom sheet -- future */
            }}
          >
            <Text variant="body" style={styles.statNumber}>
              {'\uD83D\uDCC1'} {lists.length}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              Lists
            </Text>
          </Pressable>
          <View style={styles.stat}>
            <Text variant="body" style={styles.statNumber}>
              {'\u26A1'} {flashCount}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              Flash
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search saved words..."
            placeholderTextColor={colors.textTertiary}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Sort */}
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => {
            const active = opt.key === sortBy;
            return (
              <Pressable
                key={opt.key}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => setSortBy(opt.key)}
              >
                <Text
                  variant="caption"
                  color={active ? colors.background : colors.textSecondary}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'favorites', label: 'Favorites' },
              ...languageCounts.map((lc) => ({
                key: `lang:${lc.languageCode}`,
                label: `${lc.languageCode.toUpperCase()} (${lc.count})`,
              })),
              { key: 'new', label: 'New 0-1' },
              { key: 'learning', label: 'Learning 2-3' },
              { key: 'known', label: 'Known 4-5' },
            ] as Array<{ key: string; label: string }>
          ).map((chip) => {
            const isLang = chip.key.startsWith('lang:');
            const isActive = isLang
              ? languageFilter === chip.key.replace('lang:', '')
              : activeFilter === chip.key && !languageFilter;

            return (
              <Pressable
                key={chip.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => {
                  if (isLang) {
                    const code = chip.key.replace('lang:', '');
                    setLanguageFilter(
                      languageFilter === code ? undefined : code,
                    );
                    setActiveFilter('all');
                  } else {
                    setLanguageFilter(undefined);
                    setActiveFilter(chip.key as MasteryFilter);
                  }
                }}
              >
                <Text
                  variant="caption"
                  color={isActive ? colors.background : colors.textSecondary}
                  style={{ fontSize: 12 }}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ),
    [
      totalCount,
      favCount,
      lists.length,
      flashCount,
      searchText,
      sortBy,
      activeFilter,
      languageFilter,
      languageCounts,
    ],
  );

  const emptyComponent = useMemo(
    () =>
      !loading ? (
        <EmptyState
          icon={'\uD83D\uDD0D'}
          title="Your vocabulary starts here"
          message="Look up words and tap the bookmark to save them"
          actionLabel="Start looking up words"
          onAction={() => router.push('/(words)/' as never)}
          accentColor={WORDS_ACCENT}
        />
      ) : null,
    [loading, router],
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={words}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
        stickyHeaderIndices={[0]}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={loading}
        onRefresh={refresh}
      />

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(words)/' as never)}
      >
        <Text variant="body" color={colors.background} style={styles.fabText}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: spacing.xxl + 60,
  },
  headerContainer: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 14,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sortChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  sortChipActive: {
    borderColor: WORDS_ACCENT,
    backgroundColor: WORDS_ACCENT,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: WORDS_ACCENT,
    backgroundColor: WORDS_ACCENT,
  },
  wordRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  wordRowMain: {
    flex: 1,
    gap: 3,
  },
  wordRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordText: {
    fontWeight: '600',
  },
  langBadge: {
    backgroundColor: colors.glass,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  posPill: {
    borderWidth: 1,
    borderColor: `${WORDS_ACCENT}40`,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  posPillText: {
    fontSize: 10,
  },
  wordRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  masteryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconButton: {
    minHeight: 44,
    minWidth: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WORDS_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },
});
