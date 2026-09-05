import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  JAKARTA_FONTS,
  BC_CUISINES,
  getCuisineGradient,
  getBestChefClient,
  searchChefs,
  type ChefProfileData,
} from '@mylife/bestchef';
import { FilterChips, DishVisual } from '@mylife/bestchef/ui';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { DEMO_CHEFS, type DemoChef } from './data/demo';
import {
  loadDishCatalog,
  loadTrendingDishes,
  type CatalogDish,
} from './data/cloud-dishes';
import { shouldShowDemoContent } from './data/public-render-policy';
import { useI18n } from './i18n/I18nProvider';
import { ForwardChevron } from './components/DirectionalIcons';

// ── Filter types ───────────────────────────────────────────────────────

type FilterId = 'all' | 'recipes' | 'chefs' | 'cuisines' | 'dishes';

const FILTER_OPTIONS: { id: FilterId; labelKey: string }[] = [
  { id: 'all', labelKey: 'All' },
  { id: 'recipes', labelKey: 'Recipes' },
  { id: 'chefs', labelKey: 'Chefs' },
  { id: 'cuisines', labelKey: 'Cuisines' },
  { id: 'dishes', labelKey: 'Dishes' },
];

// ── Trending dish data (cloud catalog, demo-gated fallback) ────────────

const TOP_CUISINES = BC_CUISINES.slice(0, 8);

function mapChefProfileToRow(profile: ChefProfileData): DemoChef {
  return {
    id: profile.profileId,
    displayName: profile.displayName,
    handle: profile.handle,
    avatarUrl: profile.avatarUrl ?? undefined,
    location: '',
    submissionCount: profile.totalSubmissions,
    totalVotes: profile.totalVotesReceived,
    wins: profile.dishesWon,
    followers: profile.followerCount,
    topCuisine: profile.topCuisine ?? '',
  };
}

// ── Small cloud helper (submission search) ─────────────────────────────

interface SubmissionRow {
  id: string;
  title: string;
  chef_handle: string;
  vote_score: number;
  photo_url: string | null;
  dish_id: string;
}

async function searchSubmissions(query: string): Promise<SubmissionRow[]> {
  const { data, error } = await getBestChefClient()
    .from('bc_submissions')
    .select('id, title, chef_handle:social_profiles(handle), vote_score, photo_url, dish_id')
    .ilike('title', `%${query}%`)
    .limit(20);
  if (error || !data) return [];
  return (data as unknown[]).map((row: unknown) => {
    const r = row as Record<string, unknown>;
    const chefHandleField = r['chef_handle'];
    const handle =
      chefHandleField && typeof chefHandleField === 'object' && 'handle' in (chefHandleField as object)
        ? (chefHandleField as { handle: string }).handle
        : '';
    return {
      id: r['id'] as string,
      title: r['title'] as string,
      chef_handle: handle,
      vote_score: (r['vote_score'] as number) ?? 0,
      photo_url: (r['photo_url'] as string) ?? null,
      dish_id: r['dish_id'] as string,
    };
  });
}

// ── Sub-components ─────────────────────────────────────────────────────

