import { useCallback, useEffect, useMemo, useState } from 'react';
import { uuid } from '../../../lib/uuid';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  addFoodLogItem,
  createFoodLogEntry,
  FoodRow,
  getFavoriteIds,
  getFoodById,
  getFoodLogEntries,
  getMealTemplateItems,
  getMealTemplates,
  getSetting,
  MaterialSymbol,
  NU_ACCENT,
  NU_ACCENT_DARK,
  NU_ACCENT_LIGHT,
  NU_GLASS_NAV,
  NU_SOURCE_BADGES,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  searchFoods,
  searchFoodsFTS,
  SectionHeader,
  type Food,
  type FoodSource,
  type MealTemplate,
  type MealType,
} from '@mylife/nutrition';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

type SourceFilter = 'all' | 'usda' | 'open_food_facts' | 'fatsecret' | 'custom';

type PortionSelection = {
  food: Food;
  quantity: number;
  mealType: MealType;
};

const SOURCE_FILTERS: Array<{ key: SourceFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'usda', label: 'USDA' },
  { key: 'open_food_facts', label: 'OFF' },
  { key: 'fatsecret', label: 'FatSecret' },
  { key: 'custom', label: 'Custom' },
];

const QUICK_ACTIONS = [
  { key: 'barcode', label: 'Barcode', icon: 'qr_code_scanner' },
  { key: 'photo', label: 'Photo', icon: 'photo_camera' },
  { key: 'favorites', label: 'Favorites', icon: 'favorite' },
  { key: 'recents', label: 'Recents', icon: 'history' },
] as const;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatSource(source: FoodSource): SourceFilter {
  if (source === 'ai_photo') {
    return 'custom';
  }
  return source === 'custom' ? 'custom' : source;
}

function getRecentFoods(db: ReturnType<typeof useDatabase>, limit = 10): Food[] {
  const rows = db.query<{ food_id: string }>(
    `SELECT i.food_id
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     ORDER BY l.date DESC, l.created_at DESC
     LIMIT ?`,
    [limit * 3],
  );

  const seen = new Set<string>();
  const foods: Food[] = [];

  for (const row of rows) {
    if (seen.has(row.food_id)) {
      continue;
    }
    const food = getFoodById(db, row.food_id);
    if (food) {
      foods.push(food);
      seen.add(food.id);
    }
    if (foods.length >= limit) {
      break;
    }
  }

  return foods;
}

