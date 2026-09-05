import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  FoodRow,
  GlassCard,
  MaterialSymbol,
  NU_ACCENT_LIGHT,
  NU_CALORIE,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  createCustomFood,
  getFavoriteIds,
  getFoodById,
  getMealTemplates,
  getRecentFoods,
  logMealTemplate,
  searchFoods,
  searchFoodsFTS,
  type Food,
  type MealTemplate,
  type MealType,
} from '@mylife/nutrition';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  NUTRITION_MEALS,
  formatFoodServing,
  getMealMeta,
  logFoodToMeal,
  resolveMealType,
  todayKey,
} from './phase2-data';

type ActiveTab = 'recent' | 'favorites' | 'templates';

const TABS: Array<{ key: ActiveTab; label: string }> = [
  { key: 'recent', label: 'Recent' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'templates', label: 'Templates' },
];

type CustomFoodForm = {
  name: string;
  brand: string;
  servingSize: string;
  servingUnit: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
};

const EMPTY_CUSTOM_FORM: CustomFoodForm = {
  name: '',
  brand: '',
  servingSize: '1',
  servingUnit: 'serving',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fiberG: '',
};

export default function LogFoodScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string; custom?: string }>();
  const searchRef = useRef<TextInput | null>(null);

  const [selectedMeal, setSelectedMeal] = useState<MealType>(
    resolveMealType(params.meal),
  );
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('recent');
  const [refreshToken, setRefreshToken] = useState(0);
  const [customVisible, setCustomVisible] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [portionFood, setPortionFood] = useState<Food | null>(null);
  const [portionVisible, setPortionVisible] = useState(false);
  const [portionCount, setPortionCount] = useState(1);
  const [customForm, setCustomForm] = useState<CustomFoodForm>(EMPTY_CUSTOM_FORM);

  useEffect(() => {
    if (params.custom === 'true') {
      setCustomVisible(true);
    }
  }, [params.custom]);

  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return [] as Food[];
    }

    try {
      const ftsResults = searchFoodsFTS(db, query.trim(), 30);
      if (ftsResults.length > 0) {
        return ftsResults;
      }
      return searchFoods(db, query.trim(), 30);
    } catch {
      try {
        return searchFoods(db, query.trim(), 30);
      } catch {
        return [] as Food[];
      }
    }
  }, [db, query]);

  const recentFoods = useMemo(() => {
    try {
      return getRecentFoods(db, 12);
    } catch {
      return [] as Food[];
    }
  }, [db, refreshToken]);

  const favoriteFoods = useMemo(() => {
    try {
      return getFavoriteIds(db)
        .map((foodId) => getFoodById(db, foodId))
        .filter((food): food is Food => food !== null)
        .slice(0, 12);
    } catch {
      return [] as Food[];
    }
  }, [db, refreshToken]);

  const templates = useMemo(() => {
    try {
      return getMealTemplates(db);
    } catch {
      return [] as MealTemplate[];
    }
  }, [db, refreshToken]);

  const mealMeta = getMealMeta(selectedMeal);
  const showingSearch = query.trim().length > 0;

  function handleClose() {
    router.replace('/(nutrition)/(tabs)/diary' as never);
  }

  function forceRefresh() {
    setRefreshToken((current) => current + 1);
  }

  function openPortionPicker(food: Food) {
    setPortionFood(food);
    setPortionCount(1);
    setPortionVisible(true);
  }

  function quickLogFood(food: Food, servings = 1) {
    try {
      logFoodToMeal(db, food, selectedMeal, { servingCount: servings });
      forceRefresh();
      Alert.alert('Added', `${food.name} added to ${mealMeta.label}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not add this food.';
      Alert.alert('Add failed', message);
    }
  }

  function handleTemplateLog(templateId: string, templateName: string) {
    try {
      const inserted = logMealTemplate(db, templateId, selectedMeal, todayKey());
      forceRefresh();
      if (inserted === 0) {
        Alert.alert('Template empty', 'This template does not have any foods yet.');
        return;
      }
      Alert.alert('Logged', `${templateName} added to ${mealMeta.label}.`);
      setTemplateVisible(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not log that meal template.';
      Alert.alert('Template failed', message);
    }
  }

  function handleCreateCustomFood() {
    try {
      const name = customForm.name.trim();
      const servingUnit = customForm.servingUnit.trim() || 'serving';
      const servingSize = Number(customForm.servingSize || '1');
      const calories = Number(customForm.calories || '0');

      if (!name) {
        Alert.alert('Missing name', 'Enter a food name before saving.');
        return;
      }
      if (!Number.isFinite(servingSize) || servingSize <= 0) {
        Alert.alert('Serving size', 'Serving size must be greater than zero.');
        return;
      }
      if (!Number.isFinite(calories) || calories < 0) {
        Alert.alert('Calories', 'Calories must be zero or greater.');
        return;
      }

      const createdFood = createCustomFood(db, {
        name,
        brand: customForm.brand.trim() || undefined,
        servingSize,
        servingUnit,
        calories,
        proteinG: Number(customForm.proteinG || '0') || 0,
        carbsG: Number(customForm.carbsG || '0') || 0,
        fatG: Number(customForm.fatG || '0') || 0,
        fiberG: Number(customForm.fiberG || '0') || 0,
      });

      logFoodToMeal(db, createdFood, selectedMeal);
      setCustomForm(EMPTY_CUSTOM_FORM);
      setCustomVisible(false);
      forceRefresh();
      Alert.alert('Saved', `${createdFood.name} was created and logged.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save that custom food.';
      Alert.alert('Save failed', message);
    }
  }

  function renderFoodList(foods: Food[]) {
    if (foods.length === 0) {
      return (
        <GlassCard style={styles.emptyCard}>
          <MaterialSymbol
            name="local_dining"
            size={24}
            color={NU_TEXT_TERTIARY}
          />
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyBody}>
            {showingSearch
              ? 'Try a different search term or add a custom food.'
              : 'Log a few foods and this list will fill in.'}
          </Text>
        </GlassCard>
      );
    }

    return foods.map((food) => (
      <FoodRow
        key={food.id}
        foodName={food.name}
        calories={food.calories}
        servingSize={formatFoodServing(food)}
        source={food.source}
        macros={{
          p: Math.round(food.proteinG),
          c: Math.round(food.carbsG),
          f: Math.round(food.fatG),
        }}
        onPress={() => openPortionPicker(food)}
        onAdd={() => quickLogFood(food)}
      />
    ));
  }

  const tabContent =
    activeTab === 'recent'
      ? renderFoodList(recentFoods)
      : activeTab === 'favorites'
        ? renderFoodList(favoriteFoods)
        : templates.length === 0
          ? renderFoodList([])
          : templates.map((template) => (
              <GlassCard
                key={template.id}
                style={styles.templateCard}
                onPress={() => handleTemplateLog(template.id, template.name)}
              >
                <View style={styles.templateIcon}>
                  <MaterialSymbol
                    name="restaurant"
                    size={18}
                    color={NU_ACCENT_LIGHT}
                  />
                </View>
                <View style={styles.templateCopy}>
                  <Text style={styles.templateTitle}>{template.name}</Text>
                  <Text style={styles.templateSubtitle}>
                    Saved as {getMealMeta(template.mealType).label}
                  </Text>
                </View>
                <LinearGradient
                  colors={[NU_ACCENT_LIGHT, NU_CALORIE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.inlineAddButton}
                >
                  <MaterialSymbol name="add" size={16} color="#4A2600" />
                </LinearGradient>
              </GlassCard>
            ));

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topGlow} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <MaterialSymbol name="arrow_back" size={18} color={NU_TEXT} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>Quick add to diary</Text>
            <Text style={styles.headerTitle}>Log Food</Text>
          </View>
          <Pressable
            style={styles.headerButton}
            onPress={handleClose}
            hitSlop={8}
          >
            <MaterialSymbol name="close" size={20} color={NU_TEXT_SECONDARY} />
          </Pressable>
        </View>

        <View style={styles.segmentStickyWrap}>
          <View style={styles.segmentedControl}>
            {NUTRITION_MEALS.map((meal) => {
              const selected = meal.key === selectedMeal;
              return (
                <Pressable
                  key={meal.key}
                  style={[
                    styles.segmentButton,
                    selected ? styles.segmentButtonActive : null,
                  ]}
                  onPress={() => setSelectedMeal(meal.key)}
                >
                  <MaterialSymbol
                    name={meal.icon}
                    size={16}
                    color={selected ? '#4A2600' : NU_TEXT_SECONDARY}
                    filled={selected}
                  />
                  <Text
                    style={[
                      styles.segmentLabel,
                      selected ? styles.segmentLabelActive : null,
                    ]}
                  >
                    {meal.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <GlassCard style={styles.searchCard}>
          <View style={styles.searchRow}>
            <MaterialSymbol name="search" size={18} color={NU_TEXT_TERTIARY} />
            <TextInput
              ref={searchRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Search foods or brands"
              placeholderTextColor={NU_TEXT_TERTIARY}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <MaterialSymbol name="close" size={18} color={NU_TEXT_TERTIARY} />
              </Pressable>
            ) : null}
          </View>
        </GlassCard>

        <View style={styles.actionGrid}>
          <QuickActionTile
            icon="search"
            label="Search"
            accent={NU_ACCENT_LIGHT}
            onPress={() => searchRef.current?.focus()}
          />
          <QuickActionTile
            icon="qr_code_scanner"
            label="Barcode"
            accent="#8BCFF0"
            onPress={() =>
              router.push(`/(nutrition)/scan?meal=${selectedMeal}` as never)
            }
          />
          <QuickActionTile
            icon="photo_camera"
            label="Photo"
            accent="#F9A8D4"
            onPress={() =>
              router.push(`/(nutrition)/photo?meal=${selectedMeal}` as never)
            }
          />
          <QuickActionTile
            icon="restaurant"
            label="Template"
            accent={NU_CALORIE}
            onPress={() => setTemplateVisible(true)}
          />
          <QuickActionTile
            icon="edit"
            label="Custom"
            accent="#D8B4FE"
            onPress={() => setCustomVisible(true)}
          />
        </View>

        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const selected = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabButton, selected ? styles.tabButtonActive : null]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text
                  style={[styles.tabLabel, selected ? styles.tabLabelActive : null]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.listStack}>
          {showingSearch ? renderFoodList(searchResults) : tabContent}
        </View>
      </ScrollView>

      <Modal
        visible={portionVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPortionVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setPortionVisible(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Adjust serving</Text>
            <Text style={styles.sheetBody}>
              {portionFood?.name ?? 'Food'} will be logged to {mealMeta.label}.
            </Text>
            <View style={styles.portionStepper}>
              <StepperButton
                label="-"
                onPress={() => setPortionCount((value) => Math.max(0.25, value - 0.25))}
              />
              <View style={styles.portionValueCard}>
                <Text style={styles.portionValue}>{portionCount.toFixed(2)}x</Text>
                <Text style={styles.portionCaption}>
                  {portionFood ? formatFoodServing(portionFood) : ''}
                </Text>
              </View>
              <StepperButton
                label="+"
                onPress={() => setPortionCount((value) => Math.min(8, value + 0.25))}
              />
            </View>
            <LinearGradient
              colors={[NU_ACCENT_LIGHT, NU_CALORIE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButton}
            >
              <Pressable
                style={styles.primaryButtonPressable}
                onPress={() => {
                  if (!portionFood) {
                    return;
                  }
                  try {
                    logFoodToMeal(db, portionFood, selectedMeal, {
                      servingCount: portionCount,
                    });
                    setPortionVisible(false);
                    forceRefresh();
                    Alert.alert(
                      'Added',
                      `${portionFood.name} added to ${mealMeta.label}.`,
                    );
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : 'Could not add this serving.';
                    Alert.alert('Add failed', message);
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>Add to {mealMeta.label}</Text>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={templateVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTemplateVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setTemplateVisible(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Meal templates</Text>
            <Text style={styles.sheetBody}>
              Add a saved meal into {mealMeta.label} with one tap.
            </Text>
            <ScrollView contentContainerStyle={styles.sheetList}>
              {templates.length === 0 ? (
                <Text style={styles.sheetEmpty}>No templates saved yet.</Text>
              ) : (
                templates.map((template) => (
                  <Pressable
                    key={template.id}
                    style={styles.sheetRow}
                    onPress={() => handleTemplateLog(template.id, template.name)}
                  >
                    <View style={styles.sheetRowIcon}>
                      <MaterialSymbol
                        name="restaurant"
                        size={16}
                        color={NU_ACCENT_LIGHT}
                      />
                    </View>
                    <View style={styles.sheetRowCopy}>
                      <Text style={styles.sheetRowTitle}>{template.name}</Text>
                      <Text style={styles.sheetRowSubtitle}>
                        Saved for {getMealMeta(template.mealType).label}
                      </Text>
                    </View>
                    <MaterialSymbol
                      name="chevron_right"
                      size={18}
                      color={NU_TEXT_TERTIARY}
                    />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={customVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setCustomVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardSheetHost}
          >
            <Pressable
              style={styles.sheetLarge}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Create custom food</Text>
              <Text style={styles.sheetBody}>
                Save a custom item and add it directly to {mealMeta.label}.
              </Text>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.formStack}
              >
                <SheetField
                  label="Food name"
                  value={customForm.name}
                  onChangeText={(value) =>
                    setCustomForm((current) => ({ ...current, name: value }))
                  }
                  placeholder="Homemade overnight oats"
                />
                <SheetField
                  label="Brand"
                  value={customForm.brand}
                  onChangeText={(value) =>
                    setCustomForm((current) => ({ ...current, brand: value }))
                  }
                  placeholder="Optional"
                />
                <View style={styles.formRow}>
                  <SheetField
                    label="Serving size"
                    value={customForm.servingSize}
                    onChangeText={(value) =>
                      setCustomForm((current) => ({
                        ...current,
                        servingSize: value,
                      }))
                    }
                    placeholder="1"
                    keyboardType="decimal-pad"
                  />
                  <SheetField
                    label="Serving unit"
                    value={customForm.servingUnit}
                    onChangeText={(value) =>
                      setCustomForm((current) => ({
                        ...current,
                        servingUnit: value,
                      }))
                    }
                    placeholder="serving"
                  />
                </View>
                <SheetField
                  label="Calories"
                  value={customForm.calories}
                  onChangeText={(value) =>
                    setCustomForm((current) => ({ ...current, calories: value }))
                  }
                  placeholder="420"
                  keyboardType="decimal-pad"
                />
                <View style={styles.formRow}>
                  <SheetField
                    label="Protein"
                    value={customForm.proteinG}
                    onChangeText={(value) =>
                      setCustomForm((current) => ({ ...current, proteinG: value }))
                    }
                    placeholder="24"
                    keyboardType="decimal-pad"
                  />
                  <SheetField
                    label="Carbs"
                    value={customForm.carbsG}
                    onChangeText={(value) =>
                      setCustomForm((current) => ({ ...current, carbsG: value }))
                    }
                    placeholder="38"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formRow}>
                  <SheetField
                    label="Fat"
                    value={customForm.fatG}
                    onChangeText={(value) =>
                      setCustomForm((current) => ({ ...current, fatG: value }))
                    }
                    placeholder="18"
                    keyboardType="decimal-pad"
                  />
                  <SheetField
                    label="Fiber"
                    value={customForm.fiberG}
                    onChangeText={(value) =>
                      setCustomForm((current) => ({ ...current, fiberG: value }))
                    }
                    placeholder="6"
                    keyboardType="decimal-pad"
                  />
                </View>
                <LinearGradient
                  colors={[NU_ACCENT_LIGHT, NU_CALORIE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <Pressable
                    style={styles.primaryButtonPressable}
                    onPress={handleCreateCustomFood}
                  >
                    <Text style={styles.primaryButtonText}>Save and log</Text>
                  </Pressable>
                </LinearGradient>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

function QuickActionTile({
  icon,
  label,
  accent,
  onPress,
}: {
  icon: string;
  label: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionTilePressable} onPress={onPress}>
      <GlassCard style={styles.actionTile}>
        <View style={[styles.actionIconWrap, { backgroundColor: `${accent}20` }]}>
          <MaterialSymbol name={icon} size={18} color={accent} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
      </GlassCard>
    </Pressable>
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

function SheetField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={styles.fieldStack}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={NU_TEXT_TERTIARY}
        style={styles.fieldInput}
        keyboardType={keyboardType}
      />
    </View>
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
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 6,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.low,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_SECONDARY,
  },
  headerTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
    fontSize: 30,
    lineHeight: 34,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  segmentStickyWrap: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: NU_SURFACES.lowest,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 6,
  },
  segmentButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  segmentButtonActive: {
    backgroundColor: NU_ACCENT_LIGHT,
  },
  segmentLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  segmentLabelActive: {
    color: '#4A2600',
  },
  searchCard: {
    paddingVertical: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: NU_TEXT,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    paddingVertical: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  actionTilePressable: {
    flex: 1,
  },
  actionTile: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.low,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255,184,119,0.18)',
  },
  tabLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  tabLabelActive: {
    color: NU_ACCENT_LIGHT,
  },
  listStack: {
    gap: 12,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  emptyTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  emptyBody: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    textAlign: 'center',
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,184,119,0.12)',
  },
  templateCopy: {
    flex: 1,
    gap: 2,
  },
  templateTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  templateSubtitle: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  inlineAddButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  keyboardSheetHost: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: NU_SURFACES.base,
    gap: 12,
  },
  sheetLarge: {
    maxHeight: '82%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: NU_SURFACES.base,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 52,
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
  portionStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.low,
  },
  stepperLabel: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  portionValueCard: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: NU_SURFACES.low,
  },
  portionValue: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  portionCaption: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  primaryButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  primaryButtonPressable: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: '#4A2600',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sheetList: {
    gap: 12,
    paddingBottom: 12,
  },
  sheetEmpty: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
    textAlign: 'center',
    paddingVertical: 24,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: NU_SURFACES.low,
  },
  sheetRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,184,119,0.16)',
  },
  sheetRowCopy: {
    flex: 1,
    gap: 2,
  },
  sheetRowTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  sheetRowSubtitle: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  formStack: {
    gap: 12,
    paddingBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldStack: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_SECONDARY,
  },
  fieldInput: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: NU_TEXT,
    backgroundColor: NU_SURFACES.low,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
  },
});
