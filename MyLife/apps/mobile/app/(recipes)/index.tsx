import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Heart,
  Plus,
  ShoppingCart,
} from 'lucide-react-native';
import {
  countRecipes,
  getMealPlanWeek,
  getPantryItems,
  getRecipes,
  getShoppingLists,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_DANGER,
  RECIPES_GLASS,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
  type MealPlanItem,
  type MealSlot,
  type Recipe,
  type ShoppingList,
} from '@mylife/bestchef';
import { ErrorState, LoadingState, Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type EnrichedMeal = MealPlanItem & {
  recipe_title: string;
  recipe_image_uri: string | null;
};

function todayWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning, Chef';
  if (hour < 18) return 'Good afternoon, Chef';
  return 'Good evening, Chef';
}

function formatCookTime(mins: number | null | undefined): string | undefined {
  if (mins == null || mins <= 0) return undefined;
  if (mins < 60) return `${mins}m`;
  const hours = mins / 60;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

function recipeSubtitle(recipe: Recipe): string {
  if (recipe.description != null && recipe.description.trim().length > 0) {
    return recipe.description.trim();
  }
  if (recipe.difficulty != null) {
    const cap = recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1);
    return `${cap} recipe`;
  }
  return 'Tap to view';
}

const MEAL_SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function sortMealsBySlot(meals: EnrichedMeal[]): EnrichedMeal[] {
  return [...meals].sort(
    (a, b) => MEAL_SLOT_ORDER.indexOf(a.meal_slot) - MEAL_SLOT_ORDER.indexOf(b.meal_slot),
  );
}

