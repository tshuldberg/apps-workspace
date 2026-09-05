import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react-native';
import {
  addRecipeToShoppingList,
  calculateRecipeNutrition,
  createShoppingList,
  generateMealPlanShoppingList,
  getMealPlanWeek,
  getRecipes,
  upsertMealPlanItem,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
  type MealPlanItem,
  type MealSlot,
  type Recipe,
} from '@mylife/bestchef';
import { MealPlanCell } from '@mylife/bestchef/ui';
import { ErrorState, LoadingState, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function getWeekStart(offset: number): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function addDays(weekStart: string, days: number): Date {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d;
}

function formatRangeLabel(weekStart: string): string {
  const start = addDays(weekStart, 0);
  const end = addDays(weekStart, 6);
  const startMonth = MONTH_NAMES[start.getMonth()];
  const endMonth = MONTH_NAMES[end.getMonth()];
  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getDate()} \u2013 ${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} \u2013 ${endMonth} ${end.getDate()}`;
}

function getIsoWeekNumber(weekStart: string): number {
  const d = new Date(`${weekStart}T00:00:00Z`);
  // ISO week: Thursday in current week decides the year
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

type MealPlanRow = MealPlanItem & { recipe_title: string; recipe_image_uri: string | null };

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_HORIZONTAL_PADDING = 16;
const COLUMN_GAP = 12;
// Show exactly 3 day columns at a time in the horizontal scroll viewport
const DAY_COLUMN_WIDTH = Math.floor(
  (SCREEN_WIDTH - GRID_HORIZONTAL_PADDING * 2 - COLUMN_GAP * 2) / 3,
);

export default function MealPlanScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [weekOffset, setWeekOffset] = useState(0);
  const [weekItems, setWeekItems] = useState<MealPlanRow[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<{ day: number; slot: MealSlot } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const weekStart = getWeekStart(weekOffset);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      setWeekItems(getMealPlanWeek(db, weekStart));
      setRecipes(getRecipes(db, { limit: 200 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meal plan');
    } finally {
      setLoading(false);
    }
  }, [db, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  // Map recipeId -> calories per serving (best effort, requires pantry nutrition data)
  const calorieByRecipe = useMemo(() => {
    const map = new Map<string, number | null>();
    const uniqueIds = new Set(weekItems.map((item) => item.recipe_id));
    for (const id of uniqueIds) {
      try {
        const summary = calculateRecipeNutrition(db, id);
        map.set(id, summary.perServing.calories);
      } catch {
        map.set(id, null);
      }
    }
    return map;
  }, [db, weekItems]);

  const getMealForSlot = (day: number, slot: MealSlot): MealPlanRow | undefined =>
    weekItems.find((item) => item.day_of_week === day && item.meal_slot === slot);

  const getDailyTotal = (day: number): number => {
    let total = 0;
    for (const slot of MEAL_SLOTS) {
      const meal = getMealForSlot(day, slot);
      if (!meal) continue;
      const cal = calorieByRecipe.get(meal.recipe_id);
      if (cal != null) total += Math.round(cal);
    }
    return total;
  };

  const handleOpenPicker = (day: number, slot: MealSlot) => {
    if (recipes.length === 0) {
      Alert.alert('No Recipes', 'Add some recipes first before planning meals.');
      return;
    }
    setPickerSearch('');
    setPickerTarget({ day, slot });
  };

  const handleSelectRecipe = (recipe: Recipe) => {
    if (!pickerTarget) return;
    upsertMealPlanItem(db, {
      weekStartDate: weekStart,
      dayOfWeek: pickerTarget.day,
      mealSlot: pickerTarget.slot,
      recipeId: recipe.id,
    });
    setPickerTarget(null);
    setPickerSearch('');
    load();
  };

  const handleGenerateShoppingList = () => {
    const list = generateMealPlanShoppingList(db, weekStart);
    if (list.length === 0) {
      Alert.alert('No Meals Planned', 'Add recipes to the planner first.');
      return;
    }
    const planned = new Set(weekItems.map((item) => item.recipe_id));
    if (planned.size === 0) {
      Alert.alert('No Meals Planned', 'Add recipes to the planner first.');
      return;
    }
    const listId = uuid();
    const name = `Meal Plan ${formatRangeLabel(weekStart)}`;
    try {
      createShoppingList(db, listId, name);
      for (const recipeId of planned) {
        addRecipeToShoppingList(db, listId, recipeId, 1, uuid);
      }
      router.push({ pathname: '/(recipes)/shopping-list', params: { listId } });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate shopping list');
    }
  };

  const filteredRecipes = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, pickerSearch]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={5} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  const weekNumber = getIsoWeekNumber(weekStart);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Week navigation header */}
        <View style={styles.weekNav}>
          <Pressable
            onPress={() => setWeekOffset((p) => p - 1)}
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            hitSlop={8}
            accessibilityLabel="Previous week"
          >
            <ChevronLeft size={20} color={colors.text} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.weekLabelWrap}>
            <Text style={styles.weekRange}>{formatRangeLabel(weekStart)}</Text>
            <Text style={styles.weekBadge}>WEEK {weekNumber}</Text>
          </View>
          <Pressable
            onPress={() => setWeekOffset((p) => p + 1)}
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            hitSlop={8}
            accessibilityLabel="Next week"
          >
            <ChevronRight size={20} color={colors.text} strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* Weekly grid -- horizontal scroll, 3 day columns visible */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gridScrollContent}
          snapToInterval={DAY_COLUMN_WIDTH + COLUMN_GAP}
          decelerationRate="fast"
        >
          <View style={styles.grid}>
            {DAY_NAMES.map((dayName, dayIndex) => {
              const dayDate = addDays(weekStart, dayIndex);
              const today = isToday(dayDate);
              const dailyTotal = getDailyTotal(dayIndex);
              return (
                <View key={dayName} style={styles.dayColumn}>
                  <View style={styles.dayHeader}>
                    <Text style={[styles.dayLabel, today && styles.dayLabelActive]}>
                      {dayName.toUpperCase()}
                    </Text>
                    <Text style={[styles.dayDate, today && styles.dayDateActive]}>
                      {dayDate.getDate()}
                    </Text>
                  </View>

                  {MEAL_SLOTS.map((slot) => {
                    const meal = getMealForSlot(dayIndex, slot);
                    const rawCal = meal ? calorieByRecipe.get(meal.recipe_id) : null;
                    const calories = rawCal != null ? Math.round(rawCal) : undefined;
                    return (
                      <View key={slot} style={styles.cellWrap}>
                        <MealPlanCell
                          mealType={MEAL_LABELS[slot]}
                          recipe={
                            meal
                              ? {
                                  title: meal.recipe_title,
                                  imageUri: meal.recipe_image_uri ?? undefined,
                                  calories,
                                }
                              : undefined
                          }
                          onPress={() =>
                            meal
                              ? router.push(`/(recipes)/recipe/${meal.recipe_id}` as never)
                              : undefined
                          }
                          onAssign={() => handleOpenPicker(dayIndex, slot)}
                        />
                      </View>
                    );
                  })}

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>TOTAL</Text>
                    <Text style={styles.totalValue}>{dailyTotal} kcal</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Generate shopping list CTA */}
        <Pressable
          onPress={handleGenerateShoppingList}
          style={({ pressed }) => [
            styles.generateButton,
            pressed && styles.generateButtonPressed,
          ]}
          accessibilityLabel="Generate shopping list"
        >
          <ShoppingCart size={18} color="#0E0E13" strokeWidth={2.5} />
          <Text style={styles.generateLabel}>Generate Shopping List</Text>
        </Pressable>
      </ScrollView>

      {/* Recipe picker modal */}
      <Modal
        visible={pickerTarget != null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {pickerTarget
                ? `${DAY_NAMES[pickerTarget.day]} \u00B7 ${MEAL_LABELS[pickerTarget.slot]}`
                : ''}
            </Text>
            <TextInput
              placeholder="Search recipes"
              placeholderTextColor={colors.textTertiary}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              style={styles.searchInput}
              autoCorrect={false}
            />
            <FlatList
              data={filteredRecipes}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectRecipe(item)}
                  style={({ pressed }) => [
                    styles.recipeRow,
                    pressed && styles.recipeRowPressed,
                  ]}
                >
                  <Text style={styles.recipeRowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.total_time_mins != null ? (
                    <Text style={styles.recipeRowMeta}>{item.total_time_mins} min</Text>
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No recipes match</Text>
              }
            />
            <Pressable onPress={() => setPickerTarget(null)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },

  // Week nav
  weekNav: {
    marginHorizontal: GRID_HORIZONTAL_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECIPES_SURFACES.focus,
  },
  navButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  weekLabelWrap: {
    alignItems: 'center',
    gap: 4,
  },
  weekRange: {
    color: colors.text,
    fontFamily: RECIPES_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  weekBadge: {
    color: RECIPES_SECONDARY,
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Grid
  gridScrollContent: {
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
  },
  grid: {
    flexDirection: 'row',
    gap: COLUMN_GAP,
  },
  dayColumn: {
    width: DAY_COLUMN_WIDTH,
    gap: 12,
  },
  dayHeader: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(159, 142, 129, 0.2)',
    gap: 2,
  },
  dayLabel: {
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dayLabelActive: {
    color: RECIPES_SECONDARY,
  },
  dayDate: {
    fontFamily: RECIPES_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  dayDateActive: {
    color: RECIPES_SECONDARY,
  },
  cellWrap: {
    // MealPlanCell renders its own internal styling
  },
  totalRow: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(159, 142, 129, 0.2)',
    alignItems: 'center',
    gap: 2,
  },
  totalLabel: {
    fontFamily: RECIPES_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  totalValue: {
    fontFamily: RECIPES_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: RECIPES_SECONDARY,
  },

  // Generate button
  generateButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: RECIPES_ACCENT,
    paddingVertical: 16,
    borderRadius: 999,
    shadowColor: RECIPES_ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  generateButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  generateLabel: {
    color: '#0E0E13',
    fontFamily: RECIPES_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    maxHeight: '80%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outline,
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
    fontSize: 18,
    marginBottom: spacing.md,
  },
  searchInput: {
    backgroundColor: RECIPES_SURFACES.focus,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.md,
    fontSize: 15,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  recipeRowPressed: {
    opacity: 0.6,
  },
  recipeRowTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  recipeRowMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  modalEmpty: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  modalCancel: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 12,
  },
  modalCancelText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
});
