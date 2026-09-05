import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Barcode,
  BookOpen,
  Calendar,
  Camera,
  Clipboard,
  FileText,
  Filter,
  Heart,
  Package,
  Plus,
  Search,
  ShoppingBasket,
  Star,
  X,
} from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  listDistinctSavedRecipeCuisines,
  listDistinctSavedRecipeIngredients,
  searchSavedRecipes,
  type SavedRecipeSearchRow,
  type UseNextRecipePrompt,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { KitchenSliderShell } from '../components/KitchenSliderShell';
import { MediaSlot } from '../components/MediaSlot';
import { KitchenHeaderCard } from '../components/kitchen/KitchenHeaderCard';
import { KitchenSegmentedControl } from '../components/kitchen/KitchenSegmentedControl';
import { useDatabase } from '../providers/DatabaseProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import {
  getKitchenStats,
  getKitchenUseNextRecipePrompts,
  type KitchenStats,
  type SavedRecipeListItem,
} from '../data/kitchen';
import { ForwardChevron } from '../components/DirectionalIcons';

type UploadActionKey =
  | 'manual-food'
  | 'barcode'
  | 'receipt-photo'
  | 'grocery-photo'
  | 'expiration-photo'
  | 'recipe-ingredients'
  | 'clipboard';

const UPLOAD_ACTIONS: Array<{
  key: UploadActionKey;
  title: string;
  description: string;
  status: 'ready' | 'soon';
}> = [
  {
    key: 'manual-food',
    title: 'Manual Food',
    description: 'Add pantry item',
    status: 'ready',
  },
  {
    key: 'barcode',
    title: 'Barcode',
    description: 'Product lookup',
    status: 'ready',
  },
  {
    key: 'receipt-photo',
    title: 'Receipt Photo',
    description: 'OCR to pantry',
    status: 'ready',
  },
  {
    key: 'grocery-photo',
    title: 'Grocery Photo',
    description: 'Recognize foods',
    status: 'ready',
  },
  {
    key: 'expiration-photo',
    title: 'Expiration Photo',
    description: 'Read dates',
    status: 'ready',
  },
  {
    key: 'recipe-ingredients',
    title: 'Recipe Ingredients',
    description: 'Create recipe',
    status: 'ready',
  },
  {
    key: 'clipboard',
    title: 'Clipboard',
    description: 'Paste recipe link',
    status: 'ready',
  },
];

function UploadIcon({ action, color }: { action: UploadActionKey; color: string }) {
  switch (action) {
    case 'manual-food':
      return <Package size={18} color={color} strokeWidth={2} />;
    case 'barcode':
      return <Barcode size={18} color={color} strokeWidth={2} />;
    case 'receipt-photo':
      return <FileText size={18} color={color} strokeWidth={2} />;
    case 'grocery-photo':
      return <Camera size={18} color={color} strokeWidth={2} />;
    case 'expiration-photo':
      return <Calendar size={18} color={color} strokeWidth={2} />;
    case 'recipe-ingredients':
      return <BookOpen size={18} color={color} strokeWidth={2} />;
    case 'clipboard':
      return <Clipboard size={18} color={color} strokeWidth={2} />;
  }
}

function UploadActionCard({
  action,
  onPress,
}: {
  action: (typeof UPLOAD_ACTIONS)[number];
  onPress: () => void;
}) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.uploadCard,
        { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.82 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.uploadIcon, { backgroundColor: `${tc.accent}1A` }]}>
        <UploadIcon action={action.key} color={tc.accent} />
      </View>
      <View style={styles.uploadText}>
        <Text style={[styles.uploadTitle, { color: tc.text }]} numberOfLines={1}>
          {t(action.title)}
        </Text>
        <Text style={[styles.uploadDescription, { color: tc.textTertiary }]} numberOfLines={1}>
          {t(action.description)}
        </Text>
      </View>
      {action.status === 'soon' && (
        <View style={[styles.soonPill, { backgroundColor: tc.surface }]}>
          <Text style={[styles.soonPillText, { color: tc.textTertiary }]}>{t('Soon')}</Text>
        </View>
      )}
    </Pressable>
  );
}


