import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  countRecipes,
  getRecipes,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
  type Difficulty,
  type Recipe,
} from '@mylife/bestchef';
import { FilterChip } from '@mylife/bestchef/ui';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Text,
  colors,
  spacing,
  surfaceTiers,
} from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.recipes;
const COLUMN_GAP = spacing.sm;
const HORIZONTAL_PAD = spacing.md;

type ViewMode = 'grid' | 'list';
type SortMode = 'newest' | 'alphabetical' | 'cookTime' | 'rating';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const CUISINES = ['italian', 'mexican', 'asian'] as const;
const DIETARY = ['vegan', 'keto'] as const;

type Cuisine = (typeof CUISINES)[number];
type Dietary = (typeof DIETARY)[number];

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: '#22C55E',
  medium: '#FB923C',
  hard: '#EF4444',
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
};

function formatCookTime(mins: number | null | undefined): string | undefined {
  if (mins == null || mins <= 0) return undefined;
  if (mins >= 60) {
    const hours = mins / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
  return `${mins}m`;
}

function getRecipeIdsForTag(db: ReturnType<typeof useDatabase>, tag: string): Set<string> {
  const rows = db.query<{ recipe_id: string }>(
    `SELECT recipe_id FROM rc_recipe_tags WHERE LOWER(tag) = ?`,
    [tag.toLowerCase()],
  );
  return new Set(rows.map((r) => r.recipe_id));
}

export default function RecipesTabScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortMode>('newest');
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty | null>(null);
  const [activeCuisine, setActiveCuisine] = useState<Cuisine | null>(null);
  const [activeDietary, setActiveDietary] = useState<Dietary | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const filters: Parameters<typeof getRecipes>[1] = { limit: 200 };
      if (search.trim()) filters.search = search.trim();
      if (activeDifficulty) filters.difficulty = activeDifficulty;

      let result = getRecipes(db, filters);

      if (activeCuisine) {
        const ids = getRecipeIdsForTag(db, activeCuisine);
        result = result.filter((r) => ids.has(r.id));
      }
      if (activeDietary) {
        const ids = getRecipeIdsForTag(db, activeDietary);
        result = result.filter((r) => ids.has(r.id));
      }

      switch (sort) {
        case 'alphabetical':
          result = [...result].sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'cookTime':
          result = [...result].sort(
            (a, b) => (a.total_time_mins ?? Infinity) - (b.total_time_mins ?? Infinity),
          );
          break;
        case 'rating':
          result = [...result].sort((a, b) => b.rating - a.rating);
          break;
        case 'newest':
        default:
          break;
      }

      setRecipes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, search, activeDifficulty, activeCuisine, activeDietary, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(() => countRecipes(db), [db, recipes.length]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      {/* Search Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Text style={styles.searchIcon}>{'\u{1F50D}'}</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search recipes..."
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
          />
        </View>
        <View style={styles.viewToggle}>
          <Pressable
            onPress={() => setViewMode('grid')}
            style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]}
            accessibilityLabel="Grid view"
          >
            <Text style={[styles.toggleIcon, viewMode === 'grid' && styles.toggleIconActive]}>
              {'\u25A6'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('list')}
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            accessibilityLabel="List view"
          >
            <Text style={[styles.toggleIcon, viewMode === 'list' && styles.toggleIconActive]}>
              {'\u2630'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Difficulty filter row -- inline chips with colored dots */}
      <View style={styles.filterRowWrap}>
        <Text style={styles.filterLabel}>DIFFICULTY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {DIFFICULTIES.map((d) => {
            const isActive = activeDifficulty === d;
            const accent = DIFFICULTY_COLOR[d];
            return (
              <Pressable
                key={d}
                onPress={() =>
                  setActiveDifficulty((cur) => (cur === d ? null : d))
                }
                style={[
                  styles.difficultyChip,
                  isActive && {
                    backgroundColor: `${accent}26`,
                    shadowColor: accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 6,
                  },
                ]}
              >
                <View
                  style={[styles.difficultyChipDot, { backgroundColor: accent }]}
                />
                <Text
                  style={[
                    styles.difficultyChipText,
                    isActive && { color: accent, fontWeight: '700' },
                  ]}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Cuisine filter row -- shared FilterChip */}
      <View style={styles.filterRowWrap}>
        <Text style={styles.filterLabel}>CUISINE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {CUISINES.map((c) => (
            <FilterChip
              key={c}
              label={c.charAt(0).toUpperCase() + c.slice(1)}
              selected={activeCuisine === c}
              onPress={() => setActiveCuisine((cur) => (cur === c ? null : c))}
            />
          ))}
        </ScrollView>
      </View>

      {/* Dietary filter row -- shared FilterChip */}
      <View style={styles.filterRowWrap}>
        <Text style={styles.filterLabel}>DIETARY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {DIETARY.map((d) => (
            <FilterChip
              key={d}
              label={d.charAt(0).toUpperCase() + d.slice(1)}
              selected={activeDietary === d}
              onPress={() => setActiveDietary((cur) => (cur === d ? null : d))}
            />
          ))}
        </ScrollView>
      </View>

      {/* Sort + Count */}
      <View style={styles.metaRow}>
        <Text variant="caption" color={colors.textSecondary}>
          {recipes.length} of {total}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
        >
          {(
            [
              ['newest', 'Newest'],
              ['alphabetical', 'A-Z'],
              ['cookTime', 'Cook Time'],
              ['rating', 'Rating'],
            ] as [SortMode, string][]
          ).map(([key, label]) => {
            const active = sort === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSort(key)}
                style={[styles.sortChip, active && styles.sortChipActive]}
              >
                <Text
                  style={[styles.sortChipText, active && styles.sortChipTextActive]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  const renderGridItem = ({ item, index }: { item: Recipe; index: number }) => {
    const difficulty = item.difficulty ?? 'easy';
    const cookTime = formatCookTime(item.total_time_mins ?? item.cook_time_mins);
    const accent = DIFFICULTY_COLOR[difficulty];
    return (
      <Pressable
        onPress={() => router.push(`/(recipes)/recipe/${item.id}`)}
        style={[
          styles.gridCard,
          { marginLeft: index % 2 === 0 ? 0 : COLUMN_GAP },
        ]}
      >
        <View style={styles.gridPhotoWrap}>
          {item.image_uri != null ? (
            <Image source={{ uri: item.image_uri }} style={styles.gridPhoto} resizeMode="cover" />
          ) : (
            <View style={[styles.gridPhoto, styles.photoPlaceholder]}>
              <Text style={styles.placeholderGlyph}>{'\u{1F37D}'}</Text>
            </View>
          )}
          <View style={styles.photoGradient} />
          {cookTime != null && (
            <View style={styles.cookTimeBadge}>
              <Text style={styles.cookTimeText}>{cookTime}</Text>
            </View>
          )}
        </View>
        <View style={styles.gridBody}>
          <Text numberOfLines={1} style={styles.gridTitle}>
            {item.title}
          </Text>
          {item.description != null && item.description.length > 0 ? (
            <Text numberOfLines={1} style={styles.gridSubtitle}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.difficultyRow}>
            <View style={[styles.difficultyDot, { backgroundColor: accent }]} />
            <Text style={[styles.difficultyLabel, { color: accent }]}>
              {DIFFICULTY_LABEL[difficulty]}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderListItem = ({ item }: { item: Recipe }) => {
    const difficulty = item.difficulty ?? 'easy';
    const cookTime = formatCookTime(item.total_time_mins ?? item.cook_time_mins);
    const accent = DIFFICULTY_COLOR[difficulty];
    return (
      <Pressable
        onPress={() => router.push(`/(recipes)/recipe/${item.id}`)}
        style={styles.listRow}
      >
        <View style={styles.listPhotoWrap}>
          {item.image_uri != null ? (
            <Image source={{ uri: item.image_uri }} style={styles.listPhoto} resizeMode="cover" />
          ) : (
            <View style={[styles.listPhoto, styles.photoPlaceholder]}>
              <Text style={styles.placeholderGlyph}>{'\u{1F37D}'}</Text>
            </View>
          )}
        </View>
        <View style={styles.listBody}>
          <Text numberOfLines={1} style={styles.listTitle}>
            {item.title}
          </Text>
          {item.description != null && item.description.length > 0 ? (
            <Text numberOfLines={1} style={styles.listSubtitle}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.listMetaRow}>
            <View style={[styles.difficultyDot, { backgroundColor: accent }]} />
            <Text style={[styles.difficultyLabel, { color: accent }]}>
              {DIFFICULTY_LABEL[difficulty]}
            </Text>
            {cookTime != null && (
              <Text style={styles.listCookTime}>
                {'\u00B7'} {cookTime}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        key={viewMode}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.columnWrap : undefined}
        style={styles.list}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
        ListHeaderComponent={renderHeader}
        renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
        ListEmptyComponent={
          loading ? (
            <LoadingState rows={3} />
          ) : (
            <EmptyState
              icon={search || activeDifficulty || activeCuisine || activeDietary ? '🔍' : '🍳'}
              title={
                search || activeDifficulty || activeCuisine || activeDietary
                  ? 'No matching recipes'
                  : 'No recipes yet'
              }
              message={
                search || activeDifficulty || activeCuisine || activeDietary
                  ? 'Try adjusting your filters'
                  : 'Add your first recipe to get started'
              }
              actionLabel={
                !search && !activeDifficulty && !activeCuisine && !activeDietary
                  ? 'Add Recipe'
                  : undefined
              }
              onAction={
                !search && !activeDifficulty && !activeCuisine && !activeDietary
                  ? () => router.push('/(recipes)/add-recipe')
                  : undefined
              }
              accentColor={ACCENT}
            />
          )
        }
      />

      <Pressable style={styles.fab} onPress={() => router.push('/(recipes)/add-recipe')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  content: {
    padding: HORIZONTAL_PAD,
    paddingBottom: spacing.xxl + 60,
    gap: spacing.sm,
  },

  // Search row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    fontSize: 14,
    color: colors.textSecondary,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: surfaceTiers.highest,
    borderRadius: 999,
    paddingVertical: 12,
    paddingLeft: 38,
    paddingRight: 16,
    color: colors.text,
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: surfaceTiers.low,
    borderRadius: 999,
    padding: 4,
    gap: 2,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: ACCENT,
  },
  toggleIcon: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  toggleIconActive: {
    color: colors.background,
  },

  // Filter chips
  filterRowWrap: {
    marginBottom: spacing.sm,
  },
  filterLabel: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.15 * 10,
    color: colors.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: HORIZONTAL_PAD,
  },
  difficultyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: surfaceTiers.high,
  },
  difficultyChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  difficultyChipText: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.08 * 11,
    color: colors.textSecondary,
    textTransform: 'none',
    fontWeight: '500',
  },

  // Sort + count
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
  },
  sortChipActive: {
    backgroundColor: `${ACCENT}26`,
  },
  sortChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: ACCENT,
    fontWeight: '700',
  },

  // Grid
  columnWrap: {
    gap: 0,
  },
  gridCard: {
    flex: 1,
    marginBottom: spacing.md,
    backgroundColor: surfaceTiers.low,
    borderRadius: 18,
    overflow: 'hidden',
  },
  gridPhotoWrap: {
    aspectRatio: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: RECIPES_SURFACES.focus,
  },
  gridPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECIPES_SURFACES.focus,
  },
  placeholderGlyph: {
    fontSize: 36,
  },
  photoGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cookTimeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cookTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  gridBody: {
    padding: 12,
    gap: 4,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  gridSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  difficultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // List view
  listRow: {
    flexDirection: 'row',
    backgroundColor: surfaceTiers.low,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    padding: 8,
    gap: 12,
  },
  listPhotoWrap: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: RECIPES_SURFACES.focus,
  },
  listPhoto: {
    width: '100%',
    height: '100%',
  },
  listBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  listSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  listCookTime: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 2,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.lg + 60,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: colors.background,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
});
