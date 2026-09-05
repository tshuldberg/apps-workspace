import { useCallback, useMemo, useState } from 'react';
import { uuid } from '../../../lib/uuid';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AddFoodFAB,
  CalorieRing,
  getActiveGoals,
  getDailySummary,
  getDailyWaterTotal,
  getFoodById,
  getFoodLogEntries,
  getFoodLogItems,
  getMealBreakdown,
  getSetting,
  getWaterGoalMl,
  MacroGrid,
  MaterialSymbol,
  MealCard,
  NU_ACCENT,
  NU_ACCENT_LIGHT,
  NU_GLASS_NAV,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  WaterTracker,
  createWaterEntry,
  type FoodLogItem,
} from '@mylife/nutrition';
import { EmptyState, ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type HomeMealCard = {
  mealType: MealKey;
  items: Array<FoodLogItem & { foodName?: string | null }>;
  totalKcal: number;
};

const MEAL_ORDER: MealKey[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NutritionHomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const date = todayKey();

  const state = useMemo(() => {
    try {
      const goals = getActiveGoals(db, date);
      const summary = getDailySummary(db, date);
      const waterConsumedMl = getDailyWaterTotal(db, date);
      const waterGoalMl = getWaterGoalMl(db);
      const displayName = getSetting(db, 'display_name')?.trim() ?? 'Curator';
      const mealBreakdown = getMealBreakdown(db, date);
      const entries = getFoodLogEntries(db, date);

      const meals: HomeMealCard[] = MEAL_ORDER.map((mealType) => {
        const mealEntries = entries.filter((entry) => entry.mealType === mealType);
        const items = mealEntries.flatMap((entry) =>
          getFoodLogItems(db, entry.id).map((item) => ({
            ...item,
            foodName: getFoodById(db, item.foodId)?.name ?? null,
          })),
        );
        const breakdown = mealBreakdown.find((row) => row.mealType === mealType);

        return {
          mealType,
          items,
          totalKcal: breakdown?.calories ?? items.reduce((sum, item) => sum + item.calories, 0),
        };
      });

      return {
        error: null as string | null,
        goals,
        summary,
        waterConsumedMl,
        waterGoalMl,
        displayName,
        meals,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load home screen.',
        goals: null,
        summary: null,
        waterConsumedMl: 0,
        waterGoalMl: 2500,
        displayName: 'Curator',
        meals: [] as HomeMealCard[],
      };
    }
  }, [db, date, tick]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 120);
  }, []);

  const handleQuickWaterAdd = useCallback(
    (amountMl: number) => {
      try {
        const nextAmount = amountMl > 0 ? amountMl : 750;
        createWaterEntry(db, uuid(), {
          date,
          amountMl: nextAmount,
          source: amountMl > 0 ? 'quick_add' : 'manual',
        });
        setTick((value) => value + 1);
        if (amountMl === 0) {
          Alert.alert('Hydration added', 'Logged a custom glass of 750 ml.');
        }
      } catch (error) {
        Alert.alert(
          'Unable to add water',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    },
    [db, date],
  );

  if (state.error) {
    return (
      <View style={styles.errorWrap}>
        <ErrorState message={state.error} onRetry={handleRefresh} />
      </View>
    );
  }

  const goals = state.goals;
  const summary = state.summary;
  const meals = state.meals;
  const hasLoggedFood = Boolean(summary && summary.calories > 0);
  const calorieGoal = goals?.calories ?? 2200;
  const proteinGoal = goals?.proteinG ?? 160;
  const carbsGoal = goals?.carbsG ?? 220;
  const fatGoal = goals?.fatG ?? 70;
  const fiberGoal = 30;
  const avatarLetter = state.displayName.slice(0, 1).toUpperCase();

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
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.moduleName}>MyNutrition</Text>
                <Text style={styles.headerMeta}>Digital Curator</Text>
              </View>
            </View>

            <Pressable style={styles.headerAction}>
              <MaterialSymbol name="notifications" size={20} color={NU_ACCENT_LIGHT} />
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <CalorieRing
            consumed={summary?.calories ?? 0}
            goal={calorieGoal}
            size={256}
            strokeWidth={12}
          />
          <Text style={styles.heroSubtitle}>
            {hasLoggedFood
              ? `${Math.max(calorieGoal - Math.round(summary?.calories ?? 0), 0)} kcal left today`
              : 'Start the day with one intentional meal'}
          </Text>
        </View>

        <MacroGrid
          protein={summary?.proteinG ?? 0}
          carbs={summary?.carbsG ?? 0}
          fat={summary?.fatG ?? 0}
          fiber={summary?.fiberG ?? 0}
          goals={{
            protein: proteinGoal,
            carbs: carbsGoal,
            fat: fatGoal,
            fiber: fiberGoal,
          }}
        />

        <WaterTracker
          consumedMl={state.waterConsumedMl}
          goalMl={state.waterGoalMl}
          onAdd={handleQuickWaterAdd}
        />

        {!hasLoggedFood ? (
          <View style={styles.emptyCard}>
            <EmptyState
              title="Log your first meal"
              message="Build the day around one simple entry. Search, scan, or snap a photo to start your diary."
              actionLabel="Open food log"
              onAction={() => router.push('/(nutrition)/log' as never)}
            />
          </View>
        ) : null}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Today&apos;s Meals</Text>
          <Pressable onPress={() => router.push('/(nutrition)/(tabs)/diary' as never)}>
            <Text style={styles.sectionAction}>Diary</Text>
          </Pressable>
        </View>

        <View style={styles.mealStack}>
          {meals.map((meal) => (
            <MealCard
              key={meal.mealType}
              mealType={meal.mealType}
              items={meal.items}
              totalKcal={meal.totalKcal}
              onPress={() =>
                router.push(
                  `/(nutrition)/(tabs)/diary?meal=${meal.mealType}` as never,
                )
              }
            />
          ))}
        </View>

        <View style={styles.secondaryCard}>
          <View style={styles.secondaryHeader}>
            <View style={styles.secondaryIcon}>
              <MaterialSymbol name="insights" size={18} color={NU_ACCENT_LIGHT} />
            </View>
            <View style={styles.secondaryCopy}>
              <Text style={styles.secondaryTitle}>Dashboard</Text>
              <Text style={styles.secondaryText}>
                Micronutrients, energy balance, and seven-day signal tracking.
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.secondaryLink}
            onPress={() => router.push('/(nutrition)/dashboard' as never)}
          >
            <Text style={styles.secondaryLinkText}>Open dashboard</Text>
            <MaterialSymbol name="arrow_outward" size={16} color={NU_ACCENT_LIGHT} />
          </Pressable>
        </View>
      </ScrollView>

      <AddFoodFAB onPress={() => router.push('/(nutrition)/log' as never)} />
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
    paddingBottom: 176,
    paddingHorizontal: 24,
    gap: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.high,
  },
  avatarLetter: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  headerCopy: {
    gap: 1,
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
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    gap: 14,
  },
  heroSubtitle: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
    textAlign: 'center',
  },
  emptyCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: NU_SURFACES.low,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  sectionAction: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_ACCENT_LIGHT,
  },
  mealStack: {
    gap: 14,
  },
  secondaryCard: {
    borderRadius: 24,
    padding: 20,
    gap: 16,
    backgroundColor: NU_SURFACES.low,
  },
  secondaryHeader: {
    flexDirection: 'row',
    gap: 14,
  },
  secondaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  secondaryCopy: {
    flex: 1,
    gap: 2,
  },
  secondaryTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  secondaryText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  secondaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryLinkText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_ACCENT_LIGHT,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: NU_SURFACES.base,
  },
});