export default function NutritionSearchScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [sectionFocus, setSectionFocus] = useState<'all' | 'favorites' | 'recents'>('all');
  const [portionSelection, setPortionSelection] = useState<PortionSelection | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const defaultMealType = useMemo<MealType>(() => {
    const configured = getSetting(db, 'defaultMealType');
    return configured === 'breakfast' || configured === 'dinner' || configured === 'snack'
      ? configured
      : 'lunch';
  }, [db]);

  const state = useMemo(() => {
    try {
      const favoriteIds = getFavoriteIds(db);
      const favorites = favoriteIds
        .map((id) => getFoodById(db, id))
        .filter((food): food is Food => Boolean(food));
      const recents = getRecentFoods(db);
      const templates = getMealTemplates(db);

      let results: Food[] = [];
      if (debouncedQuery) {
        results = searchFoodsFTS(db, debouncedQuery, 40);
        if (results.length === 0) {
          results = searchFoods(db, debouncedQuery, 40);
        }
      }

      if (sourceFilter !== 'all') {
        results = results.filter((food) => formatSource(food.source) === sourceFilter);
      }

      return {
        error: null as string | null,
        favorites,
        recents,
        templates,
        results,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to search foods.',
        favorites: [] as Food[],
        recents: [] as Food[],
        templates: [] as MealTemplate[],
        results: [] as Food[],
      };
    }
  }, [db, debouncedQuery, sourceFilter, tick]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 120);
  }, []);

  const openPortionPicker = useCallback(
    (food: Food, preferredMeal?: MealType) => {
      setPortionSelection({
        food,
        quantity: 1,
        mealType: preferredMeal ?? defaultMealType,
      });
    },
    [defaultMealType],
  );

  const addFoodToDiary = useCallback(() => {
    if (!portionSelection) {
      return;
    }

    const date = todayKey();
    try {
      const entries = getFoodLogEntries(db, date);
      let entry = entries.find((item) => item.mealType === portionSelection.mealType);

      if (!entry) {
        const logId = uuid();
        createFoodLogEntry(db, logId, {
          date,
          mealType: portionSelection.mealType,
        });
        entry = {
          id: logId,
          date,
          mealType: portionSelection.mealType,
          notes: null,
          createdAt: new Date().toISOString(),
        };
      }

      addFoodLogItem(db, uuid(), {
        logId: entry.id,
        foodId: portionSelection.food.id,
        servingCount: portionSelection.quantity,
        calories: Math.round(portionSelection.food.calories * portionSelection.quantity),
        proteinG: Math.round(portionSelection.food.proteinG * portionSelection.quantity * 10) / 10,
        carbsG: Math.round(portionSelection.food.carbsG * portionSelection.quantity * 10) / 10,
        fatG: Math.round(portionSelection.food.fatG * portionSelection.quantity * 10) / 10,
      });

      setPortionSelection(null);
      setTick((value) => value + 1);
      Alert.alert(
        'Added to diary',
        `${portionSelection.food.name} added to ${portionSelection.mealType}.`,
      );
    } catch (error) {
      Alert.alert(
        'Unable to log food',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [db, portionSelection]);

  const logTemplate = useCallback(
    (template: MealTemplate) => {
      try {
        const items = getMealTemplateItems(db, template.id);
        if (items.length === 0) {
          Alert.alert('Template empty', 'Add foods to this template before logging it.');
          return;
        }

        const date = todayKey();
        const logId = uuid();
        createFoodLogEntry(db, logId, {
          date,
          mealType: template.mealType,
        });

        for (const item of items) {
          const food = getFoodById(db, item.foodId);
          if (!food) {
            continue;
          }
          addFoodLogItem(db, uuid(), {
            logId,
            foodId: food.id,
            servingCount: item.servingCount,
            calories: Math.round(food.calories * item.servingCount),
            proteinG: Math.round(food.proteinG * item.servingCount * 10) / 10,
            carbsG: Math.round(food.carbsG * item.servingCount * 10) / 10,
            fatG: Math.round(food.fatG * item.servingCount * 10) / 10,
          });
        }

        setTick((value) => value + 1);
        Alert.alert('Template logged', `${template.name} was added to today’s diary.`);
      } catch (error) {
        Alert.alert(
          'Unable to log template',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    },
    [db],
  );

  if (state.error) {
    return (
      <View style={styles.errorWrap}>
        <ErrorState message={state.error} onRetry={handleRefresh} />
      </View>
    );
  }

  const showSearchResults = debouncedQuery.length > 0;
  const favorites =
    sectionFocus === 'recents' ? [] : state.favorites;
  const recents =
    sectionFocus === 'favorites' ? [] : state.recents;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={NU_ACCENT}
          />
        }
      >
        <View style={styles.headerShell}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.moduleName}>MyNutrition</Text>
              <Text style={styles.headerMeta}>Search and log</Text>
            </View>
            <Pressable style={styles.headerAction}>
              <MaterialSymbol name="notifications" size={20} color={NU_ACCENT_LIGHT} />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <MaterialSymbol name="search" size={18} color={NU_TEXT_TERTIARY} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search foods, brands, restaurants..."
            placeholderTextColor={NU_TEXT_TERTIARY}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')}>
              <MaterialSymbol name="close" size={18} color={NU_TEXT_TERTIARY} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              style={styles.quickTile}
              onPress={() => {
                if (action.key === 'barcode') {
                  router.push('/(nutrition)/scan' as never);
                  return;
                }
                if (action.key === 'photo') {
                  router.push('/(nutrition)/photo' as never);
                  return;
                }
                setSectionFocus(action.key);
                setQuery('');
              }}
            >
              <View style={styles.quickIcon}>
                <MaterialSymbol name={action.icon} size={18} color={NU_ACCENT_LIGHT} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {showSearchResults ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {SOURCE_FILTERS.map((item) => {
                  const active = sourceFilter === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.filterChip, active ? styles.filterChipActive : null]}
                      onPress={() => setSourceFilter(item.key)}
                    >
                      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {state.results.length === 0 ? (
              <View style={styles.emptySearch}>
                <Text style={styles.emptyTitle}>No foods found</Text>
                <Text style={styles.emptyBody}>
                  Try a broader query or create a custom food for this diary.
                </Text>
                <Pressable
                  style={styles.customButton}
                  onPress={() => router.push('/(nutrition)/log?custom=true' as never)}
                >
                  <Text style={styles.customButtonText}>Add custom food</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.resultsStack}>
                {state.results.map((food) => (
                  <FoodRow
                    key={food.id}
                    foodName={food.name}
                    calories={food.calories}
                    servingSize={`${food.servingSize} ${food.servingUnit}`}
                    source={food.source}
                    macros={{
                      p: Math.round(food.proteinG),
                      c: Math.round(food.carbsG),
                      f: Math.round(food.fatG),
                    }}
                    onPress={() => router.push(`/(nutrition)/food/${food.id}` as never)}
                    onAdd={() => openPortionPicker(food)}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.initialSections}>
            {recents.length > 0 ? (
              <View style={styles.sectionBlock}>
                <SectionHeader title="Recent" />
                <View style={styles.resultsStack}>
                  {recents.map((food) => (
                    <FoodRow
                      key={food.id}
                      foodName={food.name}
                      calories={food.calories}
                      servingSize={`${food.servingSize} ${food.servingUnit}`}
                      source={food.source}
                      onPress={() => router.push(`/(nutrition)/food/${food.id}` as never)}
                      onAdd={() => openPortionPicker(food)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {favorites.length > 0 ? (
              <View style={styles.sectionBlock}>
                <SectionHeader title="Favorites" />
                <View style={styles.resultsStack}>
                  {favorites.map((food) => (
                    <FoodRow
                      key={food.id}
                      foodName={food.name}
                      calories={food.calories}
                      servingSize={`${food.servingSize} ${food.servingUnit}`}
                      source={food.source}
                      onPress={() => router.push(`/(nutrition)/food/${food.id}` as never)}
                      onAdd={() => openPortionPicker(food)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.sectionBlock}>
              <SectionHeader title="Meal Templates" />
              {state.templates.length === 0 ? (
                <Text style={styles.templateEmpty}>
                  Save frequently repeated meals from the diary to make logging instant.
                </Text>
              ) : (
                <View style={styles.templateStack}>
                  {state.templates.map((template) => {
                    const templateItems = getMealTemplateItems(db, template.id).length;
                    return (
                      <Pressable
                        key={template.id}
                        style={styles.templateCard}
                        onPress={() => logTemplate(template)}
                      >
                        <View style={styles.templateCopy}>
                          <Text style={styles.templateName}>{template.name}</Text>
                          <Text style={styles.templateMeta}>
                            {templateItems} item{templateItems === 1 ? '' : 's'} • {template.mealType}
                          </Text>
                        </View>
                        <MaterialSymbol name="add_circle" size={20} color={NU_ACCENT_LIGHT} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={Boolean(portionSelection)} transparent animationType="fade" onRequestClose={() => setPortionSelection(null)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalBadge}>
                <MaterialSymbol
                  name={portionSelection ? NU_SOURCE_BADGES[portionSelection.food.source].icon : 'restaurant'}
                  size={14}
                  color={NU_ACCENT_LIGHT}
                />
                <Text style={styles.modalBadgeText}>
                  {portionSelection ? NU_SOURCE_BADGES[portionSelection.food.source].label : ''}
                </Text>
              </View>
              <Pressable onPress={() => setPortionSelection(null)}>
                <MaterialSymbol name="close" size={18} color={NU_TEXT_TERTIARY} />
              </Pressable>
            </View>

            <Text style={styles.modalTitle}>{portionSelection?.food.name}</Text>
            <Text style={styles.modalBody}>
              {portionSelection
                ? `${portionSelection.food.servingSize} ${portionSelection.food.servingUnit} • ${Math.round(portionSelection.food.calories)} kcal`
                : ''}
            </Text>

            <View style={styles.quantityRow}>
              <Pressable
                style={styles.quantityButton}
                onPress={() =>
                  setPortionSelection((current) =>
                    current
                      ? { ...current, quantity: Math.max(0.25, Math.round((current.quantity - 0.25) * 100) / 100) }
                      : current,
                  )
                }
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </Pressable>
              <Text style={styles.quantityValue}>
                {portionSelection?.quantity.toFixed(2)}x serving
              </Text>
              <Pressable
                style={styles.quantityButton}
                onPress={() =>
                  setPortionSelection((current) =>
                    current
                      ? { ...current, quantity: Math.round((current.quantity + 0.25) * 100) / 100 }
                      : current,
                  )
                }
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.mealPicker}>
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((mealType) => {
                const active = portionSelection?.mealType === mealType;
                return (
                  <Pressable
                    key={mealType}
                    style={[styles.mealChip, active ? styles.mealChipActive : null]}
                    onPress={() =>
                      setPortionSelection((current) =>
                        current ? { ...current, mealType } : current,
                      )
                    }
                  >
                    <Text style={[styles.mealChipText, active ? styles.mealChipTextActive : null]}>
                      {mealType === 'snack' ? 'Snack' : mealType[0].toUpperCase() + mealType.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.macroPreview}>
              <PreviewMetric label="Calories" value={String(Math.round((portionSelection?.food.calories ?? 0) * (portionSelection?.quantity ?? 1)))} />
              <PreviewMetric label="Protein" value={`${Math.round((portionSelection?.food.proteinG ?? 0) * (portionSelection?.quantity ?? 1) * 10) / 10}g`} />
              <PreviewMetric label="Carbs" value={`${Math.round((portionSelection?.food.carbsG ?? 0) * (portionSelection?.quantity ?? 1) * 10) / 10}g`} />
              <PreviewMetric label="Fat" value={`${Math.round((portionSelection?.food.fatG ?? 0) * (portionSelection?.quantity ?? 1) * 10) / 10}g`} />
            </View>

            <Pressable style={styles.addButton} onPress={addFoodToDiary}>
              <Text style={styles.addButtonText}>Add to diary</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.previewMetric}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NU_SURFACES.base,
  },
  scroll: {
    flex: 1,
    backgroundColor: NU_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 168,
    gap: 18,
  },
  headerShell: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    backgroundColor: NU_GLASS_NAV.backgroundColor,
  },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: NU_GLASS_NAV.backgroundColor,
  },
  headerCopy: {
    gap: 2,
  },
  moduleName: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  headerMeta: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: NU_SURFACES.high,
  },
  searchInput: {
    flex: 1,
    color: NU_TEXT,
    fontFamily: NU_TYPOGRAPHY.bodyMd.fontFamily,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickTile: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    backgroundColor: NU_SURFACES.low,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,184,119,0.1)',
  },
  quickLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: NU_SURFACES.low,
  },
  filterChipActive: {
    backgroundColor: 'rgba(255,184,119,0.18)',
  },
  filterChipText: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_SECONDARY,
  },
  filterChipTextActive: {
    color: NU_ACCENT_LIGHT,
  },
  resultsStack: {
    gap: 12,
  },
  initialSections: {
    gap: 24,
  },
  sectionBlock: {
    gap: 12,
  },
  templateEmpty: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_TERTIARY,
  },
  templateStack: {
    gap: 12,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 18,
    padding: 16,
    backgroundColor: NU_SURFACES.low,
  },
  templateCopy: {
    flex: 1,
    gap: 4,
  },
  templateName: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  templateMeta: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  emptySearch: {
    borderRadius: 24,
    padding: 24,
    gap: 12,
    backgroundColor: NU_SURFACES.low,
  },
  emptyTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  emptyBody: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  customButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: NU_ACCENT,
  },
  customButtonText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_ACCENT_DARK,
  },
  modalScrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.56)',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    backgroundColor: NU_SURFACES.low,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,184,119,0.12)',
  },
  modalBadgeText: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_ACCENT_LIGHT,
  },
  modalTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  modalBody: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.high,
  },
  quantityButtonText: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  quantityValue: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  mealPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mealChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: NU_SURFACES.high,
  },
  mealChipActive: {
    backgroundColor: 'rgba(255,184,119,0.18)',
  },
  mealChipText: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_SECONDARY,
  },
  mealChipTextActive: {
    color: NU_ACCENT_LIGHT,
  },
  macroPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  previewMetric: {
    flexBasis: '47%',
    borderRadius: 18,
    padding: 12,
    gap: 2,
    backgroundColor: NU_SURFACES.mid,
  },
  previewLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  previewValue: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  addButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: NU_ACCENT,
  },
  addButtonText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_ACCENT_DARK,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: NU_SURFACES.base,
  },
});
