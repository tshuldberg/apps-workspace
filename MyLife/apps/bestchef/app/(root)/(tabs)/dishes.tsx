import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowUpDown, ChefHat, Check, Filter, Search, X } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import {
  loadDishCatalog,
  type CatalogDish,
  type CatalogSource,
} from '../data/cloud-dishes';
import {
  FILTER_DOMAINS,
  getTagLabel,
  matchesFilter,
  type TagId,
} from '../data/taxonomy';
import { useI18n } from '../i18n/I18nProvider';

type SortOption = 'popularity' | 'newest' | 'alpha';

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const tc = useThemeColors();
  return (
    <Pressable style={[styles.chip, { backgroundColor: tc.surface }, selected && { backgroundColor: `${tc.accent}24` }]} onPress={onPress}>
      <Text style={[styles.chipText, { color: tc.textSecondary }, selected && { color: tc.accent }]}>{label}</Text>
    </Pressable>
  );
}

export default function DishesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, tp, formatNumber } = useI18n();
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<TagId[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [showSort, setShowSort] = useState(false);
  const [catalog, setCatalog] = useState<CatalogDish[]>([]);
  const [catalogSource, setCatalogSource] = useState<CatalogSource>('none');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);

  const loadCatalog = useCallback((force: boolean) => {
    let cancelled = false;
    setCatalogLoading(true);
    void loadDishCatalog({ force }).then((result) => {
      if (cancelled) return;
      setCatalog(result.dishes);
      setCatalogSource(result.source);
      // A failed cloud fetch with nothing to show is an error state, never an
      // empty state (N9). With cached/demo dishes present, stale beats a wall.
      setCatalogError(result.error === true && result.dishes.length === 0);
      setCatalogLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadCatalog(false), [loadCatalog]);

  const toggleTag = (tag: TagId) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // Cloud catalog dishes carry no taxonomy tags; tag filters apply to demo data only.
  const tagFiltersAvailable = catalogSource !== 'cloud';

  const dishes = useMemo(() => {
    const filtered = catalog.filter((d) => {
      if (query && !d.name.toLowerCase().includes(query.toLowerCase()) && !d.cuisine.toLowerCase().includes(query.toLowerCase())) return false;
      if (tagFiltersAvailable && activeTags.length > 0 && !matchesFilter({ id: d.id, tags: d.tags }, activeTags)) return false;
      return true;
    });
    if (sortBy === 'popularity') {
      return [...filtered].sort((a, b) => b.submissionCount - a.submissionCount);
    }
    if (sortBy === 'newest') {
      const numericId = (id: string) => {
        const match = id.match(/\d+/);
        return match ? Number(match[0]) : 0;
      };
      return [...filtered].sort(
        (a, b) =>
          (b.createdAtMs ?? numericId(b.id)) - (a.createdAtMs ?? numericId(a.id)),
      );
    }
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, query, activeTags, sortBy, tagFiltersAvailable]);

  const sortLabelKey: Record<SortOption, 'dishes_sort_popularity' | 'dishes_sort_newest' | 'dishes_sort_alpha'> = {
    popularity: 'dishes_sort_popularity',
    newest: 'dishes_sort_newest',
    alpha: 'dishes_sort_alpha',
  };

  const activeCount = activeTags.length;

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.headerTitle, { color: tc.text }]}>{t('Dishes')}</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: tc.surface }]}>
          <Search size={18} color={tc.textSecondary} strokeWidth={2} />
          <TextInput
            style={[styles.searchInput, { color: tc.text }]}
            placeholder={t('Search dishes, cuisines...')}
            placeholderTextColor={tc.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable
          style={[styles.filterButton, { backgroundColor: tc.surface }]}
          onPress={() => setShowSort(true)}
          accessibilityRole="button"
          accessibilityLabel={t('dishes_sort_label')}
        >
          <ArrowUpDown size={18} color={tc.textSecondary} strokeWidth={2} />
        </Pressable>
        {tagFiltersAvailable && (
          <Pressable
            style={[styles.filterButton, { backgroundColor: tc.surface }, activeCount > 0 && { backgroundColor: tc.accent }]}
            onPress={() => setShowFilters(true)}
          >
            <Filter size={18} color={activeCount > 0 ? tc.background : tc.textSecondary} strokeWidth={2} />
            {activeCount > 0 && <Text style={[styles.filterCount, { color: tc.background }]}>{activeCount}</Text>}
          </Pressable>
        )}
      </View>

      <View style={styles.sortRow}>
        <Text style={[styles.sortLabel, { color: tc.textTertiary }]}>{t('dishes_sort_label')}:</Text>
        <Text style={[styles.sortValue, { color: tc.accent }]}>{t(sortLabelKey[sortBy])}</Text>
      </View>

      {activeTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeTagRow}>
          {activeTags.map((tag) => (
            <Pressable key={tag} style={[styles.activeTag, { backgroundColor: `${tc.accent}1F` }]} onPress={() => toggleTag(tag)}>
              <Text style={[styles.activeTagText, { color: tc.accent }]}>{t(getTagLabel(tag))}</Text>
              <X size={12} color={tc.accent} strokeWidth={2.5} />
            </Pressable>
          ))}
          <Pressable style={styles.clearAll} onPress={() => setActiveTags([])}>
            <Text style={[styles.clearAllText, { color: tc.textSecondary }]}>{t('Clear all')}</Text>
          </Pressable>
        </ScrollView>
      )}

      {catalogLoading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={tc.accent} />
        </View>
      ) : catalogError ? (
        <View style={styles.stateWrap}>
          <ChefHat size={32} color={tc.textTertiary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('Could not load dishes')}</Text>
          <Text style={[styles.emptyMessage, { color: tc.textSecondary }]}>
            {t('Check your connection and try again.')}
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: tc.accent }]}
            onPress={() => loadCatalog(true)}
            accessibilityRole="button"
          >
            <Text style={[styles.retryButtonText, { color: tc.background }]}>{t('state_retry')}</Text>
          </Pressable>
        </View>
      ) : dishes.length === 0 ? (
        <View style={styles.stateWrap}>
          <ChefHat size={32} color={tc.textTertiary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No dishes found')}</Text>
          <Text style={[styles.emptyMessage, { color: tc.textSecondary }]}>{t('Try different filters or search terms')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.resultCount, { color: tc.textTertiary }]}>
            {formatNumber(dishes.length)} {tp(dishes.length, 'dish', 'dishes')}
          </Text>
          {dishes.map((dish) => (
            <Pressable
              key={dish.id}
              style={({ pressed }) => [styles.dishCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/dish/${dish.id}`)}
            >
              <View style={styles.dishHeader}>
                <View style={styles.dishInfo}>
                  <Text style={[styles.dishName, { color: tc.text }]}>{dish.name}</Text>
                  {dish.nativeName != null && (
                    <Text style={[styles.dishNativeName, { color: tc.textSecondary }]}>{dish.nativeName}</Text>
                  )}
                </View>
                <View style={[styles.categoryPill, { backgroundColor: `${tc.accent}1F` }]}>
                  <Text style={[styles.categoryPillText, { color: tc.accent }]}>{t(dish.category)}</Text>
                </View>
              </View>
              <View style={styles.dishMeta}>
                <Text style={[styles.dishMetaText, { color: tc.textSecondary }]}>{dish.cuisine}</Text>
                <Text style={[styles.dishMetaDot, { color: tc.textTertiary }]}>{'\u00B7'}</Text>
                <Text style={[styles.dishMetaText, { color: tc.textSecondary }]}>
                  {formatNumber(dish.submissionCount)} {tp(dish.submissionCount, 'recipe', 'recipes')}
                </Text>
              </View>
              {dish.tags.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
                  {dish.tags.slice(0, 6).map((tag) => (
                    <View key={tag} style={[styles.tagPill, { backgroundColor: tc.border }]}>
                      <Text style={[styles.tagPillText, { color: tc.textTertiary }]}>{t(getTagLabel(tag))}</Text>
                    </View>
                  ))}
                  {dish.tags.length > 6 && (
                    <View style={[styles.tagPill, { backgroundColor: tc.border }]}>
                      <Text style={[styles.tagPillText, { color: tc.textTertiary }]}>+{dish.tags.length - 6}</Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={showSort} animationType="fade" transparent>
        <Pressable style={styles.sortBackdrop} onPress={() => setShowSort(false)}>
          <View style={[styles.sortSheet, { backgroundColor: tc.surface, borderColor: tc.border }]}>
            <Text style={[styles.sortSheetTitle, { color: tc.text }]}>{t('dishes_sort_label')}</Text>
            {(['popularity', 'newest', 'alpha'] as SortOption[]).map((option) => (
              <Pressable
                key={option}
                style={styles.sortOption}
                onPress={() => {
                  setSortBy(option);
                  setShowSort(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: sortBy === option }}
              >
                <Text style={[styles.sortOptionText, { color: sortBy === option ? tc.accent : tc.text }]}>
                  {t(sortLabelKey[option])}
                </Text>
                {sortBy === option && <Check size={18} color={tc.accent} strokeWidth={2.5} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalScreen, { backgroundColor: tc.background }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowFilters(false)} hitSlop={12}>
              <X size={24} color={tc.text} strokeWidth={2} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: tc.text }]}>{t('Filters')}</Text>
            {activeTags.length > 0 ? (
              <Pressable onPress={() => setActiveTags([])}>
                <Text style={[styles.modalClear, { color: tc.accent }]}>{t('Clear')}</Text>
              </Pressable>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {FILTER_DOMAINS.map((domain) => (
              <View key={domain.id} style={styles.domainSection}>
                <View style={styles.domainHeader}>
                  <Text style={styles.domainIcon}>{domain.icon}</Text>
                  <Text style={[styles.domainLabel, { color: tc.text }]}>{t(domain.label)}</Text>
                  {activeTags.some((t) => domain.tags.includes(t)) && (
                    <View style={[styles.domainBadge, { backgroundColor: tc.accent }]}>
                      <Text style={[styles.domainBadgeText, { color: tc.background }]}>
                        {activeTags.filter((t) => domain.tags.includes(t)).length}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.domainChips}>
                  {domain.tags.map((tag) => (
                    <FilterChip
                      key={tag}
                      label={t(getTagLabel(tag))}
                      selected={activeTags.includes(tag)}
                      onPress={() => toggleTag(tag)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          <Pressable style={[styles.applyButton, { backgroundColor: tc.accent, shadowColor: tc.accent }]} onPress={() => setShowFilters(false)}>
            <Text style={[styles.applyButtonText, { color: tc.background }]}>
              {t('Show')} {formatNumber(dishes.length)} {tp(dishes.length, 'dish', 'dishes')}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 8 },
  headerTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 30, lineHeight: 40, letterSpacing: -0.8 },

  searchRow: { flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 8, gap: 10 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontFamily: JAKARTA_FONTS.regular, fontSize: 15, padding: 0 },
  filterButton: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  filterCount: { position: 'absolute', top: 6, right: 6, fontFamily: JAKARTA_FONTS.bold, fontSize: 9 },

  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingBottom: 6 },
  sortLabel: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  sortValue: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },

  sortBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  sortSheet: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 8, gap: 2 },
  sortSheetTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  sortOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 14, borderRadius: 10 },
  sortOptionText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 15 },

  activeTagRow: { paddingHorizontal: 24, paddingBottom: 8, gap: 8 },
  activeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
  },
  activeTagText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 11 },
  clearAll: { paddingHorizontal: 10, paddingVertical: 6 },
  clearAllText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 11 },

  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 40, gap: 12 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  emptyMessage: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  retryButton: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999 },
  retryButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },

  resultCount: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, paddingBottom: 4 },
  listContent: { paddingHorizontal: 24, paddingBottom: 120, gap: 10 },
  dishCard: {
    borderRadius: 18, padding: 18, gap: 8, borderWidth: 1,
  },
  dishHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  dishInfo: { flex: 1, gap: 2 },
  dishName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  dishNativeName: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, fontStyle: 'italic' },
  categoryPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  categoryPillText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 10, letterSpacing: 0.5, textTransform: 'capitalize' },
  dishMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dishMetaText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  dishMetaDot: { fontSize: 12 },
  tagScroll: { marginTop: 4 },
  tagPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginRight: 6 },
  tagPillText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10 },

  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  chipText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },

  modalScreen: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
  },
  modalTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 20 },
  modalClear: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  modalContent: { paddingHorizontal: 24, paddingBottom: 120, gap: 28 },

  domainSection: { gap: 12 },
  domainHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  domainIcon: { fontSize: 18 },
  domainLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  domainBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  domainBadgeText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10 },
  domainChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  applyButton: {
    position: 'absolute', bottom: 36, left: 24, right: 24,
    borderRadius: 999, paddingVertical: 16, alignItems: 'center',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16,
  },
  applyButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
});
