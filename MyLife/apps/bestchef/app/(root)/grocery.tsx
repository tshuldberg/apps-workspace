import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Archive,
  BookOpen,
  Calendar,
  Camera,
  Check,
  Circle,
  Copy,
  Image as ImageIcon,
  MoreHorizontal,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  ShoppingBasket,
  Store,
  Trash2,
  X,
} from 'lucide-react-native';
import { JAKARTA_FONTS, type GrocerySection, type ShoppingListFilter } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { KitchenSliderShell } from './components/KitchenSliderShell';
import { useDatabase } from './providers/DatabaseProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { useI18n } from './i18n/I18nProvider';
import { HealthSummary } from './components/HealthSummary';
import { MediaSlot } from './components/MediaSlot';
import { NutritionPanel } from './components/NutritionPanel';
import {
  addGroceryFlaggedRecipesToList,
  addManualGroceryItem,
  addSavedRecipeToList,
  addShoppingListMedia,
  archiveShoppingList,
  copyCheckedGroceryItemsToPantry,
  createNamedShoppingList,
  duplicateShoppingListEntry,
  getGroceryListBundle,
  getSavedRecipes,
  removeGroceryListItem,
  removeSavedRecipeFromList,
  removeShoppingList,
  removeShoppingListMedia,
  restoreShoppingList,
  toggleGroceryItem,
  updateGroceryListItemText,
  updateShoppingListDetails,
  type GroceryListBundle,
  type KitchenShoppingListItemRow,
  type SavedRecipeListItem,
} from './data/kitchen';
import { BackArrow } from './components/DirectionalIcons';

const SECTION_LABELS: Record<GrocerySection, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat',
  pantry: 'Pantry',
  frozen: 'Frozen',
  bakery: 'Bakery',
  beverages: 'Beverages',
  snacks: 'Snacks',
  condiments: 'Condiments',
  other: 'Other',
};

const FILTERS: Array<{ key: ShoppingListFilter; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
];

type GroceryItemGroup =
  | {
    id: string;
    kind: 'recipe';
    recipeId: string;
    title: string;
    minSortOrder: number;
    items: KitchenShoppingListItemRow[];
  }
  | {
    id: string;
    kind: 'section';
    section: GrocerySection;
    minSortOrder: number;
    items: KitchenShoppingListItemRow[];
  };

function itemDraftText(item: KitchenShoppingListItemRow): string {
  return [item.quantity ?? null, item.unit, item.item].filter(Boolean).join(' ');
}

function groupItems(items: KitchenShoppingListItemRow[]): GroceryItemGroup[] {
  const recipeGroups = new Map<string, GroceryItemGroup & { kind: 'recipe' }>();
  const sectionGroups = new Map<GrocerySection, GroceryItemGroup & { kind: 'section' }>();

  for (const item of items) {
    if (item.recipe_id) {
      const existing = recipeGroups.get(item.recipe_id);
      if (existing) {
        existing.items.push(item);
        existing.minSortOrder = Math.min(existing.minSortOrder, item.sort_order);
      } else {
        recipeGroups.set(item.recipe_id, {
          id: `recipe-${item.recipe_id}`,
          kind: 'recipe',
          recipeId: item.recipe_id,
          title: item.recipe_title ?? 'Recipe items',
          minSortOrder: item.sort_order,
          items: [item],
        });
      }
      continue;
    }

    const existing = sectionGroups.get(item.grocery_section);
    if (existing) {
      existing.items.push(item);
      existing.minSortOrder = Math.min(existing.minSortOrder, item.sort_order);
    } else {
      sectionGroups.set(item.grocery_section, {
        id: `section-${item.grocery_section}`,
        kind: 'section',
        section: item.grocery_section,
        minSortOrder: item.sort_order,
        items: [item],
      });
    }
  }

  return [...recipeGroups.values(), ...sectionGroups.values()].sort((a, b) => {
    if (a.minSortOrder !== b.minSortOrder) return a.minSortOrder - b.minSortOrder;
    const titleA = a.kind === 'recipe' ? a.title : SECTION_LABELS[a.section];
    const titleB = b.kind === 'recipe' ? b.title : SECTION_LABELS[b.section];
    return titleA.localeCompare(titleB);
  });
}