function SectionHeader({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  const tc = useThemeColors();
  return (
    <View style={sectionHeaderRow}>
      <Text style={[styles.sectionTitle, { color: tc.text }]}>{label}</Text>
      {action != null && onAction != null && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: tc.accent }]}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const sectionHeaderRow = { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 10 };

function DishChip({ label, onPress }: { label: string; onPress: () => void }) {
  const tc = useThemeColors();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.flowChip, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
    >
      <Text style={[styles.flowChipText, { color: tc.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function CuisineCard({ cuisine, onPress }: { cuisine: string; onPress: () => void }) {
  const grad = getCuisineGradient(cuisine);
  return (
    <Pressable style={styles.cuisineCard} onPress={onPress}>
      <LinearGradient
        colors={[grad.from, grad.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cuisineCardOverlay} />
      <View style={styles.cuisineCardLabel}>
        <Text style={styles.cuisineCardText}>{cuisine}</Text>
        <ForwardChevron size={12} color="rgba(255,255,255,0.8)" strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

function RecipeRow({ sub, dish, onPress }: { sub: SubmissionRow; dish: CatalogDish | null; onPress: () => void }) {
  const tc = useThemeColors();
  const theme = useTheme();
  const visual = dish ?? { name: sub.title, cuisine: null, gradientFrom: null, gradientTo: null, emoji: null, photoUrl: null };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.resultRow, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }, pressed && { opacity: 0.8 }]}
    >
      <DishVisual dish={visual as Parameters<typeof DishVisual>[0]['dish']} size={52} radius={12} />
      <View style={styles.resultRowBody}>
        <Text style={[styles.resultRowTitle, { color: tc.text }]} numberOfLines={1}>{sub.title}</Text>
        <Text style={[styles.resultRowSub, { color: tc.textSecondary }]} numberOfLines={1}>@{sub.chef_handle}</Text>
        <Text style={[styles.resultRowMeta, { color: tc.textTertiary }]}>{sub.vote_score} votes</Text>
      </View>
      <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
    </Pressable>
  );
}

function ChefRow({ chef, onPress }: { chef: DemoChef; onPress: () => void }) {
  const tc = useThemeColors();
  const theme = useTheme();
  const initials = chef.displayName.split(' ').slice(0, 2).map((w) => w[0]).join('');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.resultRow, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.chefAvatar, { backgroundColor: tc.accent }]}>
        <Text style={styles.chefAvatarText}>{initials}</Text>
      </View>
      <View style={styles.resultRowBody}>
        <Text style={[styles.resultRowTitle, { color: tc.text }]} numberOfLines={1}>{chef.displayName}</Text>
        <Text style={[styles.resultRowSub, { color: tc.textSecondary }]} numberOfLines={1}>@{chef.handle}</Text>
        <Text style={[styles.resultRowMeta, { color: tc.textTertiary }]}>{chef.followers} followers</Text>
      </View>
      <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
    </Pressable>
  );
}

function CuisineRow({ cuisine, count, onPress }: { cuisine: string; count: number; onPress: () => void }) {
  const tc = useThemeColors();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.resultRow, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.cuisineIcon, { borderColor: theme.glass.cardBorder }]}>
        <Text style={styles.cuisineIconText}>🌐</Text>
      </View>
      <View style={styles.resultRowBody}>
        <Text style={[styles.resultRowTitle, { color: tc.text }]}>{cuisine}</Text>
        <Text style={[styles.resultRowMeta, { color: tc.textTertiary }]}>{count} dishes</Text>
      </View>
      <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
    </Pressable>
  );
}

function DishRow({ dish, onPress }: { dish: CatalogDish; onPress: () => void }) {
  const tc = useThemeColors();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.resultRow, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }, pressed && { opacity: 0.8 }]}
    >
      <DishVisual dish={dish} size={52} radius={12} />
      <View style={styles.resultRowBody}>
        <Text style={[styles.resultRowTitle, { color: tc.text }]} numberOfLines={1}>{dish.name}</Text>
        {dish.nativeName != null && (
          <Text style={[styles.resultRowSub, { color: tc.textSecondary }]} numberOfLines={1}>{dish.nativeName}</Text>
        )}
        <Text style={[styles.resultRowMeta, { color: tc.textTertiary }]}>{dish.cuisine} · {dish.submissionCount} recipes</Text>
      </View>
      <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
    </Pressable>
  );
}

// ── DiscoverContent (empty-query state) ───────────────────────────────

