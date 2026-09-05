import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CheckCircle2,
  ChevronRight,
  Edit3,
  HelpCircle,
  Plus,
  X,
  Zap,
} from 'lucide-react-native';
import {
  createRecipe,
  parseIngredientText,
  detectStepTimerMinutes,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  type ParsedRecipe,
} from '@mylife/bestchef';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const HIGHLIGHT_ORANGE = '#C9894D';
const ACCENT_GOLD = RECIPES_SECONDARY;
const SAVE_GREEN = '#2D5A27';
const SAVE_GREEN_BRIGHT = '#386e31';
const SUBTLE_BORDER = 'rgba(255,255,255,0.05)';
const PLACEHOLDER = 'rgba(255,255,255,0.25)';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  url: 'Website',
  text: 'Pasted Text',
  photo: 'Photo',
  video: 'Video',
};

interface IngredientRow {
  id: string;
  text: string;
  unclear: boolean;
}

interface StepRow {
  id: string;
  text: string;
}

const UNCLEAR_HINTS = [
  'unclear',
  'approximately',
  'approx',
  'to taste',
  'about',
  'roughly',
  'some',
  '?',
];

function detectUnclear(text: string): boolean {
  const lower = text.toLowerCase();
  return UNCLEAR_HINTS.some((hint) => lower.includes(hint));
}

