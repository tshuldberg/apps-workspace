import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  BookOpen,
  CheckCircle2,
  ChefHat,
  Clock,
  Heart,
  PackagePlus,
  Pencil,
  Plus,
  Share2,
  ShoppingBasket,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import {
  addSavedRecipeMedia,
  getSavedRecipeMedia,
  JAKARTA_FONTS,
  removeSavedRecipeMedia,
  reorderSavedRecipeMedia,
  type SavedRecipeMediaRow,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { KitchenSliderShell } from '../components/KitchenSliderShell';
import { useDatabase } from '../providers/DatabaseProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { HealthSummary } from '../components/HealthSummary';
import { MediaSlot } from '../components/MediaSlot';
import { NutritionPanel } from '../components/NutritionPanel';
import { SavedRecipeMediaGallery } from '../components/SavedRecipeMediaGallery';
import {
  addIngredientAvailabilityRowsToGroceryList,
  addSavedRecipeToList,
  addCookReviewIngredientToPantry,
  applySavedRecipeCookReview,
  ensureShoppingList,
  getGroceryListBundle,
  getSavedRecipeIngredientAvailability,
  getSavedRecipeDetails,
  getSavedRecipeCookReview,
  removeSavedRecipe,
  setSavedRecipeGroceryFlag,
  toggleRecipeFavorite,
  type GroceryListBundle,
  type IngredientAvailabilityRow,
  type IngredientAvailabilitySummary,
  type KitchenRecipeCookReview,
  type SavedRecipeDetails,
} from '../data/kitchen';
import {
  buildSavedRecipePlainText,
  buildSavedRecipePrintHtml,
  savedRecipeAttribution,
} from '../data/recipe-export';
import { BackArrow } from '../components/DirectionalIcons';

function formatTime(minutes: number | null): string {
  if (!minutes) return '';
  return `${minutes} min`;
}

function formatCookDate(value: string): string {
  return value.slice(0, 10);
}

function formatDraftQuantity(value: number | null): string {
  if (value === null) return '';
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

function parseDraftQuantity(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

let printModulePromise: Promise<typeof import('expo-print')> | null = null;

function loadPrintModule(): Promise<typeof import('expo-print')> {
  printModulePromise ??= import('expo-print');
  return printModulePromise;
}

type CookDraft = Record<string, { quantity: string; unit: string }>;

function createCookDraft(review: KitchenRecipeCookReview): CookDraft {
  return Object.fromEntries(review.items.map((item) => [
    item.ingredientId,
    {
      quantity: formatDraftQuantity(item.suggestedDecrementQuantity),
      unit: item.suggestedDecrementUnit ?? item.ingredientUnit ?? item.pantryUnit ?? '',
    },
  ]));
}

function availabilityStatusLabel(status: IngredientAvailabilityRow['status']): string {
  switch (status) {
    case 'in-pantry':
      return 'In pantry';
    case 'low':
      return 'Low';
    case 'expired':
      return 'Expired';
    case 'missing':
      return 'Missing';
  }
}

export default function SavedRecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const [details, setDetails] = useState<SavedRecipeDetails | null>(null);
  const [bundle, setBundle] = useState<GroceryListBundle>(() => getGroceryListBundle(db));
  const [showRecipeNutrition, setShowRecipeNutrition] = useState(false);
  const [openIngredientNutritionId, setOpenIngredientNutritionId] = useState<string | null>(null);
  const [cookReview, setCookReview] = useState<KitchenRecipeCookReview | null>(null);
  const [cookDraft, setCookDraft] = useState<CookDraft>({});
  const [availability, setAvailability] = useState<IngredientAvailabilitySummary | null>(null);
  const [showMissingListPicker, setShowMissingListPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mediaGallery, setMediaGallery] = useState<SavedRecipeMediaRow[]>([]);

  const load = useCallback(() => {
    const nextDetails = id ? getSavedRecipeDetails(db, id) : null;
    setDetails(nextDetails);
    setAvailability(nextDetails ? getSavedRecipeIngredientAvailability(db, id) : null);
    setBundle(getGroceryListBundle(db));
    setMediaGallery(id ? getSavedRecipeMedia(db, id) : []);
  }, [db, id]);

  useFocusEffect(load);

  if (!details) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('Back')}
          >
            <BackArrow size={24} color={tc.text} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('Saved recipe not found')}</Text>
        </View>
      </View>
    );
  }

  const { recipe, ingredients, steps, groceryFlagged } = details;
  const totalTime = recipe.total_time_mins ?? (recipe.prep_time_mins ?? 0) + (recipe.cook_time_mins ?? 0);
  const activeLists = bundle.lists.filter((list) => list.is_active === 1);
  const sourceChefLabel = recipe.source_chef_handle ? `@${recipe.source_chef_handle}` : recipe.source_chef_name;
  const sourceAttribution = recipe.source_submission_id && sourceChefLabel
    ? t('Saved from {chefName}', { chefName: sourceChefLabel })
    : null;
  const getAvailabilityBadgeColors = (status: IngredientAvailabilityRow['status']) => {
    switch (status) {
      case 'in-pantry':
        return { color: tc.accent, backgroundColor: `${tc.accent}1F`, borderColor: `${tc.accent}55` };
      case 'low':
        return { color: tc.primaryContainer, backgroundColor: `${tc.primaryContainer}24`, borderColor: `${tc.primaryContainer}55` };
      case 'expired':
        return { color: tc.danger, backgroundColor: `${tc.danger}1F`, borderColor: `${tc.danger}55` };
      case 'missing':
        return { color: tc.textTertiary, backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder };
    }
  };

  const handleToggleFavorite = () => {
    toggleRecipeFavorite(db, recipe.id);
    load();
  };

  const handleToggleGrocery = () => {
    setSavedRecipeGroceryFlag(db, recipe.id, !groceryFlagged);
    load();
  };

  const handleEdit = () => {
    router.push({ pathname: '/recipes/new', params: { recipeId: recipe.id } });
  };

  const handleAddMedia = useCallback(
    (uri: string) => {
      // Optimistic add: show before reload to avoid the gap.
      const optimistic: SavedRecipeMediaRow = {
        id: `pending-${Date.now()}`,
        recipe_id: recipe.id,
        uri,
        sort_order: mediaGallery.length,
        created_at: new Date().toISOString(),
      };
      setMediaGallery((current) => [...current, optimistic]);
      try {
        addSavedRecipeMedia(db, { recipeId: recipe.id, uri });
      } finally {
        setMediaGallery(getSavedRecipeMedia(db, recipe.id));
      }
    },
    [db, mediaGallery.length, recipe.id],
  );

  const handleRemoveMedia = useCallback(
    (mediaId: string) => {
      setMediaGallery((current) => current.filter((row) => row.id !== mediaId));
      try {
        removeSavedRecipeMedia(db, { id: mediaId });
      } finally {
        setMediaGallery(getSavedRecipeMedia(db, recipe.id));
      }
    },
    [db, recipe.id],
  );

  const handleReplaceMedia = useCallback(
    (mediaId: string, uri: string) => {
      removeSavedRecipeMedia(db, { id: mediaId });
      addSavedRecipeMedia(db, { recipeId: recipe.id, uri });
      setMediaGallery(getSavedRecipeMedia(db, recipe.id));
    },
    [db, recipe.id],
  );

  const handleReorderMedia = useCallback(
    (orderedIds: string[]) => {
      reorderSavedRecipeMedia(db, { recipeId: recipe.id, orderedIds });
      setMediaGallery(getSavedRecipeMedia(db, recipe.id));
    },
    [db, recipe.id],
  );

  const exportDetails = { recipe, ingredients, steps };

  const handlePrintRecipe = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const Print = await loadPrintModule();
      await Print.printAsync({
        html: buildSavedRecipePrintHtml(exportDetails),
      });
    } catch (err) {
      Alert.alert(t('Export failed'), err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleSharePdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const Print = await loadPrintModule();
      const file = await Print.printToFileAsync({
        html: buildSavedRecipePrintHtml(exportDetails),
      });
      await Share.share({
        title: recipe.title,
        url: file.uri,
        message: `${recipe.title}\n${savedRecipeAttribution(recipe)}`,
      });
    } catch (err) {
      Alert.alert(t('Export failed'), err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleSharePlainText = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await Share.share({
        title: recipe.title,
        message: buildSavedRecipePlainText(exportDetails),
      });
    } catch (err) {
      Alert.alert(t('Export failed'), err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    Alert.alert(
      t('Export Recipe'),
      t('Choose a format for this saved recipe.'),
      [
        { text: t('Print / Save PDF'), onPress: () => { void handlePrintRecipe(); } },
        { text: t('Share PDF'), onPress: () => { void handleSharePdf(); } },
        { text: t('Plain Text'), onPress: () => { void handleSharePlainText(); } },
        { text: t('Cancel'), style: 'cancel' },
      ],
    );
  };

  const handleAddToList = (listId?: string) => {
    const list = listId ? bundle.lists.find((item) => item.id === listId) : ensureShoppingList(db);
    if (!list) return;
    addSavedRecipeToList(db, recipe.id, list.id);
    setBundle(getGroceryListBundle(db, list.id));
    Alert.alert(t('Added to grocery list'), t('Recipe ingredients were added to {listName}.', { listName: list.name }));
  };

  const handleAddMissingToList = (listId?: string) => {
    if (!availability || availability.shoppingNeededCount === 0) return;
    const list = listId ? bundle.lists.find((item) => item.id === listId) : ensureShoppingList(db);
    if (!list) return;
    const count = addIngredientAvailabilityRowsToGroceryList(db, list.id, availability.rows, recipe.id);
    setShowMissingListPicker(false);
    setBundle(getGroceryListBundle(db, list.id));
    Alert.alert(t('Added to grocery list'), t('{count} missing ingredients were added to {listName}.', {
      count,
      listName: list.name,
    }));
  };

  const openCookReview = () => {
    const review = getSavedRecipeCookReview(db, recipe.id);
    if (!review) {
      Alert.alert(t('Cook review unavailable'), t('This recipe could not be loaded for pantry review.'));
      return;
    }
    setCookReview(review);
    setCookDraft(createCookDraft(review));
  };

  const refreshCookReview = () => {
    const review = getSavedRecipeCookReview(db, recipe.id);
    if (!review) return;
    setCookReview(review);
    setCookDraft(createCookDraft(review));
  };

  const updateCookDraft = (ingredientId: string, updates: Partial<{ quantity: string; unit: string }>) => {
    setCookDraft((current) => ({
      ...current,
      [ingredientId]: {
        quantity: current[ingredientId]?.quantity ?? '',
        unit: current[ingredientId]?.unit ?? '',
        ...updates,
      },
    }));
  };

  const handleAddCookIngredientToPantry = (ingredientId: string) => {
    addCookReviewIngredientToPantry(db, recipe.id, ingredientId);
    refreshCookReview();
  };

  const handleApplyCookReview = () => {
    if (!cookReview) return;
    const decrements = cookReview.items.flatMap((item) => {
      if (!item.pantryItemId) return [];
      const draft = cookDraft[item.ingredientId];
      const quantity = parseDraftQuantity(draft?.quantity ?? '');
      if (quantity === null) return [];
      return [{
        ingredientId: item.ingredientId,
        pantryItemId: item.pantryItemId,
        quantity,
        unit: draft?.unit.trim() || null,
      }];
    });

    const result = applySavedRecipeCookReview(db, {
      recipeId: recipe.id,
      servings: cookReview.servings,
      cookedAt: cookReview.cookedAt,
      decrements,
    });
    setCookReview(null);
    setCookDraft({});
    load();
    Alert.alert(
      t('Cooked recipe logged'),
      t('{count} pantry items were updated.', { count: result.updatedPantryItems.length }),
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t('Delete saved recipe?'),
      t('This removes the private recipe and any grocery flag. Existing grocery list items stay unchanged.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => {
            removeSavedRecipe(db, recipe.id);
            router.replace('/(tabs)/kitchen');
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <KitchenSliderShell surface="recipe" sourceLabel={recipe.title}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('Back')}
          >
            <BackArrow size={24} color={tc.text} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: tc.text }]} numberOfLines={1}>
            {recipe.title}
          </Text>
          <View style={styles.topActions}>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
              onPress={handleEdit}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('Edit saved recipe')}
            >
              <Pencil size={21} color={tc.textSecondary} strokeWidth={2.1} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
              onPress={handleToggleFavorite}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={recipe.is_favorite ? t('Remove favorite') : t('Mark favorite')}
            >
              <Heart
                size={22}
                color={recipe.is_favorite ? tc.primaryContainer : tc.textSecondary}
                fill={recipe.is_favorite ? tc.primaryContainer : 'transparent'}
                strokeWidth={2}
              />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <MediaSlot
              kind="recipe"
              uri={mediaGallery[0]?.uri ?? recipe.image_uri}
              label={recipe.title}
              meta="Saved recipe media"
            />
            <SavedRecipeMediaGallery
              media={mediaGallery}
              onAdd={handleAddMedia}
              onRemove={handleRemoveMedia}
              onReplace={handleReplaceMedia}
              onReorder={handleReorderMedia}
            />
            <Text style={[styles.title, { color: tc.text }]}>{recipe.title}</Text>
            {recipe.description && (
              <Text style={[styles.description, { color: tc.textSecondary }]}>{recipe.description}</Text>
            )}
            {sourceAttribution && recipe.source_submission_id ? (
              <Pressable
                style={({ pressed }) => [
                  styles.sourceLink,
                  { backgroundColor: `${tc.accent}1A`, borderColor: `${tc.accent}55` },
                  pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => router.push(`/recipe/${recipe.source_submission_id}`)}
                accessibilityRole="button"
                accessibilityLabel={t('Open original submission')}
              >
                <BookOpen size={15} color={tc.accent} strokeWidth={2.2} />
                <View style={styles.sourceTextWrap}>
                  <Text style={[styles.sourceTitle, { color: tc.accent }]}>{sourceAttribution}</Text>
                  <Text style={[styles.sourceSubtitle, { color: tc.textTertiary }]}>{t('Open original submission')}</Text>
                </View>
              </Pressable>
            ) : null}
            <View style={styles.metaRow}>
              {recipe.servings && (
                <View style={[styles.metaPill, { backgroundColor: tc.surface }]}>
                  <Users size={14} color={tc.accent} strokeWidth={2} />
                  <Text style={[styles.metaText, { color: tc.textSecondary }]}>{recipe.servings}</Text>
                </View>
              )}
              {totalTime > 0 && (
                <View style={[styles.metaPill, { backgroundColor: tc.surface }]}>
                  <Clock size={14} color={tc.accent} strokeWidth={2} />
                  <Text style={[styles.metaText, { color: tc.textSecondary }]}>{formatTime(totalTime)}</Text>
                </View>
              )}
              {recipe.difficulty && (
                <View style={[styles.metaPill, { backgroundColor: tc.surface }]}>
                  <Star size={14} color={tc.accent} strokeWidth={2} />
                  <Text style={[styles.metaText, { color: tc.textSecondary }]}>{t(recipe.difficulty)}</Text>
                </View>
              )}
              {details.cookHistory[0] && (
                <View style={[styles.metaPill, { backgroundColor: tc.surface }]}>
                  <CheckCircle2 size={14} color={tc.accent} strokeWidth={2} />
                  <Text style={[styles.metaText, { color: tc.textSecondary }]}>
                    {t('Last cooked {date}', { date: formatCookDate(details.cookHistory[0].cooked_at) })}
                  </Text>
                </View>
              )}
            </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: groceryFlagged ? `${tc.accent}24` : theme.glass.cardFill, borderColor: groceryFlagged ? tc.accent : theme.glass.cardBorder }]}
            onPress={handleToggleGrocery}
          >
            <ShoppingBasket size={16} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.actionText, { color: tc.accent }]}>
              {groceryFlagged ? t('Grocery Flagged') : t('Flag for Grocery')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: tc.accent, borderColor: tc.accent }]}
            onPress={() => handleAddToList()}
          >
            <Plus size={16} color={tc.background} strokeWidth={2.5} />
            <Text style={[styles.actionText, { color: tc.background }]}>{t('Add to List')}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder, opacity: exporting ? 0.62 : 1 }]}
            onPress={handleExport}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel={t('Export saved recipe')}
          >
            <Share2 size={16} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.actionText, { color: tc.accent }]}>{exporting ? t('Exporting...') : t('Export')}</Text>
          </Pressable>
        </View>

        {steps.length > 0 ? (
          <Pressable
            style={({ pressed }) => [
              styles.cookButton,
              { backgroundColor: tc.accent, borderColor: tc.accent },
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push({ pathname: '/cook-mode/[id]', params: { id: recipe.id, source: 'saved' } })}
            accessibilityRole="button"
            accessibilityLabel={t('Start cook mode')}
          >
            <ChefHat size={17} color={tc.background} strokeWidth={2.4} />
            <Text style={[styles.cookButtonText, { color: tc.background }]}>{t('Start cook mode')}</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.cookButton,
            { backgroundColor: `${tc.accent}20`, borderColor: tc.accent },
            pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
          ]}
          onPress={openCookReview}
          accessibilityRole="button"
          accessibilityLabel={t('I cooked this')}
        >
          <CheckCircle2 size={17} color={tc.accent} strokeWidth={2.4} />
          <Text style={[styles.cookButtonText, { color: tc.accent }]}>{t('I cooked this')}</Text>
        </Pressable>

        {activeLists.length > 0 && (
          <View style={styles.listActions}>
            <Text style={[styles.subhead, { color: tc.text }]}>{t('Add to a list')}</Text>
            {activeLists.map((list) => (
              <Pressable
                key={list.id}
                style={[styles.listButton, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
                onPress={() => handleAddToList(list.id)}
              >
                <Text style={[styles.listButtonText, { color: tc.text }]}>{list.name}</Text>
                <ShoppingBasket size={15} color={tc.accent} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        )}

        <HealthSummary
          detail={details.nutritionDetail}
          onPressDetails={() => setShowRecipeNutrition((value) => !value)}
        />
        {showRecipeNutrition ? <NutritionPanel detail={details.nutritionDetail} /> : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: tc.text }]}>{t('Ingredients')}</Text>
          {availability ? (
            <View style={styles.availabilityHeader}>
              <Text style={[styles.availabilitySummary, { color: tc.textSecondary }]}>
                {t('You have {onHand} of {total} ingredients on hand.', {
                  onHand: availability.onHandCount,
                  total: availability.totalCount,
                })}
              </Text>
              {availability.shoppingNeededCount > 0 ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.missingButton,
                    { backgroundColor: `${tc.accent}1F`, borderColor: tc.accent },
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => setShowMissingListPicker((value) => !value)}
                  accessibilityRole="button"
                  accessibilityLabel={t('Add missing to grocery list')}
                >
                  <ShoppingBasket size={15} color={tc.accent} strokeWidth={2.2} />
                  <Text style={[styles.missingButtonText, { color: tc.accent }]}>{t('Add missing to grocery list')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {showMissingListPicker && availability && availability.shoppingNeededCount > 0 ? (
            <View style={styles.listActions}>
              <Text style={[styles.subhead, { color: tc.text }]}>{t('Choose a grocery list')}</Text>
              {activeLists.length > 0 ? activeLists.map((list) => (
                <Pressable
                  key={list.id}
                  style={[styles.listButton, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
                  onPress={() => handleAddMissingToList(list.id)}
                >
                  <Text style={[styles.listButtonText, { color: tc.text }]}>{list.name}</Text>
                  <ShoppingBasket size={15} color={tc.accent} strokeWidth={2} />
                </Pressable>
              )) : (
                <Pressable
                  style={[styles.listButton, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
                  onPress={() => handleAddMissingToList()}
                >
                  <Text style={[styles.listButtonText, { color: tc.text }]}>{t('Create Grocery List')}</Text>
                  <ShoppingBasket size={15} color={tc.accent} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          ) : null}
          <View style={[styles.listCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            {ingredients.map((ingredient) => {
              const nutritionDetail = details.ingredientNutritionDetails.find((entry) => entry.subjectId === ingredient.id);
              const availabilityRow = availability?.rows.find((row) => row.ingredientId === ingredient.id) ?? null;
              const badgeColors = availabilityRow ? getAvailabilityBadgeColors(availabilityRow.status) : null;
              return (
              <View key={ingredient.id} style={styles.ingredientBlock}>
                <View style={styles.ingredientRow}>
                  <View style={[styles.dot, { backgroundColor: tc.accent }]} />
                  <Text style={[styles.ingredientText, { color: tc.text }]}>
                    {[ingredient.quantity, ingredient.unit, ingredient.item ?? ingredient.name]
                      .filter(Boolean)
                      .join(' ')}
                  </Text>
                  {availabilityRow && badgeColors ? (
                    <View style={[styles.availabilityBadge, { backgroundColor: badgeColors.backgroundColor, borderColor: badgeColors.borderColor }]}>
                      <Text style={[styles.availabilityBadgeText, { color: badgeColors.color }]}>
                        {t(availabilityStatusLabel(availabilityRow.status))}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {availabilityRow?.note ? (
                  <Text style={[styles.availabilityNote, { color: tc.textTertiary }]}>{t(availabilityRow.note)}</Text>
                ) : null}
                {nutritionDetail ? (
                  <>
                    <HealthSummary
                      detail={nutritionDetail}
                      compact
                      onPressDetails={() => setOpenIngredientNutritionId((current) => current === ingredient.id ? null : ingredient.id)}
                    />
                    {openIngredientNutritionId === ingredient.id ? <NutritionPanel detail={nutritionDetail} compact /> : null}
                  </>
                ) : null}
              </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: tc.text }]}>{t('Instructions')}</Text>
          <View style={[styles.listCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            {steps.map((step) => (
              <View key={step.id} style={styles.stepRow}>
                <View style={[styles.stepNumber, { backgroundColor: `${tc.accent}1F` }]}>
                  <Text style={[styles.stepNumberText, { color: tc.accent }]}>{step.step_number}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.stepText, { color: tc.text }]}>{step.instruction}</Text>
                  {step.timer_minutes && (
                    <Text style={[styles.timerText, { color: tc.accent }]}>{step.timer_minutes} min timer</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Trash2 size={16} color={tc.danger} strokeWidth={2} />
          <Text style={[styles.deleteButtonText, { color: tc.danger }]}>{t('Delete Saved Recipe')}</Text>
        </Pressable>
        </ScrollView>
      </KitchenSliderShell>
      <Modal
        visible={cookReview !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setCookReview(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.cookSheet, { backgroundColor: tc.background, borderColor: theme.glass.cardBorder }]}>
            <View style={styles.cookSheetHeader}>
              <View style={styles.cookSheetTitleWrap}>
                <Text style={[styles.cookSheetTitle, { color: tc.text }]}>{t('I cooked this')}</Text>
                <Text style={[styles.cookSheetSubtitle, { color: tc.textSecondary }]}>
                  {cookReview ? t('{count} ingredients', { count: cookReview.items.length }) : ''}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.sheetCloseButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
                onPress={() => setCookReview(null)}
                accessibilityRole="button"
                accessibilityLabel={t('Close')}
                hitSlop={10}
              >
                <X size={20} color={tc.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.cookReviewList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {cookReview?.items.map((item) => {
                const draft = cookDraft[item.ingredientId] ?? { quantity: '', unit: '' };
                return (
                  <View
                    key={item.ingredientId}
                    style={[styles.cookReviewItem, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
                  >
                    <View style={styles.cookReviewTop}>
                      <View style={styles.cookReviewCopy}>
                        <Text style={[styles.cookIngredientName, { color: tc.text }]}>{item.ingredientName}</Text>
                        {item.pantryItemName ? (
                          <Text style={[styles.cookIngredientMeta, { color: tc.textTertiary }]}>
                            {t('Pantry')}: {item.pantryItemName}
                            {item.pantryQuantity !== null ? ` / ${formatDraftQuantity(item.pantryQuantity)} ${item.pantryUnit ?? ''}` : ''}
                          </Text>
                        ) : (
                          <Text style={[styles.cookIngredientMeta, { color: tc.textTertiary }]}>{t('Not tracked')}</Text>
                        )}
                      </View>
                      <View style={[styles.reviewBadge, { backgroundColor: item.pantryItemId ? `${tc.accent}1F` : `${tc.primaryContainer}24` }]}>
                        <Text style={[styles.reviewBadgeText, { color: item.pantryItemId ? tc.accent : tc.primaryContainer }]}>
                          {item.pantryItemId ? t('Matched') : t('Not tracked')}
                        </Text>
                      </View>
                    </View>

                    {item.pantryItemId ? (
                      <View style={styles.decrementEditor}>
                        <TextInput
                          style={[styles.decrementInput, { color: tc.text, backgroundColor: tc.surface }]}
                          value={draft.quantity}
                          onChangeText={(value) => updateCookDraft(item.ingredientId, { quantity: value })}
                          placeholder={t('Qty')}
                          placeholderTextColor={tc.textTertiary}
                          keyboardType="decimal-pad"
                        />
                        <TextInput
                          style={[styles.unitInput, { color: tc.text, backgroundColor: tc.surface }]}
                          value={draft.unit}
                          onChangeText={(value) => updateCookDraft(item.ingredientId, { unit: value })}
                          placeholder={t('Unit')}
                          placeholderTextColor={tc.textTertiary}
                          autoCapitalize="none"
                        />
                      </View>
                    ) : (
                      <Pressable
                        style={({ pressed }) => [
                          styles.addPantryButton,
                          { backgroundColor: `${tc.accent}1F` },
                          pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                        ]}
                        onPress={() => handleAddCookIngredientToPantry(item.ingredientId)}
                      >
                        <PackagePlus size={15} color={tc.accent} strokeWidth={2} />
                        <Text style={[styles.addPantryButtonText, { color: tc.accent }]}>{t('Add to Pantry')}</Text>
                      </Pressable>
                    )}

                    {item.note ? (
                      <Text style={[styles.reviewNote, { color: tc.textTertiary }]}>{t(item.note)}</Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.cookSheetFooter}>
              <Pressable
                style={({ pressed }) => [
                  styles.sheetSecondaryButton,
                  { backgroundColor: tc.surface },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => setCookReview(null)}
              >
                <Text style={[styles.sheetSecondaryText, { color: tc.textSecondary }]}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.sheetPrimaryButton,
                  { backgroundColor: tc.accent },
                  pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleApplyCookReview}
              >
                <Text style={[styles.sheetPrimaryText, { color: tc.background }]}>{t('Apply')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { minHeight: 92, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topBarTitle: { flex: 1, fontFamily: JAKARTA_FONTS.extraBold, fontSize: 17, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topActions: { flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: 24, paddingBottom: 136, gap: 20 },
  hero: { borderWidth: 1, borderRadius: 22, padding: 22, gap: 14 },
  title: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 26, lineHeight: 34 },
  description: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14, lineHeight: 21 },
  sourceLink: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceTextWrap: { flex: 1, gap: 2 },
  sourceTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 12 },
  sourceSubtitle: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12, textTransform: 'capitalize' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, minHeight: 50, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  cookButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cookButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  listActions: { gap: 10 },
  subhead: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  listButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  availabilityHeader: { gap: 10 },
  availabilitySummary: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, lineHeight: 19 },
  missingButton: { minHeight: 44, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  missingButtonText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 12 },
  listCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  ingredientBlock: { gap: 8 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  ingredientText: { flex: 1, fontFamily: JAKARTA_FONTS.medium, fontSize: 14, lineHeight: 21 },
  availabilityBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  availabilityBadgeText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10 },
  availabilityNote: { marginLeft: 16, fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  stepBody: { flex: 1, gap: 4 },
  stepText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14, lineHeight: 21 },
  timerText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },
  deleteButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  deleteButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.58)' },
  cookSheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 22, gap: 14 },
  cookSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cookSheetTitleWrap: { flex: 1, gap: 2 },
  cookSheetTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  cookSheetSubtitle: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  sheetCloseButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  cookReviewList: { gap: 10, paddingBottom: 4 },
  cookReviewItem: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cookReviewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cookReviewCopy: { flex: 1, gap: 4 },
  cookIngredientName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14, lineHeight: 20 },
  cookIngredientMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },
  reviewBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  reviewBadgeText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10 },
  decrementEditor: { flexDirection: 'row', gap: 8 },
  decrementInput: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  unitInput: { width: 88, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: JAKARTA_FONTS.medium, fontSize: 14 },
  addPantryButton: { minHeight: 42, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  addPantryButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  reviewNote: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },
  cookSheetFooter: { flexDirection: 'row', gap: 10 },
  sheetSecondaryButton: { flex: 1, minHeight: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetSecondaryText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  sheetPrimaryButton: { flex: 1, minHeight: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetPrimaryText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
});
