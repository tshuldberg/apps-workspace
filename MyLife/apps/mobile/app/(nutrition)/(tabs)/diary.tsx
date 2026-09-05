import { useCallback, useMemo, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AddFoodFAB,
  CalorieRing,
  copyFoodLog,
  deleteFoodLogItem,
  getActiveGoals,
  getFoodById,
  getFoodLogEntries,
  getFoodLogItems,
  MaterialSymbol,
  NU_ACCENT,
  NU_ACCENT_DARK,
  NU_ACCENT_LIGHT,
  NU_CALORIE,
  NU_GLASS_NAV,
  NU_GOAL_STATUS,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  SectionHeader,
  updateFoodLogItem,
  type Food,
  type FoodLogItem,
  type MealType,
} from '@mylife/nutrition';
import { ErrorState } from '@mylife/ui';
import {
  PanGestureHandler,
  State,
  Swipeable,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { useDatabase } from '../../../components/DatabaseProvider';

type MealKey = MealType;

type MealSection = {
  mealType: MealKey;
  label: string;
  icon: string;
  items: Array<FoodLogItem & { food: Food | null }>;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
};

const MEAL_META: Record<MealKey, { label: string; icon: string }> = {
  breakfast: { label: 'Breakfast', icon: 'breakfast_dining' },
  lunch: { label: 'Lunch', icon: 'lunch_dining' },
  dinner: { label: 'Dinner', icon: 'dinner_dining' },
  snack: { label: 'Snacks', icon: 'cookie' },
};

const MEAL_ORDER: MealKey[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function nextDay(date: string, delta: number): string {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + delta);
  return next.toISOString().slice(0, 10);
}

function formatMacro(value: number): string {
  return `${Math.round(value * 10) / 10}g`;
}

function getStatusMeta(consumed: number, goal: number) {
  if (goal <= 0) {
    return { label: 'No goal', color: NU_TEXT_TERTIARY };
  }

  const ratio = consumed / goal;
  if (ratio > 1.05) {
    return { label: 'Over goal', color: NU_GOAL_STATUS.over };
  }
  if (ratio >= 0.9) {
    return { label: 'On track', color: NU_GOAL_STATUS.met };
  }
  return { label: 'Under goal', color: NU_GOAL_STATUS.close };
}

export default function NutritionDiaryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();

  const [selectedDate, setSelectedDate] = useState(() =>
    typeof params.date === 'string' ? params.date : todayKey(),
  );
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<MealKey, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
    snack: false,
  });
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState(() => nextDay(selectedDate, 1));
  const [editingItem, setEditingItem] = useState<(FoodLogItem & { food: Food | null }) | null>(null);
  const [servingInput, setServingInput] = useState('');

  const state = useMemo(() => {
    try {
      const goals = getActiveGoals(db, selectedDate);
      const entries = getFoodLogEntries(db, selectedDate);
      const sections = MEAL_ORDER.map((mealType) => {
        const items = entries
          .filter((entry) => entry.mealType === mealType)
          .flatMap((entry) =>
            getFoodLogItems(db, entry.id).map((item) => ({
              ...item,
              food: getFoodById(db, item.foodId),
            })),
          );

        return {
          mealType,
          label: MEAL_META[mealType].label,
          icon: MEAL_META[mealType].icon,
          items,
          totalCalories: items.reduce((sum, item) => sum + item.calories, 0),
          totalProtein: items.reduce((sum, item) => sum + item.proteinG, 0),
          totalCarbs: items.reduce((sum, item) => sum + item.carbsG, 0),
          totalFat: items.reduce((sum, item) => sum + item.fatG, 0),
        } satisfies MealSection;
      });

      const totals = sections.reduce(
        (acc, section) => ({
          calories: acc.calories + section.totalCalories,
          protein: acc.protein + section.totalProtein,
          carbs: acc.carbs + section.totalCarbs,
          fat: acc.fat + section.totalFat,
          count: acc.count + section.items.length,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 },
      );

      return {
        error: null as string | null,
        goals,
        sections,
        totals,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load the diary.',
        goals: null,
        sections: [] as MealSection[],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 },
      };
    }
  }, [db, selectedDate, tick]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 120);
  }, []);

  const shiftDate = useCallback((delta: number) => {
    setSelectedDate((value) => nextDay(value, delta));
  }, []);

  const handleDateSwipe = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.state !== State.END) {
        return;
      }

      if (event.nativeEvent.translationX > 64) {
        shiftDate(-1);
      } else if (event.nativeEvent.translationX < -64) {
        shiftDate(1);
      }
    },
    [shiftDate],
  );

  const handleCopyDay = useCallback(() => {
    try {
      const copied = copyFoodLog(db, selectedDate, copyTargetDate.trim());
      setCopyModalVisible(false);
      setTick((value) => value + 1);
      Alert.alert(
        copied > 0 ? 'Day copied' : 'Nothing copied',
        copied > 0
          ? `Copied ${copied} logged item${copied === 1 ? '' : 's'} to ${copyTargetDate.trim()}.`
          : 'The source day has no logged foods yet.',
      );
    } catch (error) {
      Alert.alert(
        'Unable to copy day',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [copyTargetDate, db, selectedDate]);

  const handleDelete = useCallback(
    (itemId: string) => {
      try {
        deleteFoodLogItem(db, itemId);
        setTick((value) => value + 1);
      } catch (error) {
        Alert.alert(
          'Unable to delete item',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    },
    [db],
  );

  const handleOpenEditor = useCallback((item: FoodLogItem & { food: Food | null }) => {
    setEditingItem(item);
    setServingInput(String(item.servingCount));
  }, []);

  const handleSaveItem = useCallback(() => {
    if (!editingItem) {
      return;
    }

    const nextServing = Number.parseFloat(servingInput);
    if (!Number.isFinite(nextServing) || nextServing <= 0) {
      Alert.alert('Invalid serving', 'Enter a serving count greater than zero.');
      return;
    }

    try {
      const baseCalories = editingItem.food?.calories ?? editingItem.calories / Math.max(editingItem.servingCount, 1);
      const baseProtein = editingItem.food?.proteinG ?? editingItem.proteinG / Math.max(editingItem.servingCount, 1);
      const baseCarbs = editingItem.food?.carbsG ?? editingItem.carbsG / Math.max(editingItem.servingCount, 1);
      const baseFat = editingItem.food?.fatG ?? editingItem.fatG / Math.max(editingItem.servingCount, 1);

      updateFoodLogItem(db, editingItem.id, {
        servingCount: nextServing,
        calories: Math.round(baseCalories * nextServing),
        proteinG: Math.round(baseProtein * nextServing * 10) / 10,
        carbsG: Math.round(baseCarbs * nextServing * 10) / 10,
        fatG: Math.round(baseFat * nextServing * 10) / 10,
      });

      setEditingItem(null);
      setTick((value) => value + 1);
    } catch (error) {
      Alert.alert(
        'Unable to update item',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [db, editingItem, servingInput]);

  if (state.error) {
    return (
      <View style={styles.errorWrap}>
        <ErrorState message={state.error} onRetry={handleRefresh} />
      </View>
    );
  }

  const goalCalories = state.goals?.calories ?? 2200;
  const goalProtein = state.goals?.proteinG ?? 160;
  const goalCarbs = state.goals?.carbsG ?? 220;
  const goalFat = state.goals?.fatG ?? 70;
  const status = getStatusMeta(state.totals.calories, goalCalories);
  const isToday = selectedDate === todayKey();

  return (
    <View style={styles.screen}>
      <PanGestureHandler onHandlerStateChange={handleDateSwipe}>
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
              <View style={styles.headerLeft}>
                <Text style={styles.moduleName}>MyNutrition</Text>
                <Text style={styles.headerMeta}>Food diary</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.headerAction}
                  onPress={() => router.push('/(nutrition)/(tabs)/search' as never)}
                >
                  <MaterialSymbol name="search" size={20} color={NU_ACCENT_LIGHT} />
                </Pressable>
                <Pressable
                  style={styles.headerAction}
                  onPress={() => {
                    setCopyTargetDate(nextDay(selectedDate, 1));
                    setCopyModalVisible(true);
                  }}
                >
                  <MaterialSymbol name="content_copy" size={18} color={NU_ACCENT_LIGHT} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.dateNav}>
            <Pressable style={styles.navButton} onPress={() => shiftDate(-1)}>
              <MaterialSymbol name="chevron_left" size={20} color={NU_ACCENT_LIGHT} />
            </Pressable>
            <View style={styles.dateCenter}>
              <Text style={styles.dateLabel}>{formatLongDate(selectedDate)}</Text>
              {!isToday ? (
                <Pressable style={styles.todayPill} onPress={() => setSelectedDate(todayKey())}>
                  <Text style={styles.todayText}>Today</Text>
                </Pressable>
              ) : (
                <Text style={styles.dateHint}>Swipe left or right to change day</Text>
              )}
            </View>
            <Pressable style={styles.navButton} onPress={() => shiftDate(1)}>
              <MaterialSymbol name="chevron_right" size={20} color={NU_ACCENT_LIGHT} />
            </Pressable>
          </View>

          <View style={styles.totalsCard}>
            <CalorieRing consumed={state.totals.calories} goal={goalCalories} size={88} strokeWidth={8} />
            <View style={styles.totalsCopy}>
              <View style={styles.goalPillRow}>
                <Text style={styles.totalsEyebrow}>Daily totals</Text>
                <View style={[styles.goalPill, { backgroundColor: `${status.color}22` }]}>
                  <Text style={[styles.goalPillText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>

              <View style={styles.metricRow}>
                <MetricLine label="Calories" value={`${Math.round(state.totals.calories)}`} goal={`${goalCalories}`} accent={NU_CALORIE} />
                <MetricLine label="Protein" value={formatMacro(state.totals.protein)} goal={formatMacro(goalProtein)} accent={NU_ACCENT_LIGHT} />
                <MetricLine label="Carbs" value={formatMacro(state.totals.carbs)} goal={formatMacro(goalCarbs)} accent="#8BCFF0" />
                <MetricLine label="Fat" value={formatMacro(state.totals.fat)} goal={formatMacro(goalFat)} accent="#E6BFA0" />
              </View>
            </View>
          </View>

          <View style={styles.sectionStack}>
            {state.sections.map((section) => {
              const isCollapsed = collapsed[section.mealType];
              return (
                <View key={section.mealType} style={styles.mealSection}>
                  <Pressable
                    style={styles.mealSectionHeader}
                    onPress={() =>
                      setCollapsed((current) => ({
                        ...current,
                        [section.mealType]: !current[section.mealType],
                      }))
                    }
                  >
                    <View style={styles.mealSectionTitleRow}>
                      <MaterialSymbol name={section.icon} size={18} color={NU_ACCENT_LIGHT} />
                      <Text style={styles.mealSectionTitle}>{section.label}</Text>
                    </View>

                    <View style={styles.mealSectionMeta}>
                      <Text style={styles.mealSectionCalories}>{Math.round(section.totalCalories)} kcal</Text>
                      <MaterialSymbol
                        name={isCollapsed ? 'expand_more' : 'expand_less'}
                        size={18}
                        color={NU_TEXT_TERTIARY}
                      />
                    </View>
                  </Pressable>

                  {!isCollapsed ? (
                    <View style={styles.mealSectionBody}>
                      {section.items.length === 0 ? (
                        <Text style={styles.emptyMealText}>No items logged</Text>
                      ) : (
                        section.items.map((item) => (
                          <Swipeable
                            key={item.id}
                            renderLeftActions={() => (
                              <View style={styles.editActionWrap}>
                                <Pressable
                                  style={styles.editAction}
                                  onPress={() => handleOpenEditor(item)}
                                >
                                  <MaterialSymbol name="edit" size={16} color={NU_ACCENT_DARK} />
                                  <Text style={styles.editActionText}>Edit</Text>
                                </Pressable>
                              </View>
                            )}
                            renderRightActions={() => (
                              <View style={styles.deleteActionWrap}>
                                <Pressable
                                  style={styles.deleteAction}
                                  onPress={() => handleDelete(item.id)}
                                >
                                  <MaterialSymbol name="delete" size={16} color={NU_TEXT} />
                                  <Text style={styles.deleteActionText}>Delete</Text>
                                </Pressable>
                              </View>
                            )}
                          >
                            <Pressable
                              style={styles.foodRow}
                              onPress={() =>
                                router.push(`/(nutrition)/food/${item.foodId}` as never)
                              }
                            >
                              <View style={styles.foodCopy}>
                                <Text style={styles.foodName} numberOfLines={1}>
                                  {item.food?.name ?? 'Saved food'}
                                </Text>
                                <Text style={styles.foodMeta}>
                                  {item.servingCount} serving • P {formatMacro(item.proteinG)} • C{' '}
                                  {formatMacro(item.carbsG)} • F {formatMacro(item.fatG)}
                                </Text>
                              </View>
                              <Text style={styles.foodCalories}>{Math.round(item.calories)} kcal</Text>
                            </Pressable>
                          </Swipeable>
                        ))
                      )}

                      <Pressable
                        style={styles.addRow}
                        onPress={() =>
                          router.push(
                            `/(nutrition)/log?meal=${section.mealType}&date=${selectedDate}` as never,
                          )
                        }
                      >
                        <MaterialSymbol name="add" size={16} color={NU_ACCENT_LIGHT} />
                        <Text style={styles.addRowText}>Add to {section.label}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.dailyTotalCard}>
            <SectionHeader
              title="Daily total"
              action={
                <Text style={styles.sectionAction}>
                  {state.totals.count} item{state.totals.count === 1 ? '' : 's'}
                </Text>
              }
            />
            <Text style={styles.dailyTotalCalories}>{Math.round(state.totals.calories)} kcal</Text>
            <Text style={styles.dailyTotalMacros}>
              Protein {formatMacro(state.totals.protein)} • Carbs {formatMacro(state.totals.carbs)} • Fat {formatMacro(state.totals.fat)}
            </Text>
          </View>
        </ScrollView>
      </PanGestureHandler>

      <AddFoodFAB
        onPress={() =>
          router.push(`/(nutrition)/log?date=${selectedDate}` as never)
        }
      />

      <Modal visible={copyModalVisible} transparent animationType="fade" onRequestClose={() => setCopyModalVisible(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Copy this day</Text>
            <Text style={styles.modalBody}>
              Duplicate every meal from {selectedDate} into another date.
            </Text>
            <TextInput
              value={copyTargetDate}
              onChangeText={setCopyTargetDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={NU_TEXT_TERTIARY}
              style={styles.modalInput}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setCopyModalVisible(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={handleCopyDay}>
                <Text style={styles.modalPrimaryText}>Copy day</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(editingItem)} transparent animationType="fade" onRequestClose={() => setEditingItem(null)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit serving</Text>
            <Text style={styles.modalBody}>
              Update the serving count for {editingItem?.food?.name ?? 'this item'}.
            </Text>
            <TextInput
              value={servingInput}
              onChangeText={setServingInput}
              placeholder="1"
              placeholderTextColor={NU_TEXT_TERTIARY}
              style={styles.modalInput}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setEditingItem(null)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={handleSaveItem}>
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetricLine({
  label,
  value,
  goal,
  accent,
}: {
  label: string;
  value: string;
  goal: string;
  accent: string;
}) {
  return (
    <View style={styles.metricLine}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
        <Text style={styles.metricGoal}>/ {goal}</Text>
      </View>
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
    paddingBottom: 176,
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
  headerLeft: {
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
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
  },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.low,
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dateLabel: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
    textAlign: 'center',
  },
  dateHint: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
    textAlign: 'center',
  },
  todayPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,184,119,0.16)',
  },
  todayText: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_ACCENT_LIGHT,
  },
  totalsCard: {
    flexDirection: 'row',
    gap: 16,
    borderRadius: 28,
    padding: 18,
    backgroundColor: NU_SURFACES.low,
  },
  totalsCopy: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  goalPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalsEyebrow: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  goalPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  goalPillText: {
    ...NU_TYPOGRAPHY.labelUpper,
  },
  metricRow: {
    gap: 8,
  },
  metricLine: {
    gap: 2,
  },
  metricLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricValue: {
    ...NU_TYPOGRAPHY.titleMd,
  },
  metricGoal: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  sectionStack: {
    gap: 16,
  },
  mealSection: {
    borderRadius: 24,
    padding: 18,
    gap: 14,
    backgroundColor: NU_SURFACES.low,
  },
  mealSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealSectionTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  mealSectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealSectionCalories: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  mealSectionBody: {
    gap: 12,
  },
  emptyMealText: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_TERTIARY,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: NU_SURFACES.mid,
  },
  foodCopy: {
    flex: 1,
    gap: 4,
  },
  foodName: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  foodMeta: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  foodCalories: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_CALORIE,
  },
  editActionWrap: {
    justifyContent: 'center',
    marginRight: 10,
  },
  editAction: {
    width: 88,
    height: '100%',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: NU_ACCENT_LIGHT,
  },
  editActionText: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: '#4A2600',
  },
  deleteActionWrap: {
    justifyContent: 'center',
    marginLeft: 10,
  },
  deleteAction: {
    width: 92,
    height: '100%',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7A1A18',
  },
  deleteActionText: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,184,119,0.08)',
  },
  addRowText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_ACCENT_LIGHT,
  },
  dailyTotalCard: {
    borderRadius: 24,
    padding: 18,
    gap: 12,
    backgroundColor: NU_SURFACES.low,
  },
  sectionAction: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  dailyTotalCalories: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_CALORIE,
  },
  dailyTotalMacros: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  modalScrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    backgroundColor: NU_SURFACES.low,
  },
  modalTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  modalBody: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  modalInput: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: NU_SURFACES.mid,
    color: NU_TEXT,
    fontFamily: NU_TYPOGRAPHY.bodyMd.fontFamily,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalSecondary: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: NU_SURFACES.mid,
  },
  modalSecondaryText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT_SECONDARY,
  },
  modalPrimary: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: NU_ACCENT,
  },
  modalPrimaryText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: '#4A2600',
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: NU_SURFACES.base,
  },
});
