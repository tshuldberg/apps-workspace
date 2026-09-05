import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  createFoodLogEntry,
  createMenuItem,
  createRestaurant,
  getFoodLogEntries,
  getMenuItems,
  getRestaurantById,
  getRestaurants,
  getRestaurantVisitStats,
  GlassCard,
  logMenuItemAsMeal,
  MaterialSymbol,
  NU_ACCENT,
  NU_ACCENT_DARK,
  NU_ACCENT_LIGHT,
  NU_CALORIE,
  NU_FONT_BOLD,
  NU_FONT_MEDIUM,
  NU_FONT_SEMIBOLD,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  searchMenuItems,
  searchRestaurants,
  updateMenuItem,
  type MealType,
  type MenuItem,
  type RestaurantCategory,
  type RestaurantWithCount,
} from '@mylife/nutrition';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  NutritionBottomSheet,
  NutritionChip,
  NutritionEmptyState,
  NutritionFieldLabel,
  NutritionHeaderBar,
  NutritionHero,
  NutritionIconButton,
  NutritionInput,
  NutritionPrimaryButton,
  NutritionScrollScreen,
  NutritionSearchField,
  NutritionSecondaryButton,
  NutritionSectionTitle,
  useDebouncedValue,
} from './phase3-kit';

type RestaurantCategoryFilter = 'all' | RestaurantCategory;

type RestaurantDraft = {
  name: string;
  category: RestaurantCategory;
  website: string;
  logoEmoji: string;
  logoUri: string | null;
  chain: boolean;
};

type MenuDraft = {
  id: string | null;
  name: string;
  description: string;
  category: string;
  servingSize: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
};

const RESTAURANT_CATEGORY_LABELS: Record<RestaurantCategory, string> = {
  fast_food: 'Fast Food',
  casual: 'Casual',
  fine_dining: 'Fine Dining',
  cafe: 'Coffee',
  pizza: 'Pizza',
  asian: 'Asian',
  mexican: 'Mexican',
  other: 'Healthy',
};

const RESTAURANT_FILTERS: { key: RestaurantCategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fast_food', label: 'Fast Food' },
  { key: 'casual', label: 'Casual' },
  { key: 'cafe', label: 'Coffee' },
  { key: 'pizza', label: 'Pizza' },
  { key: 'asian', label: 'Asian' },
  { key: 'mexican', label: 'Mexican' },
  { key: 'other', label: 'Healthy' },
];

const MENU_CATEGORIES = ['Appetizers', 'Mains', 'Sides', 'Desserts', 'Drinks'];

const MEAL_OPTIONS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
];

const EMPTY_RESTAURANT_DRAFT: RestaurantDraft = {
  name: '',
  category: 'casual',
  website: '',
  logoEmoji: '',
  logoUri: null,
  chain: false,
};

const EMPTY_MENU_DRAFT: MenuDraft = {
  id: null,
  name: '',
  description: '',
  category: 'Mains',
  servingSize: '1 item',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fiberG: '',
};