function RecipeCard({ recipe, onPress }: { recipe: SavedRecipeListItem; onPress: () => void }) {
  const tc = useThemeColors();
  const theme = useTheme();
  const totalTime = recipe.total_time_mins ?? (recipe.prep_time_mins ?? 0) + (recipe.cook_time_mins ?? 0);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.recipeCard,
        { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
        pressed && { opacity: 0.84, transform: [{ scale: 0.99 }] },
      ]}
      onPress={onPress}
    >
      <View style={styles.recipeMedia}>
        <MediaSlot
          kind="recipe"
          uri={recipe.image_uri}
          label={recipe.title}
          meta="Recipe media"
          compact
          aspectRatio={1}
        />
      </View>
      <View style={styles.recipeBody}>
        <View style={styles.recipeTitleRow}>
          <Text style={[styles.recipeTitle, { color: tc.text }]} numberOfLines={1}>
            {recipe.title}
          </Text>
          {recipe.grocery_flagged === 1 && (
            <View style={[styles.groceryBadge, { backgroundColor: `${tc.accent}24` }]}>
              <ShoppingBasket size={12} color={tc.accent} strokeWidth={2.3} />
            </View>
          )}
        </View>
        <Text style={[styles.recipeMeta, { color: tc.textTertiary }]} numberOfLines={1}>
          {recipe.ingredient_count} ingredients / {recipe.step_count} steps
          {totalTime > 0 ? ` / ${totalTime} min` : ''}
        </Text>
      </View>
      {recipe.is_favorite === 1 && <Heart size={16} color={tc.primaryContainer} fill={tc.primaryContainer} strokeWidth={0} />}
      <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
    </Pressable>
  );
}

function UseNextPromptCard({ prompt, onPress }: { prompt: UseNextRecipePrompt; onPress: () => void }) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const statusLabel = prompt.promptStatus === 'ready_to_cook'
    ? t('Ready')
    : prompt.promptStatus === 'needs_more'
      ? t('Needs more')
      : t('Check units');
  const statusColor = prompt.promptStatus === 'ready_to_cook'
    ? tc.accent
    : prompt.promptStatus === 'needs_more'
      ? tc.primaryContainer
      : tc.textSecondary;
  const statusCopy = prompt.promptStatus === 'ready_to_cook'
    ? t('Ready to cook with expiring batches')
    : prompt.promptStatus === 'needs_more'
      ? t('Uses expiring items but needs more')
      : t('Uses expiring items with units to verify');
  const items = prompt.useNextBatches
    .map((batch) => {
      const timing = batch.daysLeft == null
        ? ''
        : ` ${batch.daysLeft < 0 ? t('expired') : t('in')} ${formatNumber(Math.abs(batch.daysLeft))}d`;
      if (batch.sufficiencyStatus === 'insufficient' && batch.quantityNeeded !== null) {
        return `${batch.pantryItemName}${timing}: ${t('need')} ${formatNumber(batch.quantityNeeded)} ${batch.neededUnit ?? ''}, ${t('have')} ${batch.quantityAvailable === null ? t('unknown') : formatNumber(batch.quantityAvailable)} ${batch.availableUnit ?? ''}`.trim();
      }
      if (batch.sufficiencyStatus === 'sufficient') {
        return `${batch.pantryItemName}${timing}: ${t('enough')}`;
      }
      return `${batch.pantryItemName}${timing}: ${t('check quantity')}`;
    })
    .join(' / ');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.promptCard,
        { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
        pressed && { opacity: 0.84, transform: [{ scale: 0.99 }] },
      ]}
      onPress={onPress}
    >
      <View style={[styles.promptIcon, { backgroundColor: `${tc.primaryContainer}1F` }]}>
        <Calendar size={18} color={tc.primaryContainer} strokeWidth={2} />
      </View>
      <View style={styles.promptBody}>
        <Text style={[styles.promptTitle, { color: tc.text }]} numberOfLines={1}>
          {prompt.recipe.title}
        </Text>
        <Text style={[styles.promptStatusCopy, { color: statusColor }]} numberOfLines={1}>
          {statusCopy}
        </Text>
        <Text style={[styles.promptMeta, { color: tc.textTertiary }]} numberOfLines={2}>
          {items || t('Use-next ingredients')}
        </Text>
      </View>
      <View style={[styles.promptStatusPill, { backgroundColor: `${statusColor}20` }]}>
        <Text style={[styles.promptStatusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
      <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
    </Pressable>
  );
}