export default function ImportReviewScreen() {
  const params = useLocalSearchParams<{
    parsed?: string;
    source?: string;
    sourceUrl?: string;
    metaAuthor?: string;
    metaThumb?: string;
  }>();

  const router = useRouter();
  const db = useDatabase();

  const recipe: ParsedRecipe | null = useMemo(() => {
    if (!params.parsed) return null;
    try {
      return JSON.parse(params.parsed) as ParsedRecipe;
    } catch {
      return null;
    }
  }, [params.parsed]);

  const sourceLabel = PLATFORM_LABELS[params.source ?? 'url'] ?? params.source ?? 'your source';
  const thumbnailUri = params.metaThumb || null;

  const [title, setTitle] = useState(recipe?.title ?? '');
  const [servings, setServings] = useState(
    recipe?.servings != null ? String(recipe.servings) : '',
  );
  const [prepTime, setPrepTime] = useState(
    recipe?.prep_time_min != null ? String(recipe.prep_time_min) : '',
  );

  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    (recipe?.ingredients ?? []).map((line) => ({
      id: uuid(),
      text: line,
      unclear: detectUnclear(line),
    })),
  );

  const [steps, setSteps] = useState<StepRow[]>(() =>
    (recipe?.steps ?? []).map((line) => ({ id: uuid(), text: line })),
  );

  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  const updateIngredient = (id: string, text: string) => {
    setIngredients((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, text, unclear: detectUnclear(text) } : row,
      ),
    );
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((row) => row.id !== id));
  };

  const addIngredientRow = () => {
    setIngredients((prev) => [...prev, { id: uuid(), text: '', unclear: false }]);
  };

  const fixIngredient = (id: string) => {
    setIngredients((prev) =>
      prev.map((row) => (row.id === id ? { ...row, unclear: false } : row)),
    );
  };

  const updateStep = (id: string, text: string) => {
    setSteps((prev) => prev.map((row) => (row.id === id ? { ...row, text } : row)));
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((row) => row.id !== id));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { id: uuid(), text: '' }]);
  };

  const persistRecipe = (): boolean => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Missing title', 'Add a title before saving.');
      return false;
    }

    const servingsNum = servings ? Number.parseInt(servings, 10) || null : null;
    const prepNum = prepTime ? Number.parseInt(prepTime, 10) || null : null;

    try {
      const recipeId = uuid();
      createRecipe(db, recipeId, {
        title: cleanTitle,
        description: recipe?.description ?? null,
        servings: servingsNum,
        prep_time_mins: prepNum,
        cook_time_mins: recipe?.cook_time_min ?? null,
        total_time_mins: (prepNum ?? 0) + (recipe?.cook_time_min ?? 0) || null,
        difficulty: null,
        source_url: params.sourceUrl || null,
        image_uri: thumbnailUri,
        notes: null,
        rating: 0,
        is_favorite: 0,
      });

      ingredients
        .map((ing) => ({ ...ing, text: ing.text.trim() }))
        .filter((ing) => ing.text.length > 0)
        .forEach((ing, i) => {
          const parsed = parseIngredientText(ing.text);
          db.execute(
            `INSERT INTO rc_ingredients (id, recipe_id, name, quantity, unit, item, quantity_value, prep_note, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuid(),
              recipeId,
              parsed.prepNote ? `${parsed.item}, ${parsed.prepNote}` : parsed.item || ing.text,
              parsed.quantity != null ? String(parsed.quantity) : null,
              parsed.unit,
              parsed.item || ing.text,
              parsed.quantity,
              parsed.prepNote,
              i,
            ],
          );
        });

      steps
        .map((s) => ({ ...s, text: s.text.trim() }))
        .filter((s) => s.text.length > 0)
        .forEach((s, i) => {
          db.execute(
            `INSERT INTO rc_steps (id, recipe_id, step_number, instruction, timer_minutes, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuid(), recipeId, i + 1, s.text, detectStepTimerMinutes(s.text), i],
          );
        });

      return true;
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Could not save recipe.');
      return false;
    }
  };

  const handleSave = () => {
    if (persistRecipe()) router.dismissAll();
  };

  const handleLooksGood = () => {
    if (persistRecipe()) router.dismissAll();
  };

  const handleDiscard = () => {
    Alert.alert('Discard import?', 'Your edits will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => router.back(),
      },
    ]);
  };

  if (!recipe) {
    return (
      <>
        <Stack.Screen options={{ title: 'Review Import' }} />
        <View style={styles.errorContainer}>
          <RNText style={styles.errorTitle}>No recipe data</RNText>
          <RNText style={styles.errorMessage}>
            Could not parse recipe from the import source.
          </RNText>
          <Pressable onPress={() => router.back()} style={styles.errorBtn} hitSlop={6}>
            <RNText style={styles.errorBtnText}>Go Back</RNText>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Breadcrumb */}
        <View style={styles.breadcrumb}>
          <RNText style={styles.breadcrumbText}>IMPORT</RNText>
          <ChevronRight size={12} color={'rgba(228,225,233,0.4)'} strokeWidth={2} />
          <RNText style={[styles.breadcrumbText, styles.breadcrumbActive]}>
            REVIEW & PARSE
          </RNText>
        </View>

        {/* Modal container */}
        <View style={styles.modal}>
          {/* Hero header + actions */}
          <View style={styles.headerBlock}>
            <View style={styles.heroBlock}>
              <RNText style={styles.heroTitle}>Review Recipe Import</RNText>
              <RNText style={styles.heroSubtitle}>
                We've parsed the data from {sourceLabel}. Please verify the details
                before adding it to your library.
              </RNText>
            </View>
            <View style={styles.actionRow}>
              <Pressable onPress={handleDiscard} style={styles.discardBtn} hitSlop={6}>
                <X size={14} color={colors.text} strokeWidth={2.2} />
                <RNText style={styles.discardText}>Discard</RNText>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.saveBtn} hitSlop={6}>
                <CheckCircle2 size={14} color="#FFFFFF" strokeWidth={2.4} />
                <RNText style={styles.saveText}>Save Recipe</RNText>
              </Pressable>
            </View>
          </View>

          {/* Recipe title */}
          <View style={styles.fieldGroup}>
            <RNText style={styles.fieldLabel}>RECIPE TITLE</RNText>
            <View style={styles.titleField}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Recipe name"
                placeholderTextColor={PLACEHOLDER}
                style={styles.titleInput}
              />
              <View style={styles.titleAdornments}>
                {title.trim().length > 0 ? (
                  <CheckCircle2 size={16} color={SAVE_GREEN_BRIGHT} strokeWidth={2.4} />
                ) : null}
                <View style={styles.titleEditBtn}>
                  <Edit3 size={13} color={'rgba(214,195,181,0.7)'} strokeWidth={2} />
                </View>
              </View>
            </View>
          </View>

          {/* Meta grid */}
          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <RNText style={styles.metaLabel}>SERVINGS</RNText>
              <View style={styles.metaValueRow}>
                <TextInput
                  value={servings}
                  onChangeText={setServings}
                  placeholder="2"
                  placeholderTextColor={PLACEHOLDER}
                  keyboardType="numeric"
                  style={styles.metaInput}
                />
                {servings ? (
                  <CheckCircle2 size={14} color={SAVE_GREEN_BRIGHT} strokeWidth={2.4} />
                ) : null}
              </View>
            </View>
            <View style={styles.metaCard}>
              <RNText style={styles.metaLabel}>PREP TIME</RNText>
              <View style={styles.metaValueRow}>
                <TextInput
                  value={prepTime}
                  onChangeText={setPrepTime}
                  placeholder="15 min"
                  placeholderTextColor={PLACEHOLDER}
                  keyboardType="numeric"
                  style={styles.metaInput}
                />
                {prepTime ? (
                  <CheckCircle2 size={14} color={SAVE_GREEN_BRIGHT} strokeWidth={2.4} />
                ) : null}
              </View>
            </View>
          </View>

          {/* Ingredients */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <RNText style={styles.sectionTitle}>INGREDIENTS</RNText>
              <Pressable onPress={addIngredientRow} hitSlop={6} style={styles.addItemBtn}>
                <Plus size={14} color={'rgba(214,195,181,0.85)'} strokeWidth={2.2} />
                <RNText style={styles.addItemText}>Add Item</RNText>
              </Pressable>
            </View>

            <View style={styles.ingredientList}>
              {ingredients.length === 0 ? (
                <Pressable onPress={addIngredientRow} style={styles.emptyRow} hitSlop={4}>
                  <RNText style={styles.emptyText}>No ingredients parsed. Tap to add one.</RNText>
                </Pressable>
              ) : null}
              {ingredients.map((ing) => (
                <View
                  key={ing.id}
                  style={[styles.ingredientRow, ing.unclear && styles.ingredientRowUnclear]}
                >
                  {ing.unclear ? (
                    <HelpCircle size={16} color={HIGHLIGHT_ORANGE} strokeWidth={2.2} />
                  ) : (
                    <CheckCircle2 size={16} color={SAVE_GREEN_BRIGHT} strokeWidth={2.4} />
                  )}
                  <TextInput
                    value={ing.text}
                    onChangeText={(text) => updateIngredient(ing.id, text)}
                    placeholder="Add ingredient"
                    placeholderTextColor={PLACEHOLDER}
                    style={styles.ingredientInput}
                  />
                  {ing.unclear ? (
                    <Pressable
                      onPress={() => fixIngredient(ing.id)}
                      style={styles.fixPill}
                      hitSlop={4}
                    >
                      <RNText style={styles.fixPillText}>FIX</RNText>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => removeIngredient(ing.id)}
                      hitSlop={4}
                      style={styles.removeBtn}
                    >
                      <X size={12} color={'rgba(255,180,171,0.7)'} strokeWidth={2} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Photo */}
          <View style={styles.section}>
            <RNText style={styles.sectionTitle}>RECIPE PHOTO</RNText>
            <View style={styles.photoFrame}>
              {thumbnailUri ? (
                <Image
                  source={{ uri: thumbnailUri }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <RNText style={styles.photoPlaceholderText}>No photo extracted</RNText>
                </View>
              )}
              <View style={styles.photoGradient} pointerEvents="none" />
              <Pressable style={styles.changePhotoBtn} hitSlop={6}>
                <RNText style={styles.changePhotoText}>Change Photo</RNText>
              </Pressable>
            </View>
          </View>

          {/* Cooking steps -- vertical timeline */}
          <View style={styles.section}>
            <RNText style={styles.sectionTitle}>COOKING STEPS</RNText>
            <View style={styles.stepsList}>
              {steps.length === 0 ? (
                <Pressable onPress={addStep} style={styles.emptyRow} hitSlop={4}>
                  <RNText style={styles.emptyText}>No steps parsed. Tap to add one.</RNText>
                </Pressable>
              ) : null}
              {steps.map((step, i) => {
                const active = activeStepId === step.id;
                return (
                  <View key={step.id} style={styles.stepRow}>
                    <View style={styles.stepRail}>
                      <View
                        style={[
                          styles.stepBadge,
                          active ? styles.stepBadgeActive : styles.stepBadgeIdle,
                        ]}
                      >
                        <RNText
                          style={[
                            styles.stepBadgeText,
                            active ? styles.stepBadgeTextActive : styles.stepBadgeTextIdle,
                          ]}
                        >
                          {i + 1}
                        </RNText>
                      </View>
                      {i < steps.length - 1 ? <View style={styles.stepConnector} /> : null}
                    </View>
                    <View style={styles.stepBody}>
                      {active ? (
                        <View style={styles.stepEditCard}>
                          <TextInput
                            value={step.text}
                            onChangeText={(text) => updateStep(step.id, text)}
                            onBlur={() => setActiveStepId(null)}
                            placeholder={`Step ${i + 1}`}
                            placeholderTextColor={PLACEHOLDER}
                            style={styles.stepInputActive}
                            multiline
                            autoFocus
                          />
                        </View>
                      ) : (
                        <Pressable onPress={() => setActiveStepId(step.id)} hitSlop={4}>
                          <RNText style={styles.stepText}>{step.text || `Step ${i + 1}`}</RNText>
                        </Pressable>
                      )}
                      {steps.length > 1 ? (
                        <Pressable
                          onPress={() => removeStep(step.id)}
                          hitSlop={4}
                          style={styles.stepRemoveBtn}
                        >
                          <X size={12} color={'rgba(255,180,171,0.6)'} strokeWidth={2} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              <Pressable onPress={addStep} style={styles.addStepBtn} hitSlop={6}>
                <Plus size={14} color={HIGHLIGHT_ORANGE} strokeWidth={2.2} />
                <RNText style={styles.addStepText}>Add Step</RNText>
              </Pressable>
            </View>
          </View>

          {/* Looks Good quick save */}
          <View style={styles.quickSaveSection}>
            <Pressable onPress={handleLooksGood} style={styles.looksGoodBtn} hitSlop={6}>
              <Zap size={16} color="#1a1008" strokeWidth={2.6} />
              <RNText style={styles.looksGoodText}>Looks Good</RNText>
            </Pressable>
            <RNText style={styles.quickSaveHint}>
              USE "LOOKS GOOD" TO SKIP REMAINING CHECKS
            </RNText>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

void RECIPES_ACCENT;
void ACCENT_GOLD;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.depth,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 64,
    paddingBottom: 140,
    gap: 18,
  },

  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  breadcrumbText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(228,225,233,0.4)',
  },
  breadcrumbActive: {
    color: HIGHLIGHT_ORANGE,
  },

  modal: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 24,
    overflow: 'hidden',
  },

  headerBlock: {
    gap: 18,
  },
  heroBlock: {
    gap: 8,
  },
  heroTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 28,
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  heroSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  discardText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: SAVE_GREEN,
    shadowColor: SAVE_GREEN_BRIGHT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  saveText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: HIGHLIGHT_ORANGE,
    textTransform: 'uppercase',
  },
  titleField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RECIPES_SURFACES.highest,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  titleInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
    padding: 0,
  },
  titleAdornments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleEditBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaCard: {
    flex: 1,
    backgroundColor: 'rgba(53, 52, 58, 0.5)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: SUBTLE_BORDER,
    gap: 6,
  },
  metaLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  metaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
    padding: 0,
  },

  section: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: HIGHLIGHT_ORANGE,
    textTransform: 'uppercase',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addItemText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    color: 'rgba(214,195,181,0.85)',
  },

  ingredientList: {
    gap: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(53, 52, 58, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  ingredientRowUnclear: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(201,137,77,0.4)',
  },
  ingredientInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.text,
    padding: 0,
  },
  fixPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(201,137,77,0.20)',
  },
  fixPillText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 9,
    color: HIGHLIGHT_ORANGE,
    letterSpacing: 0.5,
  },
  removeBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(53, 52, 58, 0.3)',
    borderRadius: 12,
  },
  emptyText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  photoFrame: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: RECIPES_SURFACES.highest,
    borderWidth: 1,
    borderColor: SUBTLE_BORDER,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECIPES_SURFACES.highest,
  },
  photoPlaceholderText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  photoGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  changePhotoText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  stepsList: {
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepRail: {
    alignItems: 'center',
    width: 20,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeActive: {
    backgroundColor: HIGHLIGHT_ORANGE,
  },
  stepBadgeIdle: {
    backgroundColor: RECIPES_SURFACES.highest,
    borderWidth: 1,
    borderColor: 'rgba(159,142,129,0.5)',
  },
  stepBadgeText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 10,
  },
  stepBadgeTextActive: {
    color: '#131318',
  },
  stepBadgeTextIdle: {
    color: 'rgba(214,195,181,0.7)',
  },
  stepConnector: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    minHeight: 24,
  },
  stepBody: {
    flex: 1,
    paddingBottom: 22,
    position: 'relative',
  },
  stepText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
    paddingRight: 22,
  },
  stepEditCard: {
    backgroundColor: 'rgba(53, 52, 58, 0.35)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,137,77,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepInputActive: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.text,
    padding: 0,
    minHeight: 60,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  stepRemoveBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(159,142,129,0.35)',
    marginTop: 4,
  },
  addStepText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: HIGHLIGHT_ORANGE,
  },

  quickSaveSection: {
    gap: 8,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: SUBTLE_BORDER,
  },
  looksGoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#FFB877',
    shadowColor: '#FFB877',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  looksGoodText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 15,
    color: '#1a1008',
    letterSpacing: 0.2,
  },
  quickSaveHint: {
    textAlign: 'center',
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 9,
    color: 'rgba(214,195,181,0.45)',
    letterSpacing: 0.6,
  },

  errorContainer: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.depth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    color: colors.text,
  },
  errorMessage: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: HIGHLIGHT_ORANGE,
  },
  errorBtnText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: '#1a1008',
  },
});
