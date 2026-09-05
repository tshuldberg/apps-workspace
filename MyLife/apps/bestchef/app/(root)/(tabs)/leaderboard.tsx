import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChefHat,
  Check,
  Crown,
  AlertCircle,
  Globe,
  MapPin,
  Search,
  Trophy,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { AppToolbar } from '../components/AppToolbar';
import {
  JAKARTA_FONTS,
  HERO_GRADIENT,
  BC_CUISINES,
  getAllDishes,
  getAllRegions,
  type LeaderboardKind,
  type LeaderboardRange,
  type DishListItem,
} from '@mylife/bestchef';
import { CategoryScrollPicker, type CategoryPickerOption } from '@mylife/bestchef/ui';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useLeaderboardEntries } from '../hooks/useLeaderboardEntries';
import { Podium } from '../components/leaderboard/Podium';
import { RanksList } from '../components/leaderboard/RanksList';

// ── Tab pill ──────────────────────────────────────────────────────────

interface TabPillProps {
  label: string;
  Icon: LucideIcon;
  isActive: boolean;
  onPress: () => void;
}

function TabPill({ label, Icon, isActive, onPress }: TabPillProps) {
  const tc = useThemeColors();
  const scale = useRef(new Animated.Value(isActive ? 1 : 0.94)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1 : 0.94,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  }, [isActive, scale]);

  const iconColor = isActive ? '#FFFFFF' : tc.textSecondary;

  if (isActive) {
    return (
      <Animated.View style={[styles.pillWrap, { transform: [{ scale }] }]}>
        <Pressable onPress={onPress}>
          <LinearGradient
            colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pillActive}
          >
            <Icon size={13} color={iconColor} strokeWidth={2.5} />
            <Text style={styles.pillTextActive}>{label}</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[styles.pillWrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        style={[styles.pillInactive, { backgroundColor: tc.surfaceElevated }]}
      >
        <Icon size={13} color={iconColor} strokeWidth={2.5} />
        <Text style={[styles.pillText, { color: tc.textSecondary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── AllTimeBanner ─────────────────────────────────────────────────────

function AllTimeBanner() {
  const { t } = useI18n();
  return (
    <View style={styles.bannerWrap}>
      <LinearGradient
        colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <Text style={styles.bannerEmoji}>{'🏆'}</Text>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>{t('Greatest Of All Time')}</Text>
          <Text style={styles.bannerSubtitle}>{t('The definitive ranking across every dish & culture')}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

type LeaderboardSort = 'score' | 'reviewed' | 'approval';
type MinimumReviewFilter = 0 | 1 | 5 | 10 | 25;

function dishesToOptions(dishes: DishListItem[]): CategoryPickerOption[] {
  return dishes.map((d) => ({
    id: d.id,
    label: d.emoji ? `${d.emoji} ${d.name}` : d.name,
    icon: d.emoji ? null : <UtensilsCrossed size={11} color={HERO_GRADIENT.from} strokeWidth={2.5} />,
    iconActive: d.emoji ? null : <UtensilsCrossed size={11} color="#FFFFFF" strokeWidth={2.5} />,
  }));
}

function cuisinesToOptions(cuisines: readonly string[]): CategoryPickerOption[] {
  return cuisines.map((c) => ({
    id: c,
    label: c,
    icon: <Globe size={11} color={HERO_GRADIENT.from} strokeWidth={2.5} />,
    iconActive: <Globe size={11} color="#FFFFFF" strokeWidth={2.5} />,
  }));
}

function regionsToOptions(regions: string[]): CategoryPickerOption[] {
  return regions.map((r) => ({
    id: r,
    label: r,
    icon: <MapPin size={11} color={HERO_GRADIENT.from} strokeWidth={2.5} fill={HERO_GRADIENT.from} />,
    iconActive: <MapPin size={11} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />,
  }));
}

function getApprovalRatio(entry: { upvoteCount: number; downvoteCount: number }): number {
  const total = entry.upvoteCount + entry.downvoteCount;
  return total > 0 ? entry.upvoteCount / total : 0;
}

function getDefaultSubFilter(
  kind: LeaderboardKind,
  dishOptions: CategoryPickerOption[],
  cuisineOptions: CategoryPickerOption[],
  regionOptions: CategoryPickerOption[],
): string | null {
  if (kind === 'dish') return dishOptions[0]?.id ?? null;
  if (kind === 'cuisine') return cuisineOptions[0]?.id ?? null;
  if (kind === 'region') return regionOptions[0]?.id ?? null;
  return null;
}

function resolveInitialKind(kind: string | undefined): LeaderboardKind {
  if (kind === 'category' || kind === 'dish') return 'dish';
  if (kind === 'cuisine') return 'cuisine';
  if (kind === 'region') return 'region';
  if (kind === 'allTime') return 'allTime';
  return 'allTime';
}

interface SheetChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function SheetChip({ label, selected, onPress }: SheetChipProps) {
  const tc = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.sheetChip,
        { backgroundColor: tc.surfaceElevated, borderColor: tc.border },
        selected && { backgroundColor: `${tc.accent}24`, borderColor: tc.accent },
        pressed && { opacity: 0.72, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={[styles.sheetChipText, { color: selected ? tc.accent : tc.textSecondary }]}>
        {label}
      </Text>
      {selected && <Check size={14} color={tc.accent} strokeWidth={2.4} />}
    </Pressable>
  );
}

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
}

function FilterSection({ title, children }: FilterSectionProps) {
  const tc = useThemeColors();
  return (
    <View style={styles.filterSection}>
      <Text style={[styles.filterSectionTitle, { color: tc.text }]}>{title}</Text>
      {children}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const { t, formatNumber, language: appLanguage } = useI18n();
  const params = useLocalSearchParams<{ kind?: string }>();

  const initialKind = resolveInitialKind(params.kind);
  const lastParamKindRef = useRef(params.kind);

  const [activeKind, setActiveKind] = useState<LeaderboardKind>(initialKind);
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [range, setRange] = useState<LeaderboardRange>('all');
  const [sortBy, setSortBy] = useState<LeaderboardSort>('score');
  const [minimumReviews, setMinimumReviews] = useState<MinimumReviewFilter>(0);
  const [restaurantsOnly, setRestaurantsOnly] = useState(false);
  const [languageOnly, setLanguageOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [draftKind, setDraftKind] = useState<LeaderboardKind>(initialKind);
  const [draftSubFilter, setDraftSubFilter] = useState<string | null>(null);
  const [draftRange, setDraftRange] = useState<LeaderboardRange>('all');
  const [draftSortBy, setDraftSortBy] = useState<LeaderboardSort>('score');
  const [draftMinimumReviews, setDraftMinimumReviews] = useState<MinimumReviewFilter>(0);
  const [draftRestaurantsOnly, setDraftRestaurantsOnly] = useState(false);
  const [draftLanguageOnly, setDraftLanguageOnly] = useState(false);
  const [optionSearch, setOptionSearch] = useState('');

  // Sub-picker item lists
  const [dishOptions, setDishOptions] = useState<CategoryPickerOption[]>([]);
  const [regionOptions, setRegionOptions] = useState<CategoryPickerOption[]>([]);

  const cuisineOptions = useMemo(() => cuisinesToOptions(BC_CUISINES), []);

  useEffect(() => {
    if (lastParamKindRef.current === params.kind) return;
    lastParamKindRef.current = params.kind;
    const nextKind = resolveInitialKind(params.kind);
    setActiveKind(nextKind);
    setDraftKind(nextKind);
    setSubFilter(null);
    setDraftSubFilter(null);
  }, [params.kind]);

  // Load dish list once
  useEffect(() => {
    getAllDishes().then((result) => {
      if (result.ok && result.data.length > 0) {
        const opts = dishesToOptions(result.data);
        setDishOptions(opts);
        if (activeKind === 'dish' && subFilter === null) {
          setSubFilter(opts[0]?.id ?? null);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load regions once
  useEffect(() => {
    getAllRegions().then((result) => {
      if (result.ok && result.data.length > 0) {
        const opts = regionsToOptions(result.data);
        setRegionOptions(opts);
      }
    });
  }, []);

  useEffect(() => {
    if (activeKind === 'allTime') {
      if (subFilter !== null) setSubFilter(null);
      return;
    }
    if (subFilter !== null) return;
    const nextSubFilter = getDefaultSubFilter(
      activeKind,
      dishOptions,
      cuisineOptions,
      regionOptions,
    );
    if (nextSubFilter !== null) {
      setSubFilter(nextSubFilter);
    }
  }, [activeKind, cuisineOptions, dishOptions, regionOptions, subFilter]);

  // Reset subFilter when kind changes and seed with first item
  function handleKindChange(kind: LeaderboardKind) {
    setActiveKind(kind);
    setSubFilter(getDefaultSubFilter(kind, dishOptions, cuisineOptions, regionOptions));
  }

  function handleDraftKindChange(kind: LeaderboardKind) {
    setDraftKind(kind);
    setDraftSubFilter(getDefaultSubFilter(kind, dishOptions, cuisineOptions, regionOptions));
    setOptionSearch('');
  }

  function openFilterSheet() {
    setDraftKind(activeKind);
    setDraftSubFilter(subFilter);
    setDraftRange(range);
    setDraftSortBy(sortBy);
    setDraftMinimumReviews(minimumReviews);
    setDraftRestaurantsOnly(restaurantsOnly);
    setDraftLanguageOnly(languageOnly);
    setOptionSearch('');
    setShowFilters(true);
  }

  function resetDraftFilters() {
    setDraftKind('allTime');
    setDraftSubFilter(null);
    setDraftRange('all');
    setDraftSortBy('score');
    setDraftMinimumReviews(0);
    setDraftRestaurantsOnly(false);
    setDraftLanguageOnly(false);
    setOptionSearch('');
  }

  function applyDraftFilters() {
    setActiveKind(draftKind);
    setSubFilter(
      draftKind === 'allTime'
        ? null
        : draftSubFilter ?? getDefaultSubFilter(draftKind, dishOptions, cuisineOptions, regionOptions),
    );
    setRange(draftRange);
    setSortBy(draftSortBy);
    setMinimumReviews(draftMinimumReviews);
    setRestaurantsOnly(draftRestaurantsOnly);
    setLanguageOnly(draftLanguageOnly);
    setShowFilters(false);
  }

  // Resolve current sub-picker options
  const currentSubOptions: CategoryPickerOption[] =
    activeKind === 'dish'
      ? dishOptions
      : activeKind === 'cuisine'
        ? cuisineOptions
        : activeKind === 'region'
          ? regionOptions
          : [];

  const draftSubOptions: CategoryPickerOption[] =
    draftKind === 'dish'
      ? dishOptions
      : draftKind === 'cuisine'
        ? cuisineOptions
        : draftKind === 'region'
          ? regionOptions
          : [];

  const filteredDraftSubOptions = useMemo(() => {
    const query = optionSearch.trim().toLowerCase();
    if (query.length === 0) return draftSubOptions;
    return draftSubOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [draftSubOptions, optionSearch]);

  const { entries, loading, error, refresh } = useLeaderboardEntries({
    kind: activeKind,
    subFilter,
    range,
    // Per-market boards (plan 33 Phase 2.5): composes with region kind.
    // Reactive read: switching the app language while the filter is active
    // refetches through the hook's language dependency (review finding).
    language: languageOnly ? appLanguage.toLowerCase() : null,
  });

  const visibleEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (minimumReviews > 0 && entry.reviewedCount < minimumReviews) return false;
      if (restaurantsOnly && !entry.isRestaurant) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'reviewed') {
        return b.reviewedCount - a.reviewedCount || b.voteScore - a.voteScore;
      }
      if (sortBy === 'approval') {
        return getApprovalRatio(b) - getApprovalRatio(a) || b.voteScore - a.voteScore;
      }
      return b.voteScore - a.voteScore || b.reviewedCount - a.reviewedCount;
    });
  }, [entries, minimumReviews, restaurantsOnly, sortBy]);

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  const rangeTabs: { id: LeaderboardRange; label: string }[] = [
    { id: 'today', label: t('leaderboard_today') },
    { id: 'week', label: t('leaderboard_this_week') },
    { id: 'month', label: t('leaderboard_this_month') },
    { id: 'all', label: t('leaderboard_all_time') },
  ];

  const tabs: { kind: LeaderboardKind; label: string; Icon: LucideIcon }[] = [
    { kind: 'allTime', label: t('All Time'), Icon: Crown },
    { kind: 'dish', label: t('By Dish'), Icon: UtensilsCrossed },
    { kind: 'cuisine', label: t('By Cuisine'), Icon: Globe },
    { kind: 'region', label: t('By Region'), Icon: MapPin },
  ];

  const sortOptions: { id: LeaderboardSort; label: string }[] = [
    { id: 'score', label: t('Score') },
    { id: 'reviewed', label: t('Reviewed') },
    { id: 'approval', label: t('Approval') },
  ];

  const minimumReviewOptions: { id: MinimumReviewFilter; label: string }[] = [
    { id: 0, label: t('Any') },
    { id: 1, label: '1+' },
    { id: 5, label: '5+' },
    { id: 10, label: '10+' },
    { id: 25, label: '25+' },
  ];

  const activeFilterSummaries = [
    range !== 'all' ? rangeTabs.find((item) => item.id === range)?.label : null,
    sortBy !== 'score' ? `${t('Sort')}: ${sortOptions.find((item) => item.id === sortBy)?.label}` : null,
    minimumReviews > 0 ? `${minimumReviews}+ ${t('Reviewed')}` : null,
    restaurantsOnly ? t('Restaurants') : null,
    languageOnly ? t('My language') : null,
  ].filter((item): item is string => item != null);

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppToolbar
          pinwheelPageKey="leaderboard"
          title={t('Top 100')}
          titleIcon={<Trophy size={18} color={HERO_GRADIENT.from} strokeWidth={2.5} fill={HERO_GRADIENT.from} />}
          onFilter={openFilterSheet}
        />
      </View>

      {/* Time-range segmented control */}
      <View style={styles.segmentRow}>
        <View style={[styles.segmentWrap, { backgroundColor: tc.surfaceElevated }]}>
          {rangeTabs.map((rt) => {
            const active = range === rt.id;
            return (
              <Pressable
                key={rt.id}
                onPress={() => setRange(rt.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={rt.label}
                style={styles.segmentItem}
              >
                {active ? (
                  <LinearGradient
                    colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.segmentItemActive}
                  >
                    <Text style={styles.segmentTextActive}>{rt.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.segmentItemInactive}>
                    <Text style={[styles.segmentText, { color: tc.textSecondary }]}>{rt.label}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 4-pill tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillRow}
      >
        {tabs.map(({ kind, label, Icon }) => (
          <TabPill
            key={kind}
            label={label}
            Icon={Icon}
            isActive={activeKind === kind}
            onPress={() => handleKindChange(kind)}
          />
        ))}
      </ScrollView>

      {/* Sub-picker (non-allTime only) */}
      {activeKind !== 'allTime' && currentSubOptions.length > 0 && subFilter !== null && (
        <CategoryScrollPicker
          options={currentSubOptions}
          selected={subFilter}
          onChange={setSubFilter}
        />
      )}

      {/* AllTimeBanner */}
      {activeKind === 'allTime' && <AllTimeBanner />}

      {activeFilterSummaries.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.activeFilterScroll}
          contentContainerStyle={styles.activeFilterRow}
        >
          {activeFilterSummaries.map((label) => (
            <View key={label} style={[styles.activeFilterChip, { backgroundColor: `${tc.accent}1F` }]}>
              <Text style={[styles.activeFilterText, { color: tc.accent }]}>{label}</Text>
            </View>
          ))}
          <Pressable
            onPress={() => {
              setSortBy('score');
              setMinimumReviews(0);
              setRestaurantsOnly(false);
              setRange('all');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Clear filters')}
            style={styles.clearActiveButton}
          >
            <Text style={[styles.clearActiveText, { color: tc.textSecondary }]}>{t('Clear')}</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Podium + ranks list */}
      {loading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={tc.accent} />
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <AlertCircle size={40} color={tc.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('Could not load leaderboard')}</Text>
          <Text style={[styles.emptyMessage, { color: tc.textSecondary }]}>
            {error}
          </Text>
        </View>
      ) : visibleEntries.length === 0 ? (
        <View style={styles.stateWrap}>
          <ChefHat size={40} color={tc.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No entries yet')}</Text>
          <Text style={[styles.emptyMessage, { color: tc.textSecondary }]}>
            {t('Be the first to submit for this category.')}
          </Text>
          {/* Cold start invites the first submission (N7). */}
          <Pressable
            style={[styles.emptySubmitButton, { backgroundColor: tc.accent }]}
            onPress={() => router.push('/submit')}
            accessibilityRole="button"
          >
            <Text style={[styles.emptySubmitButtonText, { color: tc.background }]}>
              {t('Submit a recipe')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tc.accent} />}
        >
          <Podium
            gold={visibleEntries[0]}
            silver={visibleEntries[1]}
            bronze={visibleEntries[2]}
          />
          <RanksList entries={visibleEntries.slice(3, 100)} />
        </ScrollView>
      )}

      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={[styles.filterScreen, { backgroundColor: tc.background }]}>
          <View style={[styles.filterHeader, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={() => setShowFilters(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('Close filters')}
            >
              <X size={23} color={tc.text} strokeWidth={2.2} />
            </Pressable>
            <View style={styles.filterHeaderText}>
              <Text style={[styles.filterTitle, { color: tc.text }]}>{t('Filters')}</Text>
              <Text style={[styles.filterSubtitle, { color: tc.textSecondary }]}>
                {formatNumber(visibleEntries.length)} {t('entries')}
              </Text>
            </View>
            <Pressable
              onPress={resetDraftFilters}
              accessibilityRole="button"
              accessibilityLabel={t('Reset filters')}
              style={styles.resetButton}
            >
              <Text style={[styles.resetText, { color: tc.accent }]}>{t('Reset')}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.filterContent} showsVerticalScrollIndicator={false}>
            <FilterSection title={t('Time range')}>
              <View style={styles.sheetChipGrid}>
                {rangeTabs.map((item) => (
                  <SheetChip
                    key={item.id}
                    label={item.label}
                    selected={draftRange === item.id}
                    onPress={() => setDraftRange(item.id)}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title={t('Leaderboard')}>
              <View style={styles.sheetChipGrid}>
                {tabs.map(({ kind, label }) => (
                  <SheetChip
                    key={kind}
                    label={label}
                    selected={draftKind === kind}
                    onPress={() => handleDraftKindChange(kind)}
                  />
                ))}
              </View>
            </FilterSection>

            {draftKind !== 'allTime' && (
              <FilterSection title={draftKind === 'dish' ? t('Dish') : draftKind === 'cuisine' ? t('Cuisine') : t('Region')}>
                <View style={[styles.optionSearch, { backgroundColor: tc.surfaceElevated, borderColor: tc.border }]}>
                  <Search size={16} color={tc.textSecondary} strokeWidth={2} />
                  <TextInput
                    value={optionSearch}
                    onChangeText={setOptionSearch}
                    placeholder={t('Search')}
                    placeholderTextColor={tc.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.optionSearchInput, { color: tc.text }]}
                  />
                </View>
                <View style={styles.sheetChipGrid}>
                  {filteredDraftSubOptions.slice(0, 30).map((option) => (
                    <SheetChip
                      key={option.id}
                      label={option.label}
                      selected={draftSubFilter === option.id}
                      onPress={() => setDraftSubFilter(option.id)}
                    />
                  ))}
                </View>
              </FilterSection>
            )}

            <FilterSection title={t('Sort')}>
              <View style={styles.sheetChipGrid}>
                {sortOptions.map((option) => (
                  <SheetChip
                    key={option.id}
                    label={option.label}
                    selected={draftSortBy === option.id}
                    onPress={() => setDraftSortBy(option.id)}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title={t('Minimum reviewed votes')}>
              <View style={styles.sheetChipGrid}>
                {minimumReviewOptions.map((option) => (
                  <SheetChip
                    key={option.id}
                    label={option.label}
                    selected={draftMinimumReviews === option.id}
                    onPress={() => setDraftMinimumReviews(option.id)}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title={t('Account type')}>
              <Pressable
                onPress={() => setDraftRestaurantsOnly((value) => !value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draftRestaurantsOnly }}
                style={({ pressed }) => [
                  styles.toggleRow,
                  { backgroundColor: tc.surfaceElevated, borderColor: draftRestaurantsOnly ? tc.accent : tc.border },
                  pressed && { opacity: 0.78 },
                ]}
              >
                <View style={styles.toggleCopy}>
                  <Text style={[styles.toggleTitle, { color: tc.text }]}>{t('Restaurants')}</Text>
                  <Text style={[styles.toggleSubtitle, { color: tc.textSecondary }]}>
                    {t('Only show verified restaurant submissions.')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkBox,
                    { borderColor: draftRestaurantsOnly ? tc.accent : tc.textTertiary },
                    draftRestaurantsOnly && { backgroundColor: tc.accent },
                  ]}
                >
                  {draftRestaurantsOnly && <Check size={14} color={tc.background} strokeWidth={2.8} />}
                </View>
              </Pressable>
            </FilterSection>

            <FilterSection title={t('Language')}>
              <Pressable
                onPress={() => setDraftLanguageOnly((value) => !value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draftLanguageOnly }}
                style={({ pressed }) => [
                  styles.toggleRow,
                  { backgroundColor: tc.surfaceElevated, borderColor: draftLanguageOnly ? tc.accent : tc.border },
                  pressed && { opacity: 0.78 },
                ]}
              >
                <View style={styles.toggleCopy}>
                  <Text style={[styles.toggleTitle, { color: tc.text }]}>{t('My language')}</Text>
                  <Text style={[styles.toggleSubtitle, { color: tc.textSecondary }]}>
                    {t('Only show recipes written in your app language.')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkBox,
                    { borderColor: draftLanguageOnly ? tc.accent : tc.textTertiary },
                    draftLanguageOnly && { backgroundColor: tc.accent },
                  ]}
                >
                  {draftLanguageOnly && <Check size={14} color={tc.background} strokeWidth={2.8} />}
                </View>
              </Pressable>
            </FilterSection>
          </ScrollView>

          <View style={[styles.filterFooter, { borderTopColor: tc.border }]}>
            <Pressable
              style={({ pressed }) => [styles.footerSecondary, pressed && { opacity: 0.7 }]}
              onPress={resetDraftFilters}
              accessibilityRole="button"
            >
              <Text style={[styles.footerSecondaryText, { color: tc.textSecondary }]}>{t('Clear all')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.applyButton,
                { backgroundColor: tc.accent },
                pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] },
              ]}
              onPress={applyDraftFilters}
              accessibilityRole="button"
            >
              <Text style={[styles.applyButtonText, { color: tc.background }]}>{t('Apply filters')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Time-range segmented control
  segmentRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
  },
  segmentItemActive: {
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemInactive: {
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
  },
  segmentTextActive: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    // Warm near-black ink: white on the saffron gradient end was ~2:1 (N10).
    color: '#33200F',
  },
  emptySubmitButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptySubmitButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },

  // Pill tab bar
  pillScroll: { flexGrow: 0, minHeight: 64 },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  pillWrap: {
    paddingVertical: 2,
  },
  pillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillTextActive: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  pillText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
  },

  // AllTimeBanner
  bannerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    shadowColor: HERO_GRADIENT.from,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  banner: {
    height: 72,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  bannerEmoji: {
    fontSize: 38,
    lineHeight: 46,
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  bannerSubtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.85)',
  },

  activeFilterRow: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  activeFilterScroll: {
    flexGrow: 0,
    maxHeight: 44,
  },
  activeFilterChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeFilterText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
  },
  clearActiveButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearActiveText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
  },

  // State + list
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 40, gap: 12 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  emptyMessage: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center' },
  listContent: { paddingTop: 4, paddingBottom: 20 },

  filterScreen: { flex: 1 },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 14,
  },
  filterHeaderText: { flex: 1 },
  filterTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 22,
    lineHeight: 28,
  },
  filterSubtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
  },
  resetButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  resetText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 22,
  },
  filterSection: { gap: 10 },
  filterSectionTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
  },
  sheetChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetChip: {
    minHeight: 40,
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sheetChipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  optionSearch: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionSearchInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    paddingVertical: 0,
  },
  toggleRow: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleCopy: { flex: 1, gap: 3 },
  toggleTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
  },
  toggleSubtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerSecondary: {
    minHeight: 48,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSecondaryText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
  },
  applyButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 14,
  },
});