const TIME_LIMIT_OPTIONS: ReadonlyArray<{ label: string; minutes: number | null }> = [
  { label: 'Any', minutes: null },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '60 min', minutes: 60 },
  { label: '90 min', minutes: 90 },
];

interface SavedRecipeFacets {
  ingredients: string[];
  cuisines: string[];
  maxTimeMins: number | null;
  favoritedOnly: boolean;
}

const EMPTY_FACETS: SavedRecipeFacets = {
  ingredients: [],
  cuisines: [],
  maxTimeMins: null,
  favoritedOnly: false,
};

function runSavedRecipeSearch(
  db: ReturnType<typeof useDatabase>,
  query: string,
  facets: SavedRecipeFacets,
): SavedRecipeListItem[] {
  const rows: SavedRecipeSearchRow[] = searchSavedRecipes(db, {
    title: query,
    ingredients: facets.ingredients,
    cuisines: facets.cuisines,
    maxTimeMins: facets.maxTimeMins,
    favoritedOnly: facets.favoritedOnly,
  });
  // SavedRecipeSearchRow is row-shape compatible with SavedRecipeListItem.
  return rows as unknown as SavedRecipeListItem[];
}

export default function KitchenScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<'pantry' | 'grocery'>('pantry');
  const [stats, setStats] = useState<KitchenStats>(() => getKitchenStats(db));
  const [facets, setFacets] = useState<SavedRecipeFacets>(EMPTY_FACETS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [recipes, setRecipes] = useState<SavedRecipeListItem[]>(() => runSavedRecipeSearch(db, '', EMPTY_FACETS));
  const [useNextPrompts, setUseNextPrompts] = useState<UseNextRecipePrompt[]>(() => getKitchenUseNextRecipePrompts(db));
  const [refreshing, setRefreshing] = useState(false);
  const [availableIngredients, setAvailableIngredients] = useState<string[]>(() => listDistinctSavedRecipeIngredients(db));
  const [availableCuisines, setAvailableCuisines] = useState<string[]>(() => listDistinctSavedRecipeCuisines(db));

  const load = useCallback(() => {
    setStats(getKitchenStats(db));
    setRecipes(runSavedRecipeSearch(db, query, facets));
    setUseNextPrompts(getKitchenUseNextRecipePrompts(db));
    setAvailableIngredients(listDistinctSavedRecipeIngredients(db));
    setAvailableCuisines(listDistinctSavedRecipeCuisines(db));
  }, [db, query, facets]);

  useFocusEffect(load);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    setRefreshing(false);
  }, [load]);

  const onSearchChange = (value: string) => {
    setQuery(value);
    setRecipes(runSavedRecipeSearch(db, value, facets));
  };

  const updateFacets = (next: SavedRecipeFacets) => {
    setFacets(next);
    setRecipes(runSavedRecipeSearch(db, query, next));
  };

  const toggleIngredientFacet = (value: string) => {
    const lower = value.toLowerCase();
    const exists = facets.ingredients.some((entry) => entry.toLowerCase() === lower);
    const ingredients = exists
      ? facets.ingredients.filter((entry) => entry.toLowerCase() !== lower)
      : [...facets.ingredients, value];
    updateFacets({ ...facets, ingredients });
  };

  const toggleCuisineFacet = (value: string) => {
    const lower = value.toLowerCase();
    const exists = facets.cuisines.some((entry) => entry.toLowerCase() === lower);
    const cuisines = exists
      ? facets.cuisines.filter((entry) => entry.toLowerCase() !== lower)
      : [...facets.cuisines, value];
    updateFacets({ ...facets, cuisines });
  };

  const setMaxTimeFacet = (value: number | null) => {
    updateFacets({ ...facets, maxTimeMins: value });
  };

  const toggleFavoritedFacet = () => {
    updateFacets({ ...facets, favoritedOnly: !facets.favoritedOnly });
  };

  const clearFacets = () => {
    updateFacets(EMPTY_FACETS);
  };

  const activeFacetCount = useMemo(
    () => facets.ingredients.length + facets.cuisines.length + (facets.maxTimeMins ? 1 : 0) + (facets.favoritedOnly ? 1 : 0),
    [facets],
  );

  const openUploadAction = (action: UploadActionKey) => {
    switch (action) {
      case 'manual-food':
        router.push('/pantry');
        return;
      case 'recipe-ingredients':
        router.push('/recipes/new');
        return;
      case 'barcode':
        router.push('/kitchen-barcode');
        return;
      case 'receipt-photo':
        router.push('/kitchen-receipt');
        return;
      case 'grocery-photo':
        router.push('/kitchen-photo');
        return;
      case 'expiration-photo':
        router.push('/expiration-photo');
        return;
      case 'clipboard':
        router.push('/kitchen-paste-recipe');
        return;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <KitchenSliderShell surface="kitchen">
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.accent} />}
          showsVerticalScrollIndicator={false}
        >
          <KitchenHeaderCard
            pantryCount={stats.pantryCount}
            groceryCount={stats.groceryFlaggedCount}
          />

          <KitchenSegmentedControl active={section} onChange={setSection} />

          <View style={styles.actionGrid}>
            <Pressable
              style={({ pressed }) => [styles.primaryAction, { backgroundColor: tc.accent }, pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] }]}
              onPress={() => section === 'pantry' ? router.push('/pantry') : router.push('/grocery')}
            >
              {section === 'pantry'
                ? <Package size={18} color={tc.background} strokeWidth={2.5} />
                : <ShoppingBasket size={18} color={tc.background} strokeWidth={2.5} />
              }
              <Text style={[styles.primaryActionText, { color: tc.background }]}>
                {section === 'pantry' ? t('Pantry') : t('Grocery Lists')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryAction,
                { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
                pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] },
              ]}
              onPress={() => router.push('/recipes/new')}
            >
              <Plus size={18} color={tc.accent} strokeWidth={2} />
              <Text style={[styles.secondaryActionText, { color: tc.accent }]}>{t('Add Recipe')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryAction,
                { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
                pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] },
              ]}
              onPress={() => section === 'pantry' ? router.push('/grocery') : router.push('/pantry')}
            >
              {section === 'pantry'
                ? <ShoppingBasket size={18} color={tc.accent} strokeWidth={2} />
                : <Package size={18} color={tc.accent} strokeWidth={2} />
              }
              <Text style={[styles.secondaryActionText, { color: tc.accent }]}>
                {section === 'pantry' ? t('Grocery Lists') : t('Pantry')}
              </Text>
            </Pressable>
          </View>

        {useNextPrompts.length > 0 ? (
          <View style={styles.promptSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: tc.text }]}>{t('Use Next')}</Text>
              <Text style={[styles.sectionCount, { color: tc.textTertiary }]}>{formatNumber(useNextPrompts.length)}</Text>
            </View>
            <View style={styles.recipeList}>
              {useNextPrompts.map((prompt) => (
                <UseNextPromptCard
                  key={prompt.recipe.recipeId}
                  prompt={prompt}
                  onPress={() => router.push(`/saved-recipe/${prompt.recipe.recipeId}`)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.uploadSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: tc.text }]}>{t('Add Food')}</Text>
            <Text style={[styles.sectionCount, { color: tc.textTertiary }]}>{t('Upload Hub')}</Text>
          </View>
          <View style={styles.uploadGrid}>
            {UPLOAD_ACTIONS.map((action) => (
              <UploadActionCard
                key={action.key}
                action={action}
                onPress={() => openUploadAction(action.key)}
              />
            ))}
          </View>
        </View>

        <View style={[styles.searchBar, { backgroundColor: tc.surface }]}>
          <Search size={18} color={tc.textSecondary} strokeWidth={2} />
          <TextInput
            style={[styles.searchInput, { color: tc.text }]}
            placeholder={t('Search saved recipes')}
            placeholderTextColor={tc.textTertiary}
            value={query}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={({ pressed }) => [
              styles.filterToggle,
              { backgroundColor: filtersOpen || activeFacetCount > 0 ? `${tc.accent}24` : tc.background },
              pressed && { opacity: 0.78 },
            ]}
            onPress={() => setFiltersOpen((open) => !open)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Filters')}
          >
            <Filter
              size={16}
              color={activeFacetCount > 0 ? tc.accent : tc.textSecondary}
              strokeWidth={2}
            />
            {activeFacetCount > 0 && (
              <Text style={[styles.filterToggleCount, { color: tc.accent }]}>{activeFacetCount}</Text>
            )}
          </Pressable>
        </View>

        {filtersOpen && (
          <View style={[styles.filterPanel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            {availableIngredients.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: tc.textSecondary }]}>
                  {t('kitchen_filter_ingredients')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
                  {availableIngredients.slice(0, 24).map((ingredient) => {
                    const active = facets.ingredients.some((entry) => entry.toLowerCase() === ingredient.toLowerCase());
                    return (
                      <Pressable
                        key={`ing-${ingredient}`}
                        style={({ pressed }) => [
                          styles.facetChip,
                          { backgroundColor: tc.surface, borderColor: theme.glass.cardBorder },
                          active && { backgroundColor: `${tc.accent}24`, borderColor: tc.accent },
                          pressed && { opacity: 0.78 },
                        ]}
                        onPress={() => toggleIngredientFacet(ingredient)}
                      >
                        <Text style={[styles.facetChipText, { color: active ? tc.accent : tc.textSecondary }]}>
                          {ingredient}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {availableCuisines.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: tc.textSecondary }]}>
                  {t('kitchen_filter_cuisine')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
                  {availableCuisines.map((cuisine) => {
                    const active = facets.cuisines.some((entry) => entry.toLowerCase() === cuisine.toLowerCase());
                    return (
                      <Pressable
                        key={`cui-${cuisine}`}
                        style={({ pressed }) => [
                          styles.facetChip,
                          { backgroundColor: tc.surface, borderColor: theme.glass.cardBorder },
                          active && { backgroundColor: `${tc.accent}24`, borderColor: tc.accent },
                          pressed && { opacity: 0.78 },
                        ]}
                        onPress={() => toggleCuisineFacet(cuisine)}
                      >
                        <Text style={[styles.facetChipText, { color: active ? tc.accent : tc.textSecondary }]}>
                          {cuisine}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.filterGroup}>
              <Text style={[styles.filterGroupTitle, { color: tc.textSecondary }]}>
                {t('kitchen_filter_time')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
                {TIME_LIMIT_OPTIONS.map((option) => {
                  const active = facets.maxTimeMins === option.minutes;
                  return (
                    <Pressable
                      key={`time-${option.label}`}
                      style={({ pressed }) => [
                        styles.facetChip,
                        { backgroundColor: tc.surface, borderColor: theme.glass.cardBorder },
                        active && { backgroundColor: `${tc.accent}24`, borderColor: tc.accent },
                        pressed && { opacity: 0.78 },
                      ]}
                      onPress={() => setMaxTimeFacet(option.minutes)}
                    >
                      <Text style={[styles.facetChipText, { color: active ? tc.accent : tc.textSecondary }]}>
                        {t(option.label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.filterFooter}>
              <Pressable
                style={({ pressed }) => [
                  styles.facetChip,
                  { backgroundColor: tc.surface, borderColor: theme.glass.cardBorder },
                  facets.favoritedOnly && { backgroundColor: `${tc.accent}24`, borderColor: tc.accent },
                  pressed && { opacity: 0.78 },
                ]}
                onPress={toggleFavoritedFacet}
              >
                <Heart
                  size={12}
                  color={facets.favoritedOnly ? tc.accent : tc.textSecondary}
                  strokeWidth={2}
                />
                <Text style={[styles.facetChipText, { color: facets.favoritedOnly ? tc.accent : tc.textSecondary, marginLeft: 6 }]}>
                  {t('kitchen_filter_favorited')}
                </Text>
              </Pressable>
              {activeFacetCount > 0 && (
                <Pressable
                  style={({ pressed }) => [
                    styles.facetClear,
                    pressed && { opacity: 0.78 },
                  ]}
                  onPress={clearFacets}
                  hitSlop={6}
                >
                  <X size={14} color={tc.textSecondary} strokeWidth={2} />
                  <Text style={[styles.facetClearText, { color: tc.textSecondary }]}>{t('Clear all')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: tc.text }]}>{t('Saved Recipes')}</Text>
          <Text style={[styles.sectionCount, { color: tc.textTertiary }]}>{formatNumber(recipes.length)}</Text>
        </View>

        {recipes.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <Star size={28} color={tc.textTertiary} strokeWidth={1.6} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>
              {activeFacetCount > 0 || query.length > 0 ? t('No matching recipes') : t('No saved recipes yet')}
            </Text>
            <Text style={[styles.emptyBody, { color: tc.textSecondary }]}>
              {activeFacetCount > 0 || query.length > 0
                ? t('Try clearing a filter or broadening your search.')
                : t('Create your first private recipe, then flag it for a grocery list.')}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyButton, { backgroundColor: tc.accent }, pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] }]}
              onPress={() => (activeFacetCount > 0 ? clearFacets() : router.push('/recipes/new'))}
            >
              <Text style={[styles.emptyButtonText, { color: tc.background }]}>
                {activeFacetCount > 0 ? t('Clear all') : t('Add Recipe')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.recipeList}>
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() => router.push(`/saved-recipe/${recipe.id}`)}
              />
            ))}
          </View>
        )}
        </ScrollView>
      </KitchenSliderShell>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { paddingHorizontal: 24, paddingBottom: 36, gap: 22 },
  actionGrid: { gap: 10 },
  primaryAction: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryActionText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  secondaryAction: { minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryActionText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  promptSection: { gap: 12 },
  promptCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  promptIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  promptBody: { flex: 1, gap: 4 },
  promptTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  promptStatusCopy: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },
  promptMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },
  promptStatusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  promptStatusText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 10 },
  uploadSection: { gap: 12 },
  uploadGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  uploadCard: { width: '48%', minHeight: 86, borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  uploadIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  uploadText: { gap: 2 },
  uploadTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  uploadDescription: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10 },
  soonPill: { position: 'absolute', top: 10, right: 10, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  soonPillText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 9 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontFamily: JAKARTA_FONTS.regular, fontSize: 15, padding: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  sectionCount: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  recipeList: { gap: 10 },
  recipeCard: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recipeMedia: { width: 68 },
  recipeBody: { flex: 1, gap: 4 },
  recipeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recipeTitle: { flex: 1, fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  recipeMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
  groceryBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyState: { borderWidth: 1, borderRadius: 18, padding: 22, alignItems: 'center', gap: 12 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  emptyBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyButton: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
  emptyButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  filterToggleCount: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },
  filterPanel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  filterGroup: { gap: 8 },
  filterGroupTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  filterChipRow: { gap: 8, paddingRight: 8 },
  facetChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  facetChipText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  filterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  facetClear: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  facetClearText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
});