function DiscoverContent() {
  const router = useRouter();
  const { t } = useI18n();
  const [trending, setTrending] = useState<CatalogDish[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadTrendingDishes(8).then((result) => {
      if (!cancelled) setTrending(result.dishes);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.discoverContent}>
      {trending.length > 0 && (
        <>
          <SectionHeader label={t('Trending dishes')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flowRow}>
            {trending.map((dish) => (
              <DishChip key={dish.id} label={dish.name} onPress={() => router.push(`/dish/${dish.id}`)} />
            ))}
          </ScrollView>
        </>
      )}

      <View style={styles.sectionGap} />
      <SectionHeader label={t('Top cuisines')} />
      <View style={styles.cuisineGrid}>
        {TOP_CUISINES.map((cuisine) => (
          <CuisineCard key={cuisine} cuisine={cuisine} onPress={() => router.push({ pathname: '/dishes', params: { cuisine } } as Parameters<typeof router.push>[0])} />
        ))}
      </View>

      <View style={styles.sectionGap} />
      <SectionHeader label={t('Top regions')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flowRow}>
        {['Thailand', 'Italy', 'Japan', 'Mexico', 'India', 'Korea', 'France', 'Vietnam'].map((region) => (
          <DishChip key={region} label={region} onPress={() => {}} />
        ))}
      </ScrollView>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── SearchResults ──────────────────────────────────────────────────────

interface SearchState {
  submissions: SubmissionRow[];
  chefs: DemoChef[];
  cuisines: string[];
  dishes: CatalogDish[];
  dishById: Map<string, CatalogDish>;
  loading: boolean;
}

function SearchResults({ query, filter }: { query: string; filter: FilterId }) {
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useI18n();

  const [state, setState] = useState<SearchState>({
    submissions: [],
    chefs: [],
    cuisines: [],
    dishes: [],
    dishById: new Map(),
    loading: false,
  });

  useEffect(() => {
    const lower = query.toLowerCase();

    // Local cuisine filter
    const cuisineResults = (BC_CUISINES as readonly string[]).filter((c) =>
      c.toLowerCase().startsWith(lower),
    );

    setState((prev) => ({
      ...prev,
      cuisines: cuisineResults,
      loading: true,
    }));

    let cancelled = false;

    // Dish catalog filter (cloud bc_dishes, demo-gated fallback)
    void loadDishCatalog().then((catalog) => {
      if (cancelled) return;
      const dishResults = catalog.dishes.filter(
        (d) =>
          d.name.toLowerCase().includes(lower) ||
          (d.nativeName ?? '').toLowerCase().includes(lower),
      );
      setState((prev) => ({
        ...prev,
        dishes: dishResults,
        dishById: new Map(catalog.dishes.map((d) => [d.id, d])),
      }));
    });

    // Chef search (cloud social_profiles, demo-gated fallback)
    void (async () => {
      try {
        const result = await searchChefs(query, { limit: 20 });
        if (!cancelled && result.ok && result.data.length > 0) {
          setState((prev) => ({ ...prev, chefs: result.data.map(mapChefProfileToRow) }));
          return;
        }
      } catch {
        // fall through to demo policy
      }
      if (cancelled || !shouldShowDemoContent()) {
        if (!cancelled) setState((prev) => ({ ...prev, chefs: [] }));
        return;
      }
      const chefResults = DEMO_CHEFS.filter(
        (c) =>
          c.displayName.toLowerCase().includes(lower) ||
          c.handle.toLowerCase().includes(lower),
      );
      setState((prev) => ({ ...prev, chefs: chefResults }));
    })();

    // Cloud search for submissions
    searchSubmissions(query).then((subs) => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, submissions: subs, loading: false }));
      }
    }).catch(() => {
      if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
    });

    return () => { cancelled = true; };
  }, [query]);

  const showAll = filter === 'all';
  const showRecipes = showAll || filter === 'recipes';
  const showChefs = showAll || filter === 'chefs';
  const showCuisines = showAll || filter === 'cuisines';
  const showDishes = showAll || filter === 'dishes';

  const totalCount =
    (showRecipes ? state.submissions.length : 0) +
    (showChefs ? state.chefs.length : 0) +
    (showCuisines ? state.cuisines.length : 0) +
    (showDishes ? state.dishes.length : 0);

  if (state.loading && totalCount === 0) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={tc.accent} />
      </View>
    );
  }

  if (!state.loading && totalCount === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={[styles.noResultsTitle, { color: tc.text }]}>{t('No results')}</Text>
        <Text style={[styles.noResultsSub, { color: tc.textSecondary }]}>{t('Try a different keyword')}</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultsContent}>
      {showCuisines && state.cuisines.length > 0 && (
        <View style={styles.resultGroup}>
          <Text style={[styles.groupLabel, { color: tc.textTertiary }]}>
            {t('Cuisines').toUpperCase()} · {state.cuisines.length}
          </Text>
          {state.cuisines.map((c) => (
            <CuisineRow
              key={c}
              cuisine={c}
              count={[...state.dishById.values()].filter((d) => d.cuisine === c).length}
              onPress={() => router.push({ pathname: '/dishes', params: { cuisine: c } } as Parameters<typeof router.push>[0])}
            />
          ))}
        </View>
      )}

      {showDishes && state.dishes.length > 0 && (
        <View style={styles.resultGroup}>
          <Text style={[styles.groupLabel, { color: tc.textTertiary }]}>
            {t('Dishes').toUpperCase()} · {state.dishes.length}
          </Text>
          {state.dishes.map((d) => (
            <DishRow key={d.id} dish={d} onPress={() => router.push(`/dish/${d.id}`)} />
          ))}
        </View>
      )}

      {showChefs && state.chefs.length > 0 && (
        <View style={styles.resultGroup}>
          <Text style={[styles.groupLabel, { color: tc.textTertiary }]}>
            {t('Chefs').toUpperCase()} · {state.chefs.length}
          </Text>
          {state.chefs.map((c) => (
            <ChefRow key={c.id} chef={c} onPress={() => router.push(`/chef/${c.id}`)} />
          ))}
        </View>
      )}

      {showRecipes && state.submissions.length > 0 && (
        <View style={styles.resultGroup}>
          <Text style={[styles.groupLabel, { color: tc.textTertiary }]}>
            {t('Recipes').toUpperCase()} · {state.submissions.length}
          </Text>
          {state.submissions.map((s) => (
            <RecipeRow
              key={s.id}
              sub={s}
              dish={state.dishById.get(s.dish_id) ?? null}
              onPress={() => router.push(`/recipe/${s.id}`)}
            />
          ))}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Main screen ────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useI18n();

  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');

  // Auto-focus after 300ms
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(id);
  }, []);

  // Debounce query 200ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  const filterOptions = FILTER_OPTIONS.map((f) => ({ id: f.id, label: t(f.labelKey as Parameters<typeof t>[0]) }));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: tc.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: tc.text }]}>{t('Discover')}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.doneButton, { color: tc.accent }]}>{t('Done')}</Text>
        </Pressable>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: tc.surface }]}>
        <Search size={16} color={tc.textSecondary} strokeWidth={2.5} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: tc.text }]}
          placeholder={t('Search recipes, chefs, cuisines\u2026')}
          placeholderTextColor={tc.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X size={16} color={tc.textSecondary} strokeWidth={2.5} />
          </Pressable>
        )}
      </View>

      {/* Filter pills */}
      <FilterChips
        options={filterOptions}
        selected={filter}
        onChange={(id) => setFilter(id as FilterId)}
        style={styles.filterChips}
      />

      {/* Content */}
      {debouncedQuery === '' ? (
        <DiscoverContent />
      ) : (
        <SearchResults query={debouncedQuery} filter={filter} />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  doneButton: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    padding: 0,
  },

  filterChips: {
    paddingBottom: 10,
  },

  discoverContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  sectionTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
  },
  sectionAction: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
  },
  sectionGap: { height: 24 },

  flowRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  flowChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flowChipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
  },

  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cuisineCard: {
    width: '47.5%',
    height: 88,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  cuisineCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  cuisineCardLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  cuisineCardText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  resultsContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 20,
  },
  resultGroup: {
    gap: 8,
  },
  groupLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resultRowBody: {
    flex: 1,
    gap: 2,
  },
  resultRowTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
  },
  resultRowSub: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
  },
  resultRowMeta: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
  },

  chefAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chefAvatarText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
    includeFontPadding: false,
    textAlign: 'center',
    color: '#FFFFFF',
  },

  cuisineIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuisineIconText: {
    fontSize: 24,
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 60,
  },
  noResultsTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
  },
  noResultsSub: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
  },
});