export default function GroceryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const [listFilter, setListFilter] = useState<ShoppingListFilter>('active');
  const [bundle, setBundle] = useState<GroceryListBundle>(() => getGroceryListBundle(db, undefined, 'active'));
  const [selectedListId, setSelectedListId] = useState<string | undefined>(bundle.selectedList?.id);
  const [newListName, setNewListName] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [draftName, setDraftName] = useState(bundle.selectedList?.name ?? '');
  const [draftStoreName, setDraftStoreName] = useState(bundle.selectedList?.store_name ?? '');
  const [draftEventName, setDraftEventName] = useState(bundle.selectedList?.event_name ?? '');
  const [draftEventDate, setDraftEventDate] = useState(bundle.selectedList?.event_date ?? '');
  const [openNutritionItemId, setOpenNutritionItemId] = useState<string | null>(null);
  const [recipePickerOpen, setRecipePickerOpen] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [mediaViewer, setMediaViewer] = useState<{ photos: string[]; title: string; index: number } | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);

  const listMedia = bundle.selectedList?.media_uris ?? [];

  const syncListDraft = useCallback((list: GroceryListBundle['selectedList']) => {
    setDraftName(list?.name ?? '');
    setDraftStoreName(list?.store_name ?? '');
    setDraftEventName(list?.event_name ?? '');
    setDraftEventDate(list?.event_date ?? '');
  }, []);

  const load = useCallback((nextSelectedId = selectedListId, nextFilter = listFilter) => {
    const next = getGroceryListBundle(db, nextSelectedId, nextFilter);
    setBundle(next);
    setSelectedListId(next.selectedList?.id);
    syncListDraft(next.selectedList);
  }, [db, listFilter, selectedListId, syncListDraft]);

  useFocusEffect(
    useCallback(() => {
      load(selectedListId, listFilter);
    }, [listFilter, load, selectedListId]),
  );

  const groupedItems = useMemo(() => groupItems(bundle.items), [bundle.items]);
  const recipeOptions = useMemo(() => getSavedRecipes(db, recipeSearch), [db, recipeSearch, bundle.items.length]);
  const checkedCount = bundle.items.filter((item) => item.is_checked === 1).length;

  const handleCreateList = () => {
    const list = createNamedShoppingList(db, newListName || 'Grocery List');
    setNewListName('');
    setListFilter('active');
    load(list.id, 'active');
  };

  const handleFilterChange = (filter: ShoppingListFilter) => {
    setListFilter(filter);
    load(selectedListId, filter);
  };

  const handleAddItem = () => {
    if (!bundle.selectedList || !newItemText.trim()) return;
    addManualGroceryItem(db, bundle.selectedList.id, newItemText);
    setNewItemText('');
    load(bundle.selectedList.id);
  };

  const handleAddFlagged = () => {
    if (!bundle.selectedList) return;
    const count = addGroceryFlaggedRecipesToList(db, bundle.selectedList.id);
    load(bundle.selectedList.id);
    Alert.alert(
      t('Grocery flags added'),
      count > 0
        ? t('{count} flagged recipes were added to {listName}.', { count, listName: bundle.selectedList.name })
        : t('No flagged recipes with ingredients were ready to add.'),
    );
  };

  const addRecipeToSelectedList = (recipe: SavedRecipeListItem) => {
    if (!bundle.selectedList) return;
    addSavedRecipeToList(db, recipe.id, bundle.selectedList.id);
    setRecipePickerOpen(false);
    setRecipeSearch('');
    load(bundle.selectedList.id);
    Alert.alert(
      t('Recipe added'),
      t('{recipeName} ingredients were added to {listName}.', {
        recipeName: recipe.title,
        listName: bundle.selectedList.name,
      }),
    );
  };

  const handleSelectRecipe = (recipe: SavedRecipeListItem) => {
    if (!bundle.selectedList) return;
    if (recipe.ingredient_count === 0) {
      Alert.alert(t('No ingredients'), t('{recipeName} has no ingredients to add yet.', { recipeName: recipe.title }));
      return;
    }

    const alreadyAdded = bundle.items.some((item) => item.recipe_id === recipe.id);
    if (!alreadyAdded) {
      addRecipeToSelectedList(recipe);
      return;
    }

    Alert.alert(
      t('Recipe already on list'),
      t('Replace the existing {recipeName} items with a fresh copy from the saved recipe?', { recipeName: recipe.title }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Replace'),
          onPress: () => addRecipeToSelectedList(recipe),
        },
      ],
    );
  };

  const handleRemoveRecipeGroup = (recipeId: string, recipeTitle: string) => {
    if (!bundle.selectedList) return;
    const listId = bundle.selectedList.id;
    Alert.alert(
      t('Remove recipe from list?'),
      t('This removes every grocery item added from {recipeName}.', { recipeName: recipeTitle }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: () => {
            removeSavedRecipeFromList(db, recipeId, listId);
            setOpenNutritionItemId(null);
            setEditingItemId(null);
            load(listId);
          },
        },
      ],
    );
  };

  const handleCopyToPantry = () => {
    if (!bundle.selectedList) return;
    const count = copyCheckedGroceryItemsToPantry(db, bundle.selectedList.id);
    load(bundle.selectedList.id);
    Alert.alert(t('Pantry updated'), t('{count} checked items were copied to pantry.', { count }));
  };

  const handleSaveListDetails = () => {
    if (!bundle.selectedList) return;
    updateShoppingListDetails(db, bundle.selectedList.id, {
      name: draftName,
      store_name: draftStoreName,
      event_name: draftEventName,
      event_date: draftEventDate,
    });
    load(bundle.selectedList.id);
  };

  const handleDuplicateList = () => {
    if (!bundle.selectedList) return;
    const copied = duplicateShoppingListEntry(db, bundle.selectedList.id, `${bundle.selectedList.name} Copy`);
    if (!copied) return;
    setListFilter('active');
    load(copied.id, 'active');
    Alert.alert(t('List duplicated'), t('{listName} is ready as a new active list.', { listName: copied.name }));
  };

  const handleArchiveRestore = () => {
    if (!bundle.selectedList) return;
    if (bundle.selectedList.is_active === 1) {
      archiveShoppingList(db, bundle.selectedList.id);
      load(undefined, listFilter);
    } else {
      restoreShoppingList(db, bundle.selectedList.id);
      setListFilter('active');
      load(bundle.selectedList.id, 'active');
    }
  };

  const handleDeleteList = () => {
    if (!bundle.selectedList) return;
    const list = bundle.selectedList;
    Alert.alert(
      t('Delete grocery list?'),
      t('This removes the list and all items in it.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => {
            removeShoppingList(db, list.id);
            load(undefined);
          },
        },
      ],
    );
  };

  const handleItemActions = (item: KitchenShoppingListItemRow) => {
    const listId = bundle.selectedList?.id;
    Alert.alert(
      item.item,
      t('Choose what to do with this grocery item.'),
      [
        {
          text: item.is_checked === 1 ? t('Mark Unchecked') : t('Mark Checked'),
          onPress: () => {
            toggleGroceryItem(db, item.id);
            load(listId);
          },
        },
        {
          text: t('Edit Item'),
          onPress: () => {
            setEditingItemId(item.id);
            setEditingItemText(itemDraftText(item));
          },
        },
        {
          text: openNutritionItemId === item.id ? t('Hide Nutrition') : t('Nutrition Details'),
          onPress: () => setOpenNutritionItemId((current) => current === item.id ? null : item.id),
        },
        {
          text: t('Delete Item'),
          style: 'destructive',
          onPress: () => {
            removeGroceryListItem(db, item.id);
            setOpenNutritionItemId((current) => current === item.id ? null : current);
            load(listId);
          },
        },
        { text: t('Cancel'), style: 'cancel' },
      ],
    );
  };

  const handleAddListPhoto = () => {
    const list = bundle.selectedList;
    if (!list || mediaBusy) return;
    Alert.alert(
      t('Add list photo'),
      t('Choose a source for the reference photo.'),
      [
        {
          text: t('Camera'),
          onPress: () => void pickListPhoto('camera'),
        },
        {
          text: t('Library'),
          onPress: () => void pickListPhoto('library'),
        },
        { text: t('Cancel'), style: 'cancel' },
      ],
    );
  };

  const pickListPhoto = async (source: 'camera' | 'library') => {
    const list = bundle.selectedList;
    if (!list) return;
    try {
      setMediaBusy(true);
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('Photo access needed'), t('BestChef needs photo access to attach reference photos.'));
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
      if (result.canceled || !result.assets[0]) return;
      addShoppingListMedia(db, list.id, result.assets[0].uri);
      load(list.id);
    } finally {
      setMediaBusy(false);
    }
  };

  const handleViewListMedia = (index: number) => {
    const list = bundle.selectedList;
    if (!list || list.media_uris.length === 0) return;
    setMediaViewer({ photos: list.media_uris, title: list.name, index });
  };

  const handleRemoveListMedia = (uri: string) => {
    const list = bundle.selectedList;
    if (!list) return;
    Alert.alert(
      t('Remove this photo?'),
      t('The reference photo will be detached from this list.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: () => {
            removeShoppingListMedia(db, list.id, uri);
            load(list.id);
          },
        },
      ],
    );
  };

  const handleSaveItemEdit = () => {
    if (!bundle.selectedList || !editingItemId) return;
    if (!editingItemText.trim()) {
      Alert.alert(t('Item required'), t('Enter a grocery item before saving.'));
      return;
    }
    updateGroceryListItemText(db, editingItemId, editingItemText);
    const listId = bundle.selectedList.id;
    setEditingItemId(null);
    setEditingItemText('');
    load(listId);
  };

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <KitchenSliderShell surface="grocery">
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('Back')}
          >
            <BackArrow size={24} color={tc.text} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Grocery Lists')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.createRow, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <TextInput
            style={[styles.createInput, { color: tc.text }]}
            value={newListName}
            onChangeText={setNewListName}
            placeholder={t('New list name')}
            placeholderTextColor={tc.textTertiary}
          />
          <Pressable
            style={({ pressed }) => [
              styles.createButton,
              { backgroundColor: tc.accent },
              pressed && { transform: [{ scale: 0.96 }], opacity: 0.82 },
            ]}
            onPress={handleCreateList}
            accessibilityRole="button"
            accessibilityLabel={t('Create grocery list')}
          >
            <Plus size={18} color={tc.background} strokeWidth={2.5} />
          </Pressable>
        </View>

        {bundle.lists.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listTabs}>
            {bundle.lists.map((list) => (
              <Pressable
                key={list.id}
                style={({ pressed }) => [
                  styles.listTab,
                  { backgroundColor: tc.surface },
                  bundle.selectedList?.id === list.id && { backgroundColor: `${tc.accent}24` },
                  list.is_active === 0 && { opacity: 0.55 },
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.82 },
                ]}
                onPress={() => load(list.id)}
              >
                <Text style={[styles.listTabText, { color: bundle.selectedList?.id === list.id ? tc.accent : tc.textSecondary }]}>
                  {list.name}
                </Text>
                {(list.store_name || list.event_name) && (
                  <Text style={[styles.listTabMeta, { color: tc.textTertiary }]} numberOfLines={1}>
                    {[list.store_name, list.event_name].filter(Boolean).join(' / ')}
                  </Text>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={[styles.filterBar, { backgroundColor: tc.surface }]}>
          {FILTERS.map((filter) => {
            const count = filter.key === 'active'
              ? bundle.activeLists.length
              : filter.key === 'archived'
                ? bundle.archivedLists.length
                : bundle.activeLists.length + bundle.archivedLists.length;
            const selected = listFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                style={({ pressed }) => [
                  styles.filterButton,
                  selected && { backgroundColor: `${tc.accent}24` },
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.82 },
                ]}
                onPress={() => handleFilterChange(filter.key)}
              >
                <Text style={[styles.filterText, { color: selected ? tc.accent : tc.textSecondary }]}>
                  {t(filter.label)} {formatNumber(count)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!bundle.selectedList ? (
          <View style={[styles.emptyState, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <ShoppingBasket size={28} color={tc.textTertiary} strokeWidth={1.6} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>
              {listFilter === 'archived' ? t('No archived lists') : t('No grocery lists yet')}
            </Text>
            <Text style={[styles.emptyBody, { color: tc.textSecondary }]}>
              {listFilter === 'archived'
                ? t('Archived lists will appear here after a shopping trip is finished.')
                : t('Create a list, add custom items, or pull in all recipes flagged for grocery.')}
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.summaryCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
              <View style={styles.summaryMediaRow}>
                <View style={styles.summaryMedia}>
                  <MediaSlot
                    kind="receipt"
                    uri={listMedia[0]}
                    label={bundle.selectedList.name}
                    meta="Receipt thumbnail"
                    compact
                    aspectRatio={4 / 3}
                    onPress={listMedia.length > 0 ? () => handleViewListMedia(0) : handleAddListPhoto}
                  />
                </View>
                <View style={styles.summaryCopy}>
                  <Text style={[styles.summaryEyebrow, { color: tc.accent }]}>{t('Kitchen slider')}</Text>
                  <Text style={[styles.summaryCopyText, { color: tc.textSecondary }]}>
                    {t('Receipts, food photos, and recipe pulls stay attached as media evidence when those flows provide an image.')}
                  </Text>
                </View>
              </View>
              <View style={styles.mediaStripRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaStrip}>
                  {listMedia.map((uri, index) => (
                    <Pressable
                      key={`${uri}-${index}`}
                      style={({ pressed }) => [
                        styles.mediaThumb,
                        { backgroundColor: tc.surface, borderColor: theme.glass.cardBorder },
                        pressed && { opacity: 0.78, transform: [{ scale: 0.97 }] },
                      ]}
                      onPress={() => handleViewListMedia(index)}
                      onLongPress={() => handleRemoveListMedia(uri)}
                      accessibilityRole="button"
                      accessibilityLabel={t('Open list photo')}
                    >
                      <Image source={{ uri }} style={styles.mediaThumbImage} contentFit="cover" />
                    </Pressable>
                  ))}
                  <Pressable
                    style={({ pressed }) => [
                      styles.mediaAddButton,
                      { backgroundColor: `${tc.accent}1A`, borderColor: `${tc.accent}55` },
                      mediaBusy && { opacity: 0.55 },
                      pressed && !mediaBusy && { opacity: 0.78, transform: [{ scale: 0.97 }] },
                    ]}
                    onPress={handleAddListPhoto}
                    disabled={mediaBusy}
                    accessibilityRole="button"
                    accessibilityLabel={t('+ Photo')}
                  >
                    <Camera size={16} color={tc.accent} strokeWidth={2.4} />
                    <Text style={[styles.mediaAddButtonText, { color: tc.accent }]}>{t('+ Photo')}</Text>
                  </Pressable>
                </ScrollView>
              </View>
              <View style={styles.summaryHeader}>
                <View>
                  <Text style={[styles.summaryTitle, { color: tc.text }]}>{bundle.selectedList.name}</Text>
                  <Text style={[styles.summaryMeta, { color: tc.textTertiary }]}>
                    {formatNumber(bundle.summary?.checkedItems ?? 0)} / {formatNumber(bundle.summary?.totalItems ?? 0)} {t('checked')}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: bundle.selectedList.is_active === 1 ? `${tc.accent}24` : tc.surface }]}>
                  <Text style={[styles.statusText, { color: bundle.selectedList.is_active === 1 ? tc.accent : tc.textTertiary }]}>
                    {bundle.selectedList.is_active === 1 ? t('Active') : t('Archived')}
                  </Text>
                </View>
              </View>
              <View style={styles.detailEditor}>
                <TextInput
                  style={[styles.detailInput, { backgroundColor: tc.surface, color: tc.text }]}
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder={t('List name')}
                  placeholderTextColor={tc.textTertiary}
                />
                <View style={styles.detailRow}>
                  <View style={[styles.detailIcon, { backgroundColor: `${tc.accent}1A` }]}>
                    <Store size={14} color={tc.accent} strokeWidth={2} />
                  </View>
                  <TextInput
                    style={[styles.detailInput, styles.detailInputFlex, { backgroundColor: tc.surface, color: tc.text }]}
                    value={draftStoreName}
                    onChangeText={setDraftStoreName}
                    placeholder={t('Store, optional')}
                    placeholderTextColor={tc.textTertiary}
                  />
                </View>
                <View style={styles.detailRow}>
                  <View style={[styles.detailIcon, { backgroundColor: `${tc.accent}1A` }]}>
                    <Calendar size={14} color={tc.accent} strokeWidth={2} />
                  </View>
                  <TextInput
                    style={[styles.detailInput, styles.detailInputFlex, { backgroundColor: tc.surface, color: tc.text }]}
                    value={draftEventName}
                    onChangeText={setDraftEventName}
                    placeholder={t('Event, optional')}
                    placeholderTextColor={tc.textTertiary}
                  />
                  <TextInput
                    style={[styles.dateInput, { backgroundColor: tc.surface, color: tc.text }]}
                    value={draftEventDate}
                    onChangeText={setDraftEventDate}
                    placeholder={t('Date')}
                    placeholderTextColor={tc.textTertiary}
                  />
                </View>
              </View>
              <View style={styles.summaryActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.smallButton,
                    { backgroundColor: `${tc.accent}1A` },
                    pressed && { transform: [{ scale: 0.98 }], opacity: 0.82 },
                  ]}
                  onPress={() => setRecipePickerOpen((value) => !value)}
                >
                  <BookOpen size={14} color={tc.accent} strokeWidth={2} />
                  <Text style={[styles.smallButtonText, { color: tc.accent }]}>{t('Add Recipe')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.smallButton,
                    { backgroundColor: `${tc.accent}1A` },
                    pressed && { transform: [{ scale: 0.98 }], opacity: 0.82 },
                  ]}
                  onPress={handleSaveListDetails}
                >
                  <Save size={14} color={tc.accent} strokeWidth={2} />
                  <Text style={[styles.smallButtonText, { color: tc.accent }]}>{t('Save')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.smallButton,
                    { backgroundColor: `${tc.accent}1A` },
                    pressed && { transform: [{ scale: 0.98 }], opacity: 0.82 },
                  ]}
                  onPress={handleDuplicateList}
                >
                  <Copy size={14} color={tc.accent} strokeWidth={2} />
                  <Text style={[styles.smallButtonText, { color: tc.accent }]}>{t('Duplicate')}</Text>
                </Pressable>
              </View>
              <View style={styles.summaryActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.smallButton,
                    { backgroundColor: `${tc.accent}1A` },
                    pressed && { transform: [{ scale: 0.98 }], opacity: 0.82 },
                  ]}
                  onPress={handleAddFlagged}
                >
                  <RefreshCw size={14} color={tc.accent} strokeWidth={2} />
                  <Text style={[styles.smallButtonText, { color: tc.accent }]}>
                    {t('Add Flags')} ({bundle.flaggedRecipes.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.smallButton,
                    { backgroundColor: `${tc.accent}1A` },
                    checkedCount === 0 && { opacity: 0.45 },
                    pressed && checkedCount > 0 && { transform: [{ scale: 0.98 }], opacity: 0.82 },
                  ]}
                  onPress={handleCopyToPantry}
                  disabled={checkedCount === 0}
                >
                  <PackagePlus size={14} color={tc.accent} strokeWidth={2} />
                  <Text style={[styles.smallButtonText, { color: tc.accent }]}>{t('To Pantry')}</Text>
                </Pressable>
              </View>
            </View>

            {recipePickerOpen && (
              <View style={[styles.recipePickerCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
                <View style={styles.recipePickerHeader}>
                  <View>
                    <Text style={[styles.recipePickerTitle, { color: tc.text }]}>{t('Add a recipe')}</Text>
                    <Text style={[styles.recipePickerMeta, { color: tc.textTertiary }]}>
                      {t('Saved recipes are inserted as grouped grocery items.')}
                    </Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.pickerCloseButton,
                      { backgroundColor: `${tc.accent}14` },
                      pressed && { transform: [{ scale: 0.94 }], opacity: 0.78 },
                    ]}
                    onPress={() => setRecipePickerOpen(false)}
                    accessibilityRole="button"
                    accessibilityLabel={t('Close recipe picker')}
                  >
                    <X size={17} color={tc.accent} strokeWidth={2.4} />
                  </Pressable>
                </View>
                <TextInput
                  style={[styles.recipeSearchInput, { backgroundColor: tc.surface, color: tc.text }]}
                  value={recipeSearch}
                  onChangeText={setRecipeSearch}
                  placeholder={t('Search saved recipes')}
                  placeholderTextColor={tc.textTertiary}
                />
                {recipeOptions.length === 0 ? (
                  <View style={[styles.recipePickerEmpty, { backgroundColor: tc.surface }]}>
                    <Text style={[styles.recipePickerEmptyTitle, { color: tc.text }]}>{t('No saved recipes found')}</Text>
                    <Text style={[styles.recipePickerEmptyBody, { color: tc.textSecondary }]}>
                      {t('Create a recipe in Kitchen, then add it to this list.')}
                    </Text>
                  </View>
                ) : (
                  recipeOptions.map((recipe) => {
                    const alreadyAdded = bundle.items.some((item) => item.recipe_id === recipe.id);
                    return (
                      <Pressable
                        key={recipe.id}
                        style={({ pressed }) => [
                          styles.recipeOption,
                          { backgroundColor: tc.surface },
                          pressed && { transform: [{ scale: 0.99 }], opacity: 0.82 },
                        ]}
                        onPress={() => handleSelectRecipe(recipe)}
                      >
                        <View style={[styles.recipeOptionIcon, { backgroundColor: `${tc.accent}1A` }]}>
                          <BookOpen size={16} color={tc.accent} strokeWidth={2} />
                        </View>
                        <View style={styles.recipeOptionBody}>
                          <Text style={[styles.recipeOptionTitle, { color: tc.text }]} numberOfLines={1}>
                            {recipe.title}
                          </Text>
                          <Text style={[styles.recipeOptionMeta, { color: tc.textTertiary }]} numberOfLines={1}>
                            {formatNumber(recipe.ingredient_count)} {t('ingredients')}
                            {recipe.step_count > 0 ? ` / ${formatNumber(recipe.step_count)} ${t('steps')}` : ''}
                          </Text>
                        </View>
                        {alreadyAdded && (
                          <View style={[styles.recipeAddedPill, { backgroundColor: `${tc.accent}24` }]}>
                            <Text style={[styles.recipeAddedPillText, { color: tc.accent }]}>{t('Added')}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}

            <View style={[styles.addItemRow, { backgroundColor: tc.surface }]}>
              <TextInput
                style={[styles.addItemInput, { color: tc.text }]}
                value={newItemText}
                onChangeText={setNewItemText}
                placeholder={t('Add custom item, e.g. 2 cups flour')}
                placeholderTextColor={tc.textTertiary}
                onSubmitEditing={handleAddItem}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.addItemButton,
                  { backgroundColor: tc.accent },
                  pressed && { transform: [{ scale: 0.96 }], opacity: 0.82 },
                ]}
                onPress={handleAddItem}
                accessibilityRole="button"
                accessibilityLabel={t('Add grocery item')}
              >
                <Plus size={18} color={tc.background} strokeWidth={2.5} />
              </Pressable>
            </View>

            {bundle.items.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
                <ShoppingBasket size={28} color={tc.textTertiary} strokeWidth={1.6} />
                <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No items on this list')}</Text>
                <Text style={[styles.emptyBody, { color: tc.textSecondary }]}>
                  {t('Add a custom item or use Add Flags to pull ingredients from flagged recipes.')}
                </Text>
              </View>
            ) : (
              groupedItems.map((group) => {
                const groupTitle = group.kind === 'recipe' ? group.title : t(SECTION_LABELS[group.section]);
                const groupMeta = group.kind === 'recipe'
                  ? t('Recipe pull / {count} items', { count: group.items.length })
                  : t('Custom items / {count} items', { count: group.items.length });
                return (
                <View key={group.id} style={styles.section}>
                  <View style={styles.groupHeaderRow}>
                    <View style={styles.groupHeaderCopy}>
                      <Text style={[styles.sectionTitle, { color: tc.text }]} numberOfLines={1}>
                        {groupTitle}
                      </Text>
                      <Text style={[styles.groupMeta, { color: tc.textTertiary }]} numberOfLines={1}>
                        {groupMeta}
                      </Text>
                    </View>
                    {group.kind === 'recipe' && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.recipeGroupRemoveButton,
                          { backgroundColor: `${tc.danger}18` },
                          pressed && { transform: [{ scale: 0.94 }], opacity: 0.78 },
                        ]}
                        onPress={() => handleRemoveRecipeGroup(group.recipeId, group.title)}
                        accessibilityRole="button"
                        accessibilityLabel={t('Remove recipe from grocery list')}
                      >
                        <Trash2 size={15} color={tc.danger} strokeWidth={2.2} />
                      </Pressable>
                    )}
                  </View>
                  <View style={[styles.itemCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
                    {group.items.map((item) => (
                      <View key={item.id} style={styles.groceryItemBlock}>
                        <View style={styles.itemRow}>
                          <Pressable
                            style={({ pressed }) => [
                              styles.itemToggleArea,
                              pressed && { transform: [{ scale: 0.99 }], opacity: 0.78 },
                            ]}
                            onPress={() => {
                              toggleGroceryItem(db, item.id);
                              load(bundle.selectedList?.id);
                            }}
                          >
                            {item.is_checked === 1
                              ? <Check size={20} color={tc.accent} strokeWidth={2.6} />
                              : <Circle size={20} color={tc.textTertiary} strokeWidth={2} />
                            }
                            <View style={styles.itemMedia}>
                              <MediaSlot
                                kind={item.recipe_id ? 'recipe' : 'receipt'}
                                label={item.item}
                                meta={item.recipe_id ? 'Recipe item' : 'List item'}
                                compact
                                aspectRatio={1}
                              />
                            </View>
                            <View style={styles.itemBody}>
                              <Text style={[styles.itemName, { color: item.is_checked ? tc.textTertiary : tc.text }, item.is_checked === 1 && styles.checkedText]}>
                                {item.item}
                              </Text>
                              <Text style={[styles.itemMeta, { color: tc.textTertiary }]}>
                                {[item.quantity ?? null, item.unit].filter(Boolean).join(' ') || (item.recipe_id ? t('Review quantity') : t('No quantity'))}
                                {` / ${t(SECTION_LABELS[item.grocery_section])}`}
                              </Text>
                            </View>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [
                              styles.itemMenuButton,
                              { backgroundColor: `${tc.accent}14` },
                              pressed && { transform: [{ scale: 0.94 }], opacity: 0.78 },
                            ]}
                            onPress={() => handleItemActions(item)}
                            accessibilityRole="button"
                            accessibilityLabel={t('Open grocery item actions')}
                          >
                            <MoreHorizontal size={18} color={tc.accent} strokeWidth={2.4} />
                          </Pressable>
                        </View>
                        {editingItemId === item.id && (
                          <View style={[styles.itemEditRow, { backgroundColor: tc.surface }]}>
                            <TextInput
                              style={[styles.itemEditInput, { color: tc.text }]}
                              value={editingItemText}
                              onChangeText={setEditingItemText}
                              placeholder={t('Item, quantity, and unit')}
                              placeholderTextColor={tc.textTertiary}
                              onSubmitEditing={handleSaveItemEdit}
                              autoFocus
                            />
                            <Pressable
                              style={({ pressed }) => [
                                styles.itemEditButton,
                                { backgroundColor: tc.accent },
                                pressed && { transform: [{ scale: 0.94 }], opacity: 0.82 },
                              ]}
                              onPress={handleSaveItemEdit}
                              accessibilityRole="button"
                              accessibilityLabel={t('Save grocery item edit')}
                            >
                              <Check size={16} color={tc.background} strokeWidth={2.5} />
                            </Pressable>
                            <Pressable
                              style={({ pressed }) => [
                                styles.itemEditButton,
                                { backgroundColor: `${tc.accent}18` },
                                pressed && { transform: [{ scale: 0.94 }], opacity: 0.82 },
                              ]}
                              onPress={() => {
                                setEditingItemId(null);
                                setEditingItemText('');
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={t('Cancel grocery item edit')}
                            >
                              <X size={16} color={tc.accent} strokeWidth={2.5} />
                            </Pressable>
                          </View>
                        )}
                        <HealthSummary
                          detail={item.nutritionDetail}
                          compact
                          onPressDetails={() => setOpenNutritionItemId((current) => current === item.id ? null : item.id)}
                        />
                        {openNutritionItemId === item.id ? <NutritionPanel detail={item.nutritionDetail} compact /> : null}
                      </View>
                    ))}
                  </View>
                </View>
                );
              })
            )}

            <View style={styles.listFooterActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.footerAction,
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.78 },
                ]}
                onPress={handleArchiveRestore}
              >
                <Archive size={15} color={tc.accent} strokeWidth={2} />
                <Text style={[styles.footerActionText, { color: tc.accent }]}>
                  {bundle.selectedList.is_active === 1 ? t('Archive List') : t('Restore List')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.footerAction,
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.78 },
                ]}
                onPress={handleDeleteList}
              >
                <Trash2 size={15} color={tc.danger} strokeWidth={2} />
                <Text style={[styles.footerActionText, { color: tc.danger }]}>{t('Delete List')}</Text>
              </Pressable>
            </View>
          </>
        )}
        </ScrollView>
      </KitchenSliderShell>
      <GroceryMediaCarouselModal
        visible={mediaViewer !== null}
        photos={mediaViewer?.photos ?? []}
        title={mediaViewer?.title ?? ''}
        initialIndex={mediaViewer?.index ?? 0}
        onClose={() => setMediaViewer(null)}
      />
    </View>
  );
}