export default function RestaurantScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const restaurantId = normalizeRouteParam(params.id);
  const isDetailMode = restaurantId != null;

  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<RestaurantCategoryFilter>('all');
  const [restaurantSheetVisible, setRestaurantSheetVisible] = useState(false);
  const [restaurantDraft, setRestaurantDraft] = useState<RestaurantDraft>(EMPTY_RESTAURANT_DRAFT);
  const [menuSearchText, setMenuSearchText] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');
  const [menuSheetVisible, setMenuSheetVisible] = useState(false);
  const [menuDraft, setMenuDraft] = useState<MenuDraft>(EMPTY_MENU_DRAFT);
  const [portionItem, setPortionItem] = useState<MenuItem | null>(null);
  const [portionCount, setPortionCount] = useState(1);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const debouncedSearch = useDebouncedValue(searchText, 200);
  const debouncedMenuSearch = useDebouncedValue(menuSearchText, 200);

  const restaurants = useMemo(() => {
    try {
      const source = debouncedSearch.trim()
        ? searchRestaurants(db, debouncedSearch).map(
            (restaurant) =>
              getRestaurantById(db, restaurant.id) ?? {
                ...restaurant,
                menuItemCount: 0,
              },
          )
        : getRestaurants(db, { limit: 250 });

      if (categoryFilter === 'all') {
        return source;
      }

      return source.filter((restaurant) => restaurant.category === categoryFilter);
    } catch {
      return [] as RestaurantWithCount[];
    }
  }, [categoryFilter, db, debouncedSearch, tick]);

  const restaurant = useMemo(() => {
    if (restaurantId == null) {
      return null;
    }

    try {
      return getRestaurantById(db, restaurantId);
    } catch {
      return null;
    }
  }, [db, restaurantId, tick]);

  const menuItems = useMemo(() => {
    if (restaurantId == null) {
      return [] as MenuItem[];
    }

    try {
      const items = debouncedMenuSearch.trim()
        ? searchMenuItems(db, debouncedMenuSearch).filter((item) => item.restaurantId === restaurantId)
        : getMenuItems(db, restaurantId);

      return items;
    } catch {
      return [] as MenuItem[];
    }
  }, [db, debouncedMenuSearch, restaurantId, tick]);

  const groupedMenuItems = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();

    for (const item of menuItems) {
      const key = item.category?.trim() || 'Menu';
      const bucket = groups.get(key);
      if (bucket == null) {
        groups.set(key, [item]);
      } else {
        bucket.push(item);
      }
    }

    return Array.from(groups.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [menuItems]);

  const visitStats = useMemo(() => {
    if (restaurant == null) {
      return null;
    }

    try {
      return getRestaurantVisitStats(db, restaurant.name);
    } catch {
      return null;
    }
  }, [db, restaurant, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleOpenRestaurant = useCallback(
    (id: string) => {
      setMenuSearchText('');
      setCollapsedCategories({});
      router.push(`/(nutrition)/restaurant?id=${id}` as never);
    },
    [router],
  );

  const handleCloseDetail = useCallback(() => {
    setMenuSearchText('');
    setCollapsedCategories({});
    router.replace('/(nutrition)/restaurant' as never);
  }, [router]);

  const handlePickLogo = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      setRestaurantDraft((draft) => ({
        ...draft,
        logoUri: result.assets[0]?.uri ?? null,
      }));
    } catch {
      Alert.alert('Image unavailable', 'Could not open your photo library.');
    }
  }, []);

  const handleSaveRestaurant = useCallback(() => {
    const name = restaurantDraft.name.trim();
    if (!name) {
      Alert.alert('Restaurant required', 'Enter a restaurant name before saving.');
      return;
    }

    try {
      createRestaurant(db, uuid(), {
        name,
        category: restaurantDraft.category,
        chain: restaurantDraft.chain,
        logoEmoji: restaurantDraft.logoEmoji.trim() || undefined,
        logoUri: restaurantDraft.logoUri ?? undefined,
        website: normalizeWebsite(restaurantDraft.website),
      });
      refresh();
      setRestaurantSheetVisible(false);
      setRestaurantDraft(EMPTY_RESTAURANT_DRAFT);
    } catch {
      Alert.alert('Save failed', 'Could not save this restaurant right now.');
    }
  }, [db, refresh, restaurantDraft]);

  const handleOpenAddMenuItem = useCallback(
    (item?: MenuItem) => {
      if (item == null) {
        setMenuDraft(EMPTY_MENU_DRAFT);
      } else {
        setMenuDraft({
          id: item.id,
          name: item.name,
          description: item.description ?? '',
          category: item.category ?? 'Mains',
          servingSize: item.servingSize ?? '1 item',
          calories: String(Math.round(item.calories)),
          proteinG: String(item.proteinG),
          carbsG: String(item.carbsG),
          fatG: String(item.fatG),
          fiberG: String(item.fiberG),
        });
      }

      setMenuSheetVisible(true);
    },
    [],
  );

  const handleSaveMenuItem = useCallback(() => {
    if (restaurant == null) {
      return;
    }

    const name = menuDraft.name.trim();
    const calories = parseNumber(menuDraft.calories);
    if (!name || calories == null) {
      Alert.alert('Item required', 'Enter a menu item name and calories before saving.');
      return;
    }

    const payload = {
      name,
      description: menuDraft.description.trim() || undefined,
      category: menuDraft.category.trim() || undefined,
      servingSize: menuDraft.servingSize.trim() || undefined,
      calories,
      proteinG: parseNumber(menuDraft.proteinG) ?? 0,
      carbsG: parseNumber(menuDraft.carbsG) ?? 0,
      fatG: parseNumber(menuDraft.fatG) ?? 0,
      fiberG: parseNumber(menuDraft.fiberG) ?? 0,
    };

    try {
      if (menuDraft.id == null) {
        createMenuItem(db, uuid(), {
          restaurantId: restaurant.id,
          ...payload,
        });
      } else {
        updateMenuItem(db, menuDraft.id, payload);
      }

      refresh();
      setMenuSheetVisible(false);
      setMenuDraft(EMPTY_MENU_DRAFT);
    } catch {
      Alert.alert('Save failed', 'Could not save this menu item.');
    }
  }, [db, menuDraft, refresh, restaurant]);

  const handleOpenPortionSheet = useCallback((item: MenuItem) => {
    setPortionItem(item);
    setPortionCount(1);
  }, []);

  const handleConfirmPortion = useCallback(() => {
    if (restaurant == null || portionItem == null) {
      return;
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      const existingEntry = getFoodLogEntries(db, today).find((entry) => entry.mealType === selectedMeal);
      const entryId = existingEntry?.id ?? uuid();

      if (existingEntry == null) {
        createFoodLogEntry(db, entryId, {
          date: today,
          mealType: selectedMeal,
          notes: `Logged from ${restaurant.name}`,
        });
      }

      logMenuItemAsMeal(
        db,
        {
          foodId: uuid(),
          logItemId: uuid(),
        },
        {
          menuItem: portionItem,
          restaurantName: restaurant.name,
          logId: entryId,
          servingCount: portionCount,
        },
      );

      setPortionItem(null);
      setPortionCount(1);
      Alert.alert('Added to meal', `${portionItem.name} was logged to ${selectedMeal}.`);
    } catch {
      Alert.alert('Log failed', 'Could not add this menu item to your meal.');
    }
  }, [db, portionCount, portionItem, restaurant, selectedMeal]);

  const toggleCategoryCollapse = useCallback((category: string) => {
    setCollapsedCategories((current) => ({
      ...current,
      [category]: !current[category],
    }));
  }, []);

  const handleOpenWebsite = useCallback(async (website: string) => {
    try {
      await Linking.openURL(website);
    } catch {
      Alert.alert('Link unavailable', 'Could not open this restaurant website.');
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <NutritionScrollScreen
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={NU_ACCENT} />}
      >
        {isDetailMode ? (
          <>
            <NutritionHeaderBar
              title="Restaurant Menu"
              onBack={handleCloseDetail}
              action={
                <NutritionIconButton
                  icon="edit"
                  label="Add item"
                  onPress={() => handleOpenAddMenuItem()}
                />
              }
            />

            {restaurant == null ? (
              <NutritionEmptyState
                icon="restaurant"
                title="Restaurant not found"
                body="The saved restaurant could not be loaded. Go back to the list and try again."
                action={<NutritionPrimaryButton label="Back to restaurants" onPress={handleCloseDetail} />}
              />
            ) : (
              <>
                <RestaurantHeroCard restaurant={restaurant} onOpenWebsite={handleOpenWebsite} />

                <View style={styles.inlineControls}>
                  <NutritionSearchField
                    value={menuSearchText}
                    onChangeText={setMenuSearchText}
                    placeholder="Search menu items..."
                  />
                </View>

                <GlassCard style={styles.mealSelectorCard}>
                  <Text style={styles.metaEyebrow}>LOG TO</Text>
                  <View style={styles.mealSelectorRow}>
                    {MEAL_OPTIONS.map((meal) => (
                      <NutritionChip
                        key={meal.key}
                        label={meal.label}
                        selected={meal.key === selectedMeal}
                        onPress={() => setSelectedMeal(meal.key)}
                      />
                    ))}
                  </View>
                </GlassCard>

                {visitStats != null && visitStats.visitCount > 0 ? (
                  <GlassCard style={styles.insightCard}>
                    <Text style={styles.metaEyebrow}>RESTAURANT INSIGHTS</Text>
                    <View style={styles.insightGrid}>
                      <InsightMetric label="Average meal" value={`${visitStats.averageCalories} kcal`} />
                      <InsightMetric label="Last 5 visits" value={`${visitStats.lastFiveAverageCalories} kcal`} />
                      <InsightMetric label="Tracked visits" value={`${visitStats.visitCount}`} />
                    </View>
                  </GlassCard>
                ) : null}

                <NutritionSectionTitle title="Menu" />

                {groupedMenuItems.length === 0 ? (
                  <NutritionEmptyState
                    icon="restaurant_menu"
                    title="No menu items yet"
                    body="Add the first item for this restaurant to start quick-logging meals."
                    action={<NutritionPrimaryButton label="Add menu item" icon="add" onPress={() => handleOpenAddMenuItem()} />}
                  />
                ) : (
                  groupedMenuItems.map(([category, items]) => {
                    const collapsed = collapsedCategories[category] ?? false;
                    return (
                      <GlassCard key={category} style={styles.menuGroupCard}>
                        <Pressable style={styles.menuGroupHeader} onPress={() => toggleCategoryCollapse(category)}>
                          <View>
                            <Text style={styles.menuGroupTitle}>{category}</Text>
                            <Text style={styles.menuGroupMeta}>{items.length} items</Text>
                          </View>
                          <MaterialSymbol
                            name={collapsed ? 'expand_more' : 'expand_less'}
                            size={20}
                            color={NU_TEXT_TERTIARY}
                          />
                        </Pressable>

                        {!collapsed ? (
                          <View style={styles.menuItemList}>
                            {items.map((item) => (
                              <Pressable
                                key={item.id}
                                onPress={() => handleOpenPortionSheet(item)}
                                style={styles.menuItemRow}
                              >
                                <View style={styles.menuItemCopy}>
                                  <Text style={styles.menuItemName}>{item.name}</Text>
                                  {item.description ? (
                                    <Text style={styles.menuItemDescription} numberOfLines={2}>
                                      {item.description}
                                    </Text>
                                  ) : null}
                                  <Text style={styles.menuItemMacros}>
                                    P {formatMacro(item.proteinG)}g • C {formatMacro(item.carbsG)}g • F {formatMacro(item.fatG)}g
                                  </Text>
                                </View>
                                <View style={styles.menuItemRight}>
                                  <Text style={styles.menuItemCalories}>{Math.round(item.calories)}</Text>
                                  <Text style={styles.menuItemCaloriesLabel}>kcal</Text>
                                  <View style={styles.menuItemActions}>
                                    <Pressable
                                      onPress={(event) => {
                                        event.stopPropagation();
                                        handleOpenAddMenuItem(item);
                                      }}
                                      style={styles.rowIconAction}
                                    >
                                      <MaterialSymbol name="edit" size={16} color={NU_TEXT_SECONDARY} />
                                    </Pressable>
                                    <Pressable
                                      onPress={(event) => {
                                        event.stopPropagation();
                                        handleOpenPortionSheet(item);
                                      }}
                                      style={styles.rowPrimaryAction}
                                    >
                                      <MaterialSymbol name="add" size={16} color={NU_ACCENT_DARK} filled />
                                    </Pressable>
                                  </View>
                                </View>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </GlassCard>
                    );
                  })
                )}

                <NutritionPrimaryButton label="Add menu item" icon="add" onPress={() => handleOpenAddMenuItem()} />
              </>
            )}
          </>
        ) : (
          <>
            <NutritionHeaderBar
              title="Restaurants"
              onBack={() => router.back()}
              action={
                <NutritionIconButton
                  icon="add"
                  label="Add"
                  onPress={() => setRestaurantSheetVisible(true)}
                />
              }
            />

            <NutritionHero
              eyebrow="DINING"
              title="Restaurants"
              subtitle="Quick-log meals from your favorite places."
              icon="restaurant"
            />

            <NutritionSearchField
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search restaurants..."
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRail}
            >
              {RESTAURANT_FILTERS.map((filter) => (
                <NutritionChip
                  key={filter.key}
                  label={filter.label}
                  selected={categoryFilter === filter.key}
                  onPress={() => setCategoryFilter(filter.key)}
                />
              ))}
            </ScrollView>

            <NutritionSectionTitle title="Saved Restaurants" />

            {restaurants.length === 0 ? (
              <NutritionEmptyState
                icon="restaurant"
                title="No restaurants saved yet"
                body="Tap the add button to save a restaurant and build out its menu for faster meal logging."
                action={<NutritionPrimaryButton label="Add restaurant" icon="add" onPress={() => setRestaurantSheetVisible(true)} />}
              />
            ) : (
              restaurants.map((item) => (
                <GlassCard key={item.id} onPress={() => handleOpenRestaurant(item.id)} style={styles.restaurantCard}>
                  <View style={styles.restaurantRow}>
                    <RestaurantAvatar restaurant={item} size={48} />
                    <View style={styles.restaurantCopy}>
                      <Text style={styles.restaurantName}>{item.name}</Text>
                      <View style={styles.restaurantMetaRow}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeLabel}>{labelForCategory(item.category)}</Text>
                        </View>
                        <Text style={styles.menuCountText}>{item.menuItemCount} items</Text>
                      </View>
                    </View>
                    <MaterialSymbol name="chevron_right" size={20} color={NU_TEXT_TERTIARY} />
                  </View>
                </GlassCard>
              ))
            )}

            <NutritionPrimaryButton label="Add restaurant" icon="add" onPress={() => setRestaurantSheetVisible(true)} />
          </>
        )}
      </NutritionScrollScreen>

      <NutritionBottomSheet
        visible={restaurantSheetVisible}
        title="Add Restaurant"
        onClose={() => {
          setRestaurantSheetVisible(false);
          setRestaurantDraft(EMPTY_RESTAURANT_DRAFT);
        }}
      >
        <View>
          <NutritionFieldLabel label="Name" />
          <NutritionInput
            value={restaurantDraft.name}
            onChangeText={(value) => setRestaurantDraft((draft) => ({ ...draft, name: value }))}
            placeholder="Sweetgreen"
          />
        </View>

        <View>
          <NutritionFieldLabel label="Category" />
          <View style={styles.sheetChipWrap}>
            {RESTAURANT_FILTERS.filter((filter) => filter.key !== 'all').map((filter) => (
              <NutritionChip
                key={filter.key}
                label={filter.label}
                selected={restaurantDraft.category === filter.key}
                onPress={() =>
                  setRestaurantDraft((draft) => ({
                    ...draft,
                    category: filter.key as RestaurantCategory,
                  }))
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.sheetRow}>
          <View style={styles.sheetRowField}>
            <NutritionFieldLabel label="Logo Emoji" />
            <NutritionInput
              value={restaurantDraft.logoEmoji}
              onChangeText={(value) => setRestaurantDraft((draft) => ({ ...draft, logoEmoji: value }))}
              placeholder="🥗"
              maxLength={2}
            />
          </View>
          <View style={styles.sheetRowField}>
            <NutritionFieldLabel label="Website" />
            <NutritionInput
              value={restaurantDraft.website}
              onChangeText={(value) => setRestaurantDraft((draft) => ({ ...draft, website: value }))}
              placeholder="sweetgreen.com"
            />
          </View>
        </View>

        <GlassCard style={styles.logoUploadCard}>
          <View style={styles.logoUploadCopy}>
            <Text style={styles.logoUploadTitle}>Restaurant artwork</Text>
            <Text style={styles.logoUploadBody}>
              Add an optional square logo from your photo library for the list and hero banner.
            </Text>
          </View>
          <View style={styles.logoUploadRow}>
            <RestaurantAvatar restaurant={restaurantDraft} size={52} />
            <NutritionSecondaryButton label="Choose image" onPress={handlePickLogo} />
          </View>
        </GlassCard>

        <GlassCard style={styles.switchRow}>
          <Text style={styles.switchLabel}>Treat as chain restaurant</Text>
          <NutritionChip
            label={restaurantDraft.chain ? 'Chain' : 'Independent'}
            selected={restaurantDraft.chain}
            onPress={() =>
              setRestaurantDraft((draft) => ({
                ...draft,
                chain: !draft.chain,
              }))
            }
          />
        </GlassCard>

        <View style={styles.sheetActionRow}>
          <View style={styles.actionGrow}>
            <NutritionSecondaryButton
              label="Cancel"
              onPress={() => {
                setRestaurantSheetVisible(false);
                setRestaurantDraft(EMPTY_RESTAURANT_DRAFT);
              }}
            />
          </View>
          <View style={styles.actionGrow}>
            <NutritionPrimaryButton label="Save restaurant" icon="check" onPress={handleSaveRestaurant} />
          </View>
        </View>
      </NutritionBottomSheet>

      <NutritionBottomSheet
        visible={menuSheetVisible}
        title={menuDraft.id == null ? 'Add Menu Item' : 'Edit Menu Item'}
        onClose={() => {
          setMenuSheetVisible(false);
          setMenuDraft(EMPTY_MENU_DRAFT);
        }}
      >
        <View>
          <NutritionFieldLabel label="Name" />
          <NutritionInput
            value={menuDraft.name}
            onChangeText={(value) => setMenuDraft((draft) => ({ ...draft, name: value }))}
            placeholder="Harvest Bowl"
          />
        </View>

        <View>
          <NutritionFieldLabel label="Description" />
          <NutritionInput
            value={menuDraft.description}
            onChangeText={(value) => setMenuDraft((draft) => ({ ...draft, description: value }))}
            placeholder="Warm grains, greens, roasted chicken"
            multiline
          />
        </View>

        <View>
          <NutritionFieldLabel label="Category" />
          <View style={styles.sheetChipWrap}>
            {MENU_CATEGORIES.map((category) => (
              <NutritionChip
                key={category}
                label={category}
                selected={menuDraft.category === category}
                onPress={() => setMenuDraft((draft) => ({ ...draft, category }))}
              />
            ))}
          </View>
        </View>

        <View style={styles.sheetRow}>
          <View style={styles.sheetRowField}>
            <NutritionFieldLabel label="Serving size" />
            <NutritionInput
              value={menuDraft.servingSize}
              onChangeText={(value) => setMenuDraft((draft) => ({ ...draft, servingSize: value }))}
              placeholder="1 bowl"
            />
          </View>
          <View style={styles.sheetRowField}>
            <NutritionFieldLabel label="Calories" />
            <NutritionInput
              value={menuDraft.calories}
              onChangeText={(value) => setMenuDraft((draft) => ({ ...draft, calories: value }))}
              placeholder="620"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.sheetRow}>
          <View style={styles.sheetRowField}>
            <NutritionFieldLabel label="Protein" />
            <NutritionInput
              value={menuDraft.proteinG}
              onChangeText={(value) => setMenuDraft((draft) => ({ ...draft, proteinG: value }))}
              placeholder="35"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.sheetRowField}>
            <NutritionFieldLabel label="Carbs" />
            <NutritionInput
              value={menuDraft.carbsG}
              onChangeText={(value) => setMenuDraft((draft) => ({ ...draft, carbsG: value }))}
              placeholder="54"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.sheetRow}>
          <View style={styles.sheetRowField}>
            <NutritionFieldLabel label="Fat" />
            <NutritionInput
              value={menuDraft.fatG}
              onChangeText={(value) => setMenuDraft((draft) => ({ ...draft, fatG: value }))}
              placeholder="22"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.sheetRowField}>
            <NutritionFieldLabel label="Fiber" />
            <NutritionInput
              value={menuDraft.fiberG}
              onChangeText={(value) => setMenuDraft((draft) => ({ ...draft, fiberG: value }))}
              placeholder="8"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.sheetActionRow}>
          <View style={styles.actionGrow}>
            <NutritionSecondaryButton
              label="Cancel"
              onPress={() => {
                setMenuSheetVisible(false);
                setMenuDraft(EMPTY_MENU_DRAFT);
              }}
            />
          </View>
          <View style={styles.actionGrow}>
            <NutritionPrimaryButton label="Save item" icon="check" onPress={handleSaveMenuItem} />
          </View>
        </View>
      </NutritionBottomSheet>

      <NutritionBottomSheet
        visible={portionItem != null}
        title={portionItem?.name ?? 'Portion'}
        onClose={() => {
          setPortionItem(null);
          setPortionCount(1);
        }}
      >
        {portionItem != null ? (
          <>
            <GlassCard style={styles.portionSummaryCard}>
              <Text style={styles.metaEyebrow}>PER SERVING</Text>
              <Text style={styles.portionCalories}>
                {Math.round(portionItem.calories)} <Text style={styles.portionCaloriesUnit}>kcal</Text>
              </Text>
              <Text style={styles.portionMacroLine}>
                Protein {formatMacro(portionItem.proteinG)}g • Carbs {formatMacro(portionItem.carbsG)}g • Fat {formatMacro(portionItem.fatG)}g • Fiber {formatMacro(portionItem.fiberG)}g
              </Text>
            </GlassCard>

            <GlassCard style={styles.portionSelectorCard}>
              <Text style={styles.metaEyebrow}>SERVINGS</Text>
              <View style={styles.portionSelectorRow}>
                <Pressable
                  onPress={() => setPortionCount((value) => Math.max(0.5, roundServing(value - 0.5)))}
                  style={styles.portionAdjustButton}
                >
                  <Text style={styles.portionAdjustText}>−</Text>
                </Pressable>
                <Text style={styles.portionValue}>{formatServingCount(portionCount)}x</Text>
                <Pressable
                  onPress={() => setPortionCount((value) => roundServing(value + 0.5))}
                  style={styles.portionAdjustButton}
                >
                  <Text style={styles.portionAdjustText}>+</Text>
                </Pressable>
              </View>
            </GlassCard>

            <View style={styles.sheetActionRow}>
              <View style={styles.actionGrow}>
                <NutritionSecondaryButton
                  label="Close"
                  onPress={() => {
                    setPortionItem(null);
                    setPortionCount(1);
                  }}
                />
              </View>
              <View style={styles.actionGrow}>
                <NutritionPrimaryButton label={`Add to ${selectedMeal}`} icon="add" onPress={handleConfirmPortion} />
              </View>
            </View>
          </>
        ) : null}
      </NutritionBottomSheet>
    </>
  );
}

function RestaurantHeroCard({
  restaurant,
  onOpenWebsite,
}: {
  restaurant: RestaurantWithCount;
  onOpenWebsite: (website: string) => void;
}) {
  return (
    <GlassCard style={styles.detailHeroCard}>
      {restaurant.logoUri ? <Image source={{ uri: restaurant.logoUri }} style={styles.detailHeroImage} /> : null}
      <View style={styles.detailHeroOverlay}>
        <RestaurantAvatar restaurant={restaurant} size={68} />
        <View style={styles.detailHeroCopy}>
          <Text style={styles.metaEyebrow}>MENU DETAIL</Text>
          <Text style={styles.detailHeroTitle}>{restaurant.name}</Text>
          <View style={styles.detailHeroMetaRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeLabel}>{labelForCategory(restaurant.category)}</Text>
            </View>
            <Text style={styles.menuCountText}>{restaurant.menuItemCount} items</Text>
          </View>
          {restaurant.website ? (
            <Pressable onPress={() => onOpenWebsite(restaurant.website!)} style={styles.websiteRow}>
              <MaterialSymbol name="link" size={16} color={NU_ACCENT_LIGHT} />
              <Text style={styles.websiteText} numberOfLines={1}>
                {restaurant.website.replace(/^https?:\/\//, '')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </GlassCard>
  );
}

function RestaurantAvatar({
  restaurant,
  size,
}: {
  restaurant: Pick<RestaurantWithCount, 'logoEmoji' | 'logoUri' | 'name'> | RestaurantDraft;
  size: number;
}) {
  const initial = restaurant.name.trim().slice(0, 1).toUpperCase() || 'R';
  const borderRadius = Math.round(size / 2);

  if (restaurant.logoUri) {
    return (
      <Image
        source={{ uri: restaurant.logoUri }}
        style={{ width: size, height: size, borderRadius }}
      />
    );
  }

  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius }]}>
      <Text style={styles.avatarText}>{restaurant.logoEmoji?.trim() || initial}</Text>
    </View>
  );
}

function InsightMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.insightMetric}>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={styles.insightValue}>{value}</Text>
    </View>
  );
}

function normalizeRouteParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeWebsite(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function labelForCategory(category: RestaurantCategory): string {
  return RESTAURANT_CATEGORY_LABELS[category];
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMacro(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function roundServing(value: number): number {
  return Math.round(value * 2) / 2;
}

function formatServingCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  inlineControls: {
    gap: 14,
  },
  filterRail: {
    gap: 10,
    paddingRight: 20,
  },
  restaurantCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  restaurantCopy: {
    flex: 1,
    gap: 6,
  },
  restaurantName: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 16,
    color: NU_TEXT,
  },
  restaurantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255, 184, 119, 0.14)',
  },
  categoryBadgeLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 10,
    color: NU_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuCountText: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT_TERTIARY,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${NU_ACCENT}25`,
  },
  avatarText: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 20,
    color: NU_ACCENT_LIGHT,
  },
  detailHeroCard: {
    padding: 0,
    overflow: 'hidden',
    minHeight: 268,
  },
  detailHeroImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  detailHeroOverlay: {
    minHeight: 268,
    padding: 24,
    justifyContent: 'flex-end',
    gap: 16,
    backgroundColor: 'rgba(14, 14, 19, 0.58)',
  },
  detailHeroCopy: {
    gap: 10,
  },
  detailHeroTitle: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.1,
    color: NU_TEXT,
  },
  detailHeroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  websiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  websiteText: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 13,
    color: NU_TEXT_SECONDARY,
    flex: 1,
  },
  metaEyebrow: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: NU_ACCENT_LIGHT,
  },
  mealSelectorCard: {
    gap: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mealSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  insightCard: {
    gap: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  insightGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  insightMetric: {
    flexGrow: 1,
    minWidth: 100,
    borderRadius: 18,
    padding: 14,
    backgroundColor: NU_SURFACES.mid,
    gap: 6,
  },
  insightLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 11,
    color: NU_TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  insightValue: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 15,
    color: NU_TEXT,
  },
  menuGroupCard: {
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  menuGroupTitle: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 18,
    color: NU_TEXT,
  },
  menuGroupMeta: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT_TERTIARY,
    marginTop: 4,
  },
  menuItemList: {
    gap: 10,
  },
  menuItemRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderRadius: 20,
    padding: 14,
    backgroundColor: NU_SURFACES.mid,
  },
  menuItemCopy: {
    flex: 1,
    gap: 6,
  },
  menuItemName: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 15,
    color: NU_TEXT,
  },
  menuItemDescription: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 13,
    lineHeight: 18,
    color: NU_TEXT_SECONDARY,
  },
  menuItemMacros: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT_TERTIARY,
  },
  menuItemRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  menuItemCalories: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 20,
    color: NU_CALORIE,
  },
  menuItemCaloriesLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 11,
    color: NU_TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  menuItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rowIconAction: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  rowPrimaryAction: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_ACCENT,
  },
  sheetChipWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sheetRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetRowField: {
    flex: 1,
  },
  logoUploadCard: {
    gap: 14,
  },
  logoUploadCopy: {
    gap: 6,
  },
  logoUploadTitle: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 15,
    color: NU_TEXT,
  },
  logoUploadBody: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 13,
    lineHeight: 18,
    color: NU_TEXT_SECONDARY,
  },
  logoUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 14,
    color: NU_TEXT,
    flex: 1,
  },
  sheetActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionGrow: {
    flex: 1,
  },
  portionSummaryCard: {
    gap: 10,
  },
  portionCalories: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 32,
    lineHeight: 36,
    color: NU_CALORIE,
  },
  portionCaloriesUnit: {
    fontSize: 15,
    color: NU_TEXT_TERTIARY,
  },
  portionMacroLine: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 13,
    lineHeight: 18,
    color: NU_TEXT_SECONDARY,
  },
  portionSelectorCard: {
    gap: 14,
  },
  portionSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  portionAdjustButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.mid,
  },
  portionAdjustText: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 24,
    color: NU_TEXT,
  },
  portionValue: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 28,
    color: NU_TEXT,
  },
});