export default function RecipesHomeScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [totalRecipes, setTotalRecipes] = useState(0);
  const [favorites, setFavorites] = useState(0);
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);
  const [todayMeals, setTodayMeals] = useState<EnrichedMeal[]>([]);
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [pantryNeededCount, setPantryNeededCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      setTotalRecipes(countRecipes(db));
      setFavorites(countRecipes(db, { is_favorite: true }));
      setRecentRecipes(getRecipes(db, { limit: 6 }));

      const weekStart = todayWeekStart();
      const weekItems = getMealPlanWeek(db, weekStart);
      const todayDow = (new Date().getDay() + 6) % 7;
      setTodayMeals(weekItems.filter((item) => item.day_of_week === todayDow));

      const activeLists = getShoppingLists(db, true);
      setActiveList(activeLists.length > 0 ? activeLists[0] : null);

      const expiringOrExpired = getPantryItems(db, { expirationStatus: 'expiring_soon' }).length
        + getPantryItems(db, { expirationStatus: 'expired' }).length;
      setPantryNeededCount(expiringOrExpired);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={4} />
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

  const sortedMeals = sortMealsBySlot(todayMeals);

  const handleViewShopping = () => {
    if (activeList != null) {
      router.push({
        pathname: '/(recipes)/shopping-list',
        params: { listId: activeList.id },
      });
    } else {
      router.push('/(recipes)/shopping-lists');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.greetingLabel}>WHAT'S ON THE MENU TONIGHT?</Text>
        </View>

        {/* Stats Bento Row */}
        <View style={styles.statsRow}>
          <Pressable
            style={({ pressed }) => [styles.statCard, pressed && styles.statCardPressed]}
            onPress={() => router.push('/(recipes)/recipes-tab')}
          >
            <View style={[styles.statIconBox, { backgroundColor: `${RECIPES_SECONDARY}1A` }]}>
              <BookOpen size={22} color={RECIPES_SECONDARY} strokeWidth={2} />
            </View>
            <Text style={styles.statValue}>{totalRecipes}</Text>
            <Text style={styles.statLabel}>RECIPES</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.statCard, pressed && styles.statCardPressed]}
            onPress={() => router.push('/(recipes)/recipes-tab')}
          >
            <View style={[styles.statIconBox, { backgroundColor: `${RECIPES_DANGER}1A` }]}>
              <Heart size={22} color={RECIPES_DANGER} strokeWidth={2} fill={RECIPES_DANGER} />
            </View>
            <Text style={styles.statValue}>{favorites}</Text>
            <Text style={styles.statLabel}>FAVORITES</Text>
          </Pressable>
        </View>

        {/* Recent Recipes Carousel */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Recipes</Text>
            <Pressable onPress={() => router.push('/(recipes)/recipes-tab')} hitSlop={8}>
              <Text style={styles.seeAll}>SEE ALL</Text>
            </Pressable>
          </View>
          {recentRecipes.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {recentRecipes.map((recipe) => {
                const cookTime = formatCookTime(recipe.total_time_mins ?? recipe.cook_time_mins);
                return (
                  <Pressable
                    key={recipe.id}
                    style={styles.recipeCard}
                    onPress={() => router.push(`/(recipes)/recipe/${recipe.id}`)}
                  >
                    <View style={styles.recipePhotoWrap}>
                      {recipe.image_uri != null ? (
                        <Image
                          source={{ uri: recipe.image_uri }}
                          style={styles.recipePhoto}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.recipePhotoPlaceholder}>
                          <Text style={styles.recipePhotoGlyph}>
                            {recipe.title.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {cookTime != null && (
                        <View style={styles.cookTimeBadge}>
                          <Text style={styles.cookTimeBadgeText}>{cookTime}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.recipeTitle} numberOfLines={2}>
                      {recipe.title}
                    </Text>
                    <Text style={styles.recipeSubtitle} numberOfLines={1}>
                      {recipeSubtitle(recipe)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Pressable
              style={styles.emptyCarousel}
              onPress={() => router.push('/(recipes)/add-recipe')}
            >
              <Text style={styles.emptyTitle}>No recipes yet</Text>
              <Text style={styles.emptyMessage}>Tap to add your first recipe</Text>
            </Pressable>
          )}
        </View>

        {/* Today's Meal Plan */}
        <Pressable
          style={styles.bentoCard}
          onPress={() => router.push('/(recipes)/meal-plan')}
        >
          <View style={styles.bentoHeader}>
            <CalendarDays size={20} color={RECIPES_SECONDARY} strokeWidth={2} />
            <Text style={styles.bentoTitle}>Today's Meal Plan</Text>
          </View>
          <View style={styles.mealList}>
            {(['breakfast', 'lunch', 'dinner'] as const).map((slot, idx, arr) => {
              const meal = sortedMeals.find((m) => m.meal_slot === slot);
              const isLast = idx === arr.length - 1;
              return (
                <View
                  key={slot}
                  style={[styles.mealRow, !isLast && styles.mealRowDivider]}
                >
                  <Text style={styles.mealSlotLabel}>{slot.toUpperCase()}</Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.mealName,
                      meal == null && styles.mealNameEmpty,
                    ]}
                  >
                    {meal != null ? meal.recipe_title : 'Tap to plan'}
                  </Text>
                </View>
              );
            })}
          </View>
        </Pressable>

        {/* Pantry Alert */}
        <View style={styles.bentoCard}>
          <View style={styles.pantryDecoration} />
          <View style={[styles.pantryIconCircle, { backgroundColor: `${RECIPES_ACCENT}1A` }]}>
            <ShoppingCart size={22} color={RECIPES_ACCENT} strokeWidth={2} />
          </View>
          <Text style={styles.pantryHeadline}>
            {pantryNeededCount > 0
              ? `${pantryNeededCount} items needed`
              : 'Pantry looks good'}
          </Text>
          <Text style={styles.pantryDescription}>
            {pantryNeededCount > 0
              ? 'Your pantry is running low on essential spices and fresh produce.'
              : 'Nothing is expiring soon. Tap to review your shopping list.'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.pantryButton, pressed && styles.pantryButtonPressed]}
            onPress={handleViewShopping}
          >
            <Text style={styles.pantryButtonText}>View List</Text>
            <ArrowRight size={16} color="#0E0E13" strokeWidth={2.5} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/(recipes)/add-recipe')}
        hitSlop={8}
      >
        <Plus size={28} color="#0E0E13" strokeWidth={3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 160,
    gap: 32,
  },

  // Greeting
  greetingBlock: {
    gap: 6,
  },
  greeting: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 30,
    letterSpacing: -0.8,
    color: colors.text,
  },
  greetingLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: 'rgba(214, 195, 181, 0.6)',
  },

  // Stats Bento Row
  statsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 24,
    padding: 22,
    gap: 16,
  },
  statCardPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  statIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 28,
    color: colors.text,
  },
  statLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: 'rgba(214, 195, 181, 0.5)',
  },

  // Sections
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
  },
  seeAll: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: RECIPES_SECONDARY,
  },

  // Carousel
  carousel: {
    gap: 18,
    paddingRight: 8,
  },
  recipeCard: {
    width: 240,
    gap: 12,
  },
  recipePhotoWrap: {
    aspectRatio: 4 / 5,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: RECIPES_SURFACES.lift,
    position: 'relative',
  },
  recipePhoto: {
    width: '100%',
    height: '100%',
  },
  recipePhotoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECIPES_SURFACES.focus,
  },
  recipePhotoGlyph: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 56,
    color: RECIPES_SECONDARY,
  },
  cookTimeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: RECIPES_GLASS.backgroundColor,
  },
  cookTimeBadgeText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: colors.text,
  },
  recipeTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 17,
    color: colors.text,
    lineHeight: 21,
  },
  recipeSubtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  emptyCarousel: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  emptyMessage: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Bento Cards (meal plan, pantry)
  bentoCard: {
    backgroundColor: '#12121A',
    borderRadius: 24,
    padding: 28,
    gap: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  bentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bentoTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    fontSize: 17,
    color: colors.text,
  },
  mealList: {
    gap: 0,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  mealRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  mealSlotLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: 'rgba(214, 195, 181, 0.4)',
  },
  mealName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
    marginLeft: 16,
    textAlign: 'right',
  },
  mealNameEmpty: {
    color: 'rgba(214, 195, 181, 0.4)',
    fontFamily: JAKARTA_FONTS.medium,
  },

  // Pantry alert
  pantryIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pantryDecoration: {
    position: 'absolute',
    right: -50,
    bottom: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
  },
  pantryHeadline: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 24,
    color: colors.text,
  },
  pantryDescription: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  pantryButton: {
    marginTop: 8,
    backgroundColor: RECIPES_ACCENT,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pantryButtonPressed: {
    opacity: 0.85,
  },
  pantryButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#0E0E13',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 100,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: RECIPES_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: RECIPES_ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
  },
});