function GroceryMediaCarouselModal({
  visible,
  photos,
  title,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  photos: string[];
  title: string;
  initialIndex: number;
  onClose: () => void;
}) {
  const tc = useThemeColors();
  const { t, formatNumber } = useI18n();
  const screenWidth = Dimensions.get('window').width;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[viewerStyles.backdrop, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
        <View style={viewerStyles.header}>
          <Text style={[viewerStyles.title, { color: tc.text }]} numberOfLines={1}>{title}</Text>
          <Pressable
            style={({ pressed }) => [
              viewerStyles.closeButton,
              { backgroundColor: `${tc.accent}24` },
              pressed && { opacity: 0.78, transform: [{ scale: 0.95 }] },
            ]}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('Close')}
          >
            <X size={20} color={tc.accent} strokeWidth={2.4} />
          </Pressable>
        </View>
        {photos.length === 0 ? (
          <View style={viewerStyles.empty}>
            <Text style={[viewerStyles.emptyText, { color: tc.textSecondary }]}>{t('Image unavailable')}</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const next = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
              setCurrentIndex(next);
            }}
            contentOffset={{ x: initialIndex * screenWidth, y: 0 }}
          >
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={[viewerStyles.page, { width: screenWidth }]}>
                {uri.startsWith('http') || uri.startsWith('file') || uri.startsWith('content') || uri.startsWith('asset') ? (
                  <Image source={{ uri }} style={viewerStyles.image} contentFit="contain" />
                ) : (
                  <Text style={[viewerStyles.emptyText, { color: tc.textSecondary }]}>{t('Image unavailable')}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        )}
        {photos.length > 1 ? (
          <View style={viewerStyles.footer}>
            <Text style={[viewerStyles.counter, { color: tc.textSecondary }]}>
              {formatNumber(currentIndex + 1)} / {formatNumber(photos.length)}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const viewerStyles = StyleSheet.create({
  backdrop: { flex: 1 },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  footer: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  counter: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { minHeight: 92, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  content: { paddingHorizontal: 24, paddingBottom: 136, gap: 16 },
  createRow: { borderWidth: 1, borderRadius: 16, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  createInput: { flex: 1, fontFamily: JAKARTA_FONTS.medium, fontSize: 14, paddingHorizontal: 8 },
  createButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  listTabs: { gap: 8, paddingVertical: 2 },
  listTab: { minWidth: 112, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  listTabText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  listTabMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10, maxWidth: 160 },
  filterBar: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4 },
  filterButton: { flex: 1, minHeight: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  summaryCard: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 16 },
  summaryMediaRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  summaryMedia: { width: 112 },
  mediaStripRow: { gap: 8 },
  mediaStrip: { gap: 10, alignItems: 'center', paddingVertical: 2 },
  mediaThumb: { width: 64, height: 64, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  mediaThumbImage: { width: '100%', height: '100%' },
  mediaAddButton: { minHeight: 64, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mediaAddButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  summaryCopy: { flex: 1, justifyContent: 'center', gap: 5 },
  summaryEyebrow: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 11 },
  summaryCopyText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 17 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 22 },
  summaryMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 0 },
  detailEditor: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  detailInput: { minHeight: 42, borderRadius: 13, paddingHorizontal: 12, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  detailInputFlex: { flex: 1 },
  dateInput: { width: 92, minHeight: 42, borderRadius: 13, paddingHorizontal: 10, fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  summaryActions: { flexDirection: 'row', gap: 10 },
  smallButton: { flex: 1, minHeight: 40, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  smallButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  recipePickerCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  recipePickerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  recipePickerTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 17 },
  recipePickerMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 17, marginTop: 3 },
  pickerCloseButton: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recipeSearchInput: { minHeight: 42, borderRadius: 13, paddingHorizontal: 12, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  recipePickerEmpty: { borderRadius: 14, padding: 14, gap: 5 },
  recipePickerEmptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  recipePickerEmptyBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 17 },
  recipeOption: { minHeight: 58, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recipeOptionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recipeOptionBody: { flex: 1, gap: 3 },
  recipeOptionTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
  recipeOptionMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
  recipeAddedPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  recipeAddedPillText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10 },
  addItemRow: { borderRadius: 16, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addItemInput: { flex: 1, fontFamily: JAKARTA_FONTS.medium, fontSize: 14, paddingHorizontal: 8 },
  addItemButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyState: { borderWidth: 1, borderRadius: 18, padding: 22, alignItems: 'center', gap: 12 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  emptyBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  section: { gap: 9 },
  groupHeaderRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  groupHeaderCopy: { flex: 1, gap: 2 },
  sectionTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 15 },
  groupMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
  recipeGroupRemoveButton: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemCard: { borderWidth: 1, borderRadius: 18, padding: 10, gap: 2 },
  groceryItemBlock: { gap: 8, paddingBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  itemToggleArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemMenuButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemMedia: { width: 48 },
  itemBody: { flex: 1, gap: 3 },
  itemName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  checkedText: { textDecorationLine: 'line-through' },
  itemMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
  itemEditRow: { minHeight: 48, borderRadius: 14, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemEditInput: { flex: 1, minHeight: 36, paddingHorizontal: 8, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  itemEditButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  listFooterActions: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingTop: 8 },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  footerActionText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
});
