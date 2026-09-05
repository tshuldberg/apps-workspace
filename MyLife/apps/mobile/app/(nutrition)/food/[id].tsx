import { useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalorieRing,
  GlassCard,
  MacroBar,
  MaterialSymbol,
  NutrientGauge,
  NU_ACCENT_LIGHT,
  NU_CALORIE,
  NU_MACROS,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  addFavorite,
  getActiveGoals,
  getFoodById,
  getFoodNutrients,
  getNutrientById,
  isFavorite,
  removeFavorite,
  type MealType,
  type Nutrient,
} from '@mylife/nutrition';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  NUTRITION_MEALS,
  formatFoodServing,
  getCachedFoodImage,
  getMealMeta,
  logFoodToMeal,
  resolveMealType,
  resolveSourceMeta,
  scaleFoodByServing,
} from '../phase2-data';

type DisplayMode = 'serving' | 'per100g';

type FoodNutrientDetail = {
  nutrient: Nutrient;
  amount: number;
};

const DEFAULT_MACRO_GOALS = {
  calories: 2000,
  proteinG: 140,
  carbsG: 250,
  fatG: 78,
  fiberG: 28,
};

export default function FoodDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; meal?: string }>();

  const food = useMemo(
    () => (params.id ? getFoodById(db, params.id) : null),
    [db, params.id],
  );
  const [favorite, setFavorite] = useState(
    () => (params.id ? isFavorite(db, params.id) : false),
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>('serving');
  const [portionCount, setPortionCount] = useState(1);
  const [showOtherNutrients, setShowOtherNutrients] = useState(false);
  const [mealSheetVisible, setMealSheetVisible] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(
    resolveMealType(params.meal),
  );

  const macroGoals = useMemo(() => {
    try {
      const goals = getActiveGoals(db, new Date().toISOString().slice(0, 10));
      if (!goals) {
        return DEFAULT_MACRO_GOALS;
      }

      return {
        calories: goals.calories,
        proteinG: goals.proteinG || DEFAULT_MACRO_GOALS.proteinG,
        carbsG: goals.carbsG || DEFAULT_MACRO_GOALS.carbsG,
        fatG: goals.fatG || DEFAULT_MACRO_GOALS.fatG,
        fiberG: DEFAULT_MACRO_GOALS.fiberG,
      };
    } catch {
      return DEFAULT_MACRO_GOALS;
    }
  }, [db]);

  const nutrientDetails = useMemo(() => {
    if (!food) {
      return [] as FoodNutrientDetail[];
    }

    try {
      return getFoodNutrients(db, food.id)
        .map((item) => {
          const nutrient = getNutrientById(db, item.nutrientId);
          if (!nutrient) {
            return null;
          }
          return {
            nutrient,
            amount: item.amount,
          };
        })
        .filter((item): item is FoodNutrientDetail => item !== null)
        .sort((left, right) => left.nutrient.sortOrder - right.nutrient.sortOrder);
    } catch {
      return [] as FoodNutrientDetail[];
    }
  }, [db, food]);

  const heroImage = useMemo(
    () => (food ? getCachedFoodImage(db, food) : null),
    [db, food],
  );

  if (!food) {
    return (
      <View style={styles.missingScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missingTitle}>Food not found</Text>
        <Text style={styles.missingBody}>
          This item could not be loaded from the nutrition database.
        </Text>
        <Pressable style={styles.missingButton} onPress={() => router.back()}>
          <Text style={styles.missingButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const foodItem = food;

  const displayMultiplier =
    displayMode === 'per100g' && foodItem.servingSize > 0
      ? 100 / foodItem.servingSize
      : 1;
  const effectiveServingCount = portionCount * displayMultiplier;
  const scaled = scaleFoodByServing(foodItem, effectiveServingCount);
  const vitamins = nutrientDetails.filter(
    (item) => item.nutrient.category === 'vitamin',
  );
  const minerals = nutrientDetails.filter(
    (item) => item.nutrient.category === 'mineral',
  );
  const otherNutrients = nutrientDetails.filter(
    (item) =>
      item.nutrient.category !== 'vitamin' &&
      item.nutrient.category !== 'mineral',
  );

  const sourceMeta = resolveSourceMeta(foodItem.source);
  const mealMeta = getMealMeta(selectedMeal);
  const addButtonLabel = params.meal
    ? `Add to ${mealMeta.label}`
    : 'Add to meal';

  async function handleShare() {
    try {
      await Share.share({
        message: `${foodItem.name}\n${Math.round(scaled.calories)} kcal per ${
          displayMode === 'per100g' ? '100g' : formatFoodServing(foodItem)
        }\nProtein ${scaled.proteinG}g • Carbs ${scaled.carbsG}g • Fat ${scaled.fatG}g`,
      });
    } catch {
      Alert.alert('Share unavailable', 'Could not open the share sheet.');
    }
  }

  function handleFavoriteToggle() {
    try {
      if (favorite) {
        removeFavorite(db, foodItem.id);
      } else {
        addFavorite(db, uuid(), foodItem.id);
      }
      setFavorite((current) => !current);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not update favorite.';
      Alert.alert('Favorite failed', message);
    }
  }

  function handleAddToMeal() {
    if (!params.meal) {
      setMealSheetVisible(true);
      return;
    }

    try {
      logFoodToMeal(db, foodItem, selectedMeal, {
        servingCount: effectiveServingCount,
      });
      router.back();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not log this food.';
      Alert.alert('Add failed', message);
    }
  }

  function confirmMealSelection() {
    try {
      logFoodToMeal(db, foodItem, selectedMeal, {
        servingCount: effectiveServingCount,
      });
      setMealSheetVisible(false);
      router.back();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not log this food.';
      Alert.alert('Add failed', message);
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {heroImage ? (
            <ImageBackground
              source={{ uri: heroImage }}
              style={styles.heroImage}
              imageStyle={styles.heroImageStyle}
            >
              <LinearGradient
                colors={['rgba(14,14,19,0.08)', 'rgba(14,14,19,0.92)']}
                style={styles.heroOverlay}
              />
            </ImageBackground>
          ) : (
            <LinearGradient
              colors={['#221209', '#3D1E06', '#0E0E13']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroImage}
            >
              <View style={styles.heroAmbientOrb} />
              <View style={styles.heroFallbackIcon}>
                <MaterialSymbol
                  name={sourceMeta.icon}
                  size={56}
                  color={sourceMeta.color}
                />
              </View>
            </LinearGradient>
          )}

          <View style={styles.heroChrome}>
            <View style={styles.heroHeader}>
              <Pressable style={styles.heroButton} onPress={() => router.back()}>
                <MaterialSymbol name="arrow_back" size={18} color={NU_TEXT} />
              </Pressable>
              <View style={styles.heroActions}>
                <Pressable style={styles.heroButton} onPress={handleShare}>
                  <MaterialSymbol name="share" size={18} color={NU_TEXT} />
                </Pressable>
                <Pressable style={styles.heroButton} onPress={handleFavoriteToggle}>
                  <MaterialSymbol
                    name="favorite"
                    size={18}
                    color={favorite ? NU_ACCENT_LIGHT : NU_TEXT}
                    filled={favorite}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.heroMeta}>
              <View style={[styles.sourceBadge, { backgroundColor: `${sourceMeta.color}1A` }]}>
                <MaterialSymbol
                  name={sourceMeta.icon}
                  size={13}
                  color={sourceMeta.color}
                />
                <Text style={[styles.sourceBadgeText, { color: sourceMeta.color }]}>
                  {sourceMeta.label}
                </Text>
              </View>
              <Text style={styles.foodTitle}>{foodItem.name}</Text>
              {foodItem.brand ? (
                <View style={styles.brandChip}>
                  <Text style={styles.brandChipText}>{foodItem.brand}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <GlassCard elevated style={styles.servingCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Serving picker</Text>
            <Text style={styles.sectionHint}>
              {displayMode === 'per100g' ? 'Per 100g mode' : 'Base serving mode'}
            </Text>
          </View>
          <View style={styles.displayToggleRow}>
            {[
              { key: 'serving' as const, label: `Per ${formatFoodServing(foodItem)}` },
              { key: 'per100g' as const, label: 'Per 100g' },
            ].map((option) => {
              const selected = displayMode === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[
                    styles.displayToggle,
                    selected ? styles.displayToggleActive : null,
                  ]}
                  onPress={() => setDisplayMode(option.key)}
                >
                  <Text
                    style={[
                      styles.displayToggleLabel,
                      selected ? styles.displayToggleLabelActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.quantityRow}>
            <StepperButton
              label="-"
              onPress={() => setPortionCount((value) => Math.max(0.25, value - 0.25))}
            />
            <View style={styles.quantityValueCard}>
              <Text style={styles.quantityValue}>{portionCount.toFixed(2)}x</Text>
              <Text style={styles.quantityHint}>
                {displayMode === 'per100g'
                  ? `${(portionCount * 100).toFixed(0)}g total`
                  : `${formatFoodServing(foodItem)} each`}
              </Text>
            </View>
            <StepperButton
              label="+"
              onPress={() => setPortionCount((value) => Math.min(8, value + 0.25))}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.macroCard}>
          <View style={styles.macroCardRow}>
            <CalorieRing
              consumed={scaled.calories}
              goal={macroGoals.calories}
              size={96}
              strokeWidth={8}
            />
            <View style={styles.macroList}>
              <MacroBar
                label="protein"
                grams={scaled.proteinG}
                goalGrams={macroGoals.proteinG}
                color={NU_MACROS.protein}
              />
              <MacroBar
                label="carbs"
                grams={scaled.carbsG}
                goalGrams={macroGoals.carbsG}
                color={NU_MACROS.carbs}
              />
              <MacroBar
                label="fat"
                grams={scaled.fatG}
                goalGrams={macroGoals.fatG}
                color={NU_MACROS.fat}
              />
              <MacroBar
                label="fiber"
                grams={scaled.fiberG}
                goalGrams={macroGoals.fiberG}
                color={NU_MACROS.fiber}
              />
            </View>
          </View>
        </GlassCard>

        <NutrientSection
          title="Vitamins"
          accent={NU_ACCENT_LIGHT}
          nutrients={vitamins}
          effectiveServingCount={effectiveServingCount}
          emptyLabel="No vitamin panel is available for this food."
        />

        <NutrientSection
          title="Minerals"
          accent="#8BCFF0"
          nutrients={minerals}
          effectiveServingCount={effectiveServingCount}
          emptyLabel="No mineral panel is available for this food."
        />

        <GlassCard style={styles.otherCard}>
          <Pressable
            style={styles.sectionRow}
            onPress={() => setShowOtherNutrients((current) => !current)}
          >
            <Text style={styles.sectionTitle}>Other nutrients</Text>
            <View style={styles.sectionHintRow}>
              <Text style={styles.sectionHint}>
                {showOtherNutrients ? 'Collapse' : 'Expand'}
              </Text>
              <MaterialSymbol
                name={showOtherNutrients ? 'expand_less' : 'expand_more'}
                size={18}
                color={NU_TEXT_TERTIARY}
              />
            </View>
          </Pressable>
          {showOtherNutrients ? (
            otherNutrients.length > 0 ? (
              <View style={styles.otherList}>
                {otherNutrients.map((item) => (
                  <View key={item.nutrient.id} style={styles.otherRow}>
                    <Text style={styles.otherName}>{item.nutrient.name}</Text>
                    <Text style={styles.otherValue}>
                      {Math.round(item.amount * effectiveServingCount * 10) / 10}
                      {item.nutrient.unit}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyBody}>
                No additional nutrient data was attached to this item.
              </Text>
            )
          ) : null}
        </GlassCard>

        <GlassCard style={styles.attributionCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Source attribution</Text>
            <View style={[styles.sourceBadge, { backgroundColor: `${sourceMeta.color}1A` }]}>
              <MaterialSymbol
                name={sourceMeta.icon}
                size={13}
                color={sourceMeta.color}
              />
              <Text style={[styles.sourceBadgeText, { color: sourceMeta.color }]}>
                {sourceMeta.label}
              </Text>
            </View>
          </View>
          <Text style={styles.attributionText}>
            Data from{' '}
            {foodItem.source === 'usda'
              ? 'USDA'
              : foodItem.source === 'open_food_facts'
                ? 'Open Food Facts'
                : foodItem.source === 'fatsecret'
                  ? 'FatSecret'
                  : foodItem.source === 'ai_photo'
                    ? 'AI Photo Estimate'
                    : 'Custom Entry'}
            .
          </Text>
        </GlassCard>
      </ScrollView>

      <View style={styles.footer}>
        <LinearGradient
          colors={[NU_ACCENT_LIGHT, NU_CALORIE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.footerButtonWrap}
        >
          <Pressable style={styles.footerButton} onPress={handleAddToMeal}>
            <Text style={styles.footerButtonText}>{addButtonLabel}</Text>
          </Pressable>
        </LinearGradient>
      </View>

      <Modal
        visible={mealSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMealSheetVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setMealSheetVisible(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Choose a meal</Text>
            <Text style={styles.sheetBody}>
              Add {foodItem.name} with {portionCount.toFixed(2)}x serving.
            </Text>
            <View style={styles.mealChoices}>
              {NUTRITION_MEALS.map((meal) => {
                const selected = meal.key === selectedMeal;
                return (
                  <Pressable
                    key={meal.key}
                    style={[
                      styles.mealChoice,
                      selected ? styles.mealChoiceActive : null,
                    ]}
                    onPress={() => setSelectedMeal(meal.key)}
                  >
                    <MaterialSymbol
                      name={meal.icon}
                      size={18}
                      color={selected ? '#4A2600' : NU_TEXT_SECONDARY}
                      filled={selected}
                    />
                    <Text
                      style={[
                        styles.mealChoiceLabel,
                        selected ? styles.mealChoiceLabelActive : null,
                      ]}
                    >
                      {meal.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <LinearGradient
              colors={[NU_ACCENT_LIGHT, NU_CALORIE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirmButtonWrap}
            >
              <Pressable style={styles.confirmButton} onPress={confirmMealSelection}>
                <Text style={styles.confirmButtonText}>
                  Add to {getMealMeta(selectedMeal).label}
                </Text>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function NutrientSection({
  title,
  accent,
  nutrients,
  effectiveServingCount,
  emptyLabel,
}: {
  title: string;
  accent: string;
  nutrients: FoodNutrientDetail[];
  effectiveServingCount: number;
  emptyLabel: string;
}) {
  return (
    <GlassCard style={styles.nutrientSection}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={[styles.sectionHint, { color: accent }]}>
          {nutrients.length} tracked
        </Text>
      </View>
      {nutrients.length === 0 ? (
        <Text style={styles.emptyBody}>{emptyLabel}</Text>
      ) : (
        <View style={styles.gaugeGrid}>
          {nutrients.map((item) => (
            <View key={item.nutrient.id} style={styles.gaugeCell}>
              <NutrientGauge
                name={item.nutrient.name}
                value={item.amount * effectiveServingCount}
                goal={item.nutrient.rdaValue ?? Math.max(item.amount, 1)}
                unit={item.nutrient.unit}
                category={
                  item.nutrient.category === 'mineral' ? 'mineral' : 'vitamin'
                }
              />
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

function StepperButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.stepperButton} onPress={onPress}>
      <Text style={styles.stepperLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NU_SURFACES.lowest,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  hero: {
    height: 288,
    position: 'relative',
    backgroundColor: '#1A120A',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageStyle: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroAmbientOrb: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(255,184,119,0.18)',
  },
  heroFallbackIcon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChrome: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  heroButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,14,19,0.52)',
  },
  heroMeta: {
    gap: 10,
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceBadgeText: {
    ...NU_TYPOGRAPHY.labelUpper,
  },
  foodTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.02 * 34,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  brandChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  brandChipText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  servingCard: {
    marginHorizontal: 16,
    marginTop: -28,
    gap: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  sectionHint: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  sectionHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  displayToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  displayToggle: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: NU_SURFACES.low,
  },
  displayToggleActive: {
    backgroundColor: 'rgba(255,184,119,0.18)',
  },
  displayToggleLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  displayToggleLabelActive: {
    color: NU_ACCENT_LIGHT,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.low,
  },
  stepperLabel: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  quantityValueCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 12,
    backgroundColor: NU_SURFACES.low,
  },
  quantityValue: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  quantityHint: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  macroCard: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  macroCardRow: {
    flexDirection: 'row',
    gap: 14,
  },
  macroList: {
    flex: 1,
    gap: 10,
  },
  nutrientSection: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 14,
  },
  gaugeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gaugeCell: {
    width: '31%',
  },
  otherCard: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  otherList: {
    gap: 10,
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: NU_SURFACES.low,
  },
  otherName: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT,
    flex: 1,
  },
  otherValue: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  attributionCard: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  attributionText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  emptyBody: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  footerButtonWrap: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  footerButton: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: '#4A2600',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: NU_SURFACES.base,
    gap: 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: NU_TEXT_TERTIARY,
    opacity: 0.5,
  },
  sheetTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
    textAlign: 'center',
  },
  sheetBody: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    textAlign: 'center',
  },
  mealChoices: {
    gap: 10,
  },
  mealChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: NU_SURFACES.low,
  },
  mealChoiceActive: {
    backgroundColor: NU_ACCENT_LIGHT,
  },
  mealChoiceLabel: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT_SECONDARY,
  },
  mealChoiceLabelActive: {
    color: '#4A2600',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  confirmButtonWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  confirmButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: '#4A2600',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  missingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: NU_SURFACES.lowest,
  },
  missingTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  missingBody: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    textAlign: 'center',
  },
  missingButton: {
    marginTop: 10,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: NU_ACCENT_LIGHT,
  },
  missingButtonText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: '#4A2600',
  },
});
