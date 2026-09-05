import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getRecipeById,
  getStructuredIngredients,
  getTags,
  addTag,
  deleteTag,
  updateRecipe,
  deleteRecipe,
  scaleIngredients,
  formatQuantity,
  calculateRecipeNutrition,
  generateShareText,
  suggestIngredientSubstitutions,
  previewDeduction,
  deductPantryForRecipe,
  getCollections,
  addRecipeToCollection,
  detectStepTimerMinutes,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  JAKARTA_FONTS,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import type {
  Recipe,
  RecipeTag,
  ScaledIngredient,
  Step,
  RecipeNutritionSummary,
  SubstitutionSuggestion,
  DeductionResult,
  Collection,
} from '@mylife/bestchef';
import type { DatabaseAdapter } from '@mylife/db';
import { EmptyState, ErrorState, LoadingState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

const ACCENT = RECIPES_ACCENT;
const GOLD = RECIPES_SECONDARY;

function getSteps(db: DatabaseAdapter, recipeId: string): Step[] {
  return db.query<Step>(
    `SELECT id, recipe_id, step_number, instruction, timer_minutes, sort_order
     FROM rc_steps WHERE recipe_id = ? ORDER BY sort_order ASC, step_number ASC`,
    [recipeId],
  );
}

function formatTimeShort(mins: number | null | undefined): string {
  if (!mins) return '--';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function deriveStepTitle(instruction: string, stepNumber: number): string {
  const firstSentence = instruction.split(/[.!?]/)[0]?.trim() ?? '';
  if (firstSentence && firstSentence.length <= 32) return firstSentence;
  const words = firstSentence.split(/\s+/).slice(0, 4).join(' ');
  return words || `Step ${stepNumber}`;
}

// Convert US (cup, tsp, tbsp, oz, lb, fl oz) <-> Metric (ml, g, kg, l)
function convertIngredient(
  qty: number | null | undefined,
  unit: string | null | undefined,
  toMetric: boolean,
): { qty: number | null; unit: string | null } {
  if (qty == null || unit == null) return { qty: qty ?? null, unit: unit ?? null };
  const u = unit.toLowerCase().trim();
  if (toMetric) {
    if (u === 'cup' || u === 'cups') return { qty: Math.round(qty * 240), unit: 'ml' };
    if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') return { qty: Math.round(qty * 15), unit: 'ml' };
    if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') return { qty: Math.round(qty * 5), unit: 'ml' };
    if (u === 'oz' || u === 'ounce' || u === 'ounces') return { qty: Math.round(qty * 28), unit: 'g' };
    if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return { qty: Math.round(qty * 454), unit: 'g' };
    if (u === 'fl oz' || u === 'fluid ounce') return { qty: Math.round(qty * 30), unit: 'ml' };
  }
  return { qty, unit };
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<ScaledIngredient[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [targetServings, setTargetServings] = useState(1);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [useMetric, setUseMetric] = useState(false);

  const [nutrition, setNutrition] = useState<RecipeNutritionSummary | null>(null);

  const [substitutions, setSubstitutions] = useState<Record<string, SubstitutionSuggestion[]>>({});
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const [deductionPreview, setDeductionPreview] = useState<DeductionResult | null>(null);
  const [showDeduction, setShowDeduction] = useState(false);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCollections, setShowCollections] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const nextRecipe = getRecipeById(db, id);
      const baseIngredients = getStructuredIngredients(db, id);
      setRecipe(nextRecipe);
      const servings = nextRecipe?.servings ?? 1;
      setTargetServings((current) => (current > 0 ? current : servings));
      setIngredients(scaleIngredients(baseIngredients, servings, servings));
      setSteps(getSteps(db, id));
      setTags(getTags(db, id));

      try { setNutrition(calculateRecipeNutrition(db, id)); } catch { setNutrition(null); }
      try { setSubstitutions(suggestIngredientSubstitutions(db, id)); } catch { setSubstitutions({}); }
      try { setCollections(getCollections(db)); } catch { setCollections([]); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipe');
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => { load(); }, [load]);

  const handleFavorite = () => {
    if (!recipe) return;
    updateRecipe(db, recipe.id, { is_favorite: recipe.is_favorite ? 0 : 1 });
    load();
  };

  const handleDelete = () => {
    Alert.alert('Delete Recipe', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { if (id) { deleteRecipe(db, id); router.back(); } } },
    ]);
  };

  const adjustServings = (direction: -1 | 1) => {
    if (!recipe?.servings || !id) return;
    const nextServings = Math.max(1, targetServings + direction);
    setTargetServings(nextServings);
    const baseIngredients = getStructuredIngredients(db, id);
    setIngredients(scaleIngredients(baseIngredients, recipe.servings, nextServings));
  };

  const handleAddTag = () => {
    if (!id || !newTag.trim()) return;
    addTag(db, uuid(), id, newTag.trim());
    setNewTag('');
    setTags(getTags(db, id));
  };

  const handleDeleteTag = (tagId: string) => {
    deleteTag(db, tagId);
    if (id) setTags(getTags(db, id));
  };

  const handleShare = async () => {
    if (!recipe || !id) return;
    try {
      const baseIngredients = getStructuredIngredients(db, id);
      const recipeSteps = getSteps(db, id);
      const text = generateShareText(recipe, baseIngredients, recipeSteps);
      await Share.share({ message: text, title: recipe.title });
    } catch { /* user cancelled */ }
  };

  const handlePreviewDeduction = () => {
    if (!id) return;
    try {
      const result = previewDeduction(db, id, targetServings);
      setDeductionPreview(result);
      setShowDeduction(true);
      setShowOverflow(false);
    } catch {
      Alert.alert('Error', 'Could not preview pantry deduction.');
    }
  };

  const handleConfirmDeduction = () => {
    if (!id) return;
    try {
      deductPantryForRecipe(db, id, targetServings);
      setShowDeduction(false);
      setDeductionPreview(null);
      Alert.alert('Done', 'Pantry items updated.');
    } catch {
      Alert.alert('Error', 'Could not deduct pantry items.');
    }
  };

  const handleAddToCollection = (collectionId: string) => {
    if (!id) return;
    addRecipeToCollection(db, id, collectionId);
    setShowCollections(false);
    Alert.alert('Added', 'Recipe added to collection.');
  };

  const toggleIngredientCheck = (ingId: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(ingId)) next.delete(ingId);
      else next.add(ingId);
      return next;
    });
  };

  // Utensils: derive from "tools" tags if any. Otherwise empty.
  const utensils = useMemo(() => {
    return tags
      .map((t) => t.tag)
      .filter((t) => t.toLowerCase().startsWith('tool:'))
      .map((t) => t.slice(5).trim());
  }, [tags]);

  // Macros total grams for chart proportions
  const macroBars = useMemo(() => {
    if (!nutrition) return null;
    const p = nutrition.perServing.protein_g ?? 0;
    const c = nutrition.perServing.carbs_g ?? 0;
    const f = nutrition.perServing.fat_g ?? 0;
    const total = p + c + f || 1;
    return {
      protein: p,
      carbs: c,
      fat: f,
      proteinPct: (p / total) * 100,
      carbsPct: (c / total) * 100,
      fatPct: (f / total) * 100,
    };
  }, [nutrition]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={6} />
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

  if (!recipe) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="fork.knife"
          title="Recipe not found"
          message="This recipe may have been deleted"
        />
      </View>
    );
  }

  const heroSource = recipe.image_uri ? { uri: recipe.image_uri } : null;
  const ratingDisplay = recipe.rating > 0 ? recipe.rating.toFixed(1) : '--';

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero photo */}
        <View style={styles.heroWrap}>
          {heroSource ? (
            <Image source={heroSource} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Text style={styles.heroPlaceholderLetter}>
                {recipe.title.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <LinearGradient
            colors={['rgba(19,19,24,0)', 'rgba(19,19,24,0.4)', '#131318']}
            locations={[0, 0.65, 1]}
            style={styles.heroGradient}
          />
        </View>

        {/* Title and rating */}
        <View style={styles.titleSection}>
          <View style={styles.ratingPill}>
            <Text style={styles.ratingPillStar}>★</Text>
            <Text style={styles.ratingPillText}>
              {ratingDisplay}{recipe.rating > 0 ? ' (1.2K RATINGS)' : ''}
            </Text>
          </View>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.description ? (
            <Text style={styles.description}>{recipe.description}</Text>
          ) : null}
        </View>

        {/* Stat row */}
        <View style={styles.statRow}>
          {/* Servings stepper */}
          <View style={styles.statCard}>
            <View style={[styles.statIconCircle, { backgroundColor: `${GOLD}22` }]}>
              <Text style={styles.statIcon}>👥</Text>
            </View>
            <View style={styles.servingsStepper}>
              <Pressable
                style={styles.stepperButton}
                onPress={() => adjustServings(-1)}
                hitSlop={6}
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.statValue}>{targetServings}</Text>
              <Pressable
                style={styles.stepperButton}
                onPress={() => adjustServings(1)}
                hitSlop={6}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.statLabel}>SERVINGS</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconCircle, { backgroundColor: `${GOLD}22` }]}>
              <Text style={styles.statIcon}>🔪</Text>
            </View>
            <Text style={styles.statValue}>{formatTimeShort(recipe.prep_time_mins)}</Text>
            <Text style={styles.statLabel}>PREP TIME</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconCircle, { backgroundColor: `${GOLD}22` }]}>
              <Text style={styles.statIcon}>🔥</Text>
            </View>
            <Text style={styles.statValue}>{formatTimeShort(recipe.cook_time_mins)}</Text>
            <Text style={styles.statLabel}>COOK TIME</Text>
          </View>
        </View>

        {/* Ingredients */}
        {ingredients.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <View style={styles.unitToggleRow}>
                <Pressable onPress={() => setUseMetric(true)}>
                  <Text style={[styles.unitToggle, useMetric && styles.unitToggleActive]}>
                    Metric
                  </Text>
                </Pressable>
                <Text style={styles.unitToggleSep}>/</Text>
                <Pressable onPress={() => setUseMetric(false)}>
                  <Text style={[styles.unitToggle, !useMetric && styles.unitToggleActive]}>
                    Imperial
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.ingredientList}>
              {ingredients.map((ing) => {
                const ingName = ing.item ?? ing.name;
                const checked = checkedIngredients.has(ing.id);
                const subs = substitutions[ingName.toLowerCase()] ?? [];
                const isExpanded = expandedSub === ing.id;
                const converted = convertIngredient(
                  ing.scaled_quantity,
                  ing.unit,
                  useMetric,
                );
                const qtyText = converted.qty != null
                  ? formatQuantity(converted.qty)
                  : formatQuantity(ing.scaled_quantity);
                const unitText = converted.unit ?? ing.unit ?? '';

                return (
                  <View key={ing.id} style={styles.ingredientItem}>
                    <Pressable
                      style={styles.ingredientRow}
                      onPress={() => toggleIngredientCheck(ing.id)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checked && styles.checkboxChecked,
                        ]}
                      >
                        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                      </View>
                      <Text
                        style={[
                          styles.ingredientText,
                          checked && styles.ingredientTextChecked,
                        ]}
                      >
                        {qtyText ? <Text style={styles.ingredientQty}>{qtyText} </Text> : null}
                        {unitText ? `${unitText} ` : ''}
                        {ingName}
                        {ing.prep_note ? `, ${ing.prep_note}` : ''}
                      </Text>
                      {subs.length > 0 ? (
                        <Pressable onPress={() => setExpandedSub(isExpanded ? null : ing.id)} hitSlop={6}>
                          <Text style={styles.swapButton}>Swap</Text>
                        </Pressable>
                      ) : null}
                    </Pressable>
                    {isExpanded ? (
                      <View style={styles.subList}>
                        {subs.map((sub, si) => (
                          <View key={si} style={styles.subRow}>
                            <Text style={styles.subText}>{sub.substitute}</Text>
                            {sub.in_pantry ? (
                              <Text style={styles.subInPantry}>In pantry</Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Nutrition */}
        {nutrition && macroBars ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition</Text>
            <GlassCard level={3} style={styles.nutritionCard}>
              <View style={styles.nutritionHeader}>
                <Text style={styles.nutritionCalories}>
                  {Math.round(nutrition.perServing.calories ?? 0)}
                </Text>
                <Text style={styles.nutritionCaloriesLabel}>KCAL / SERVING</Text>
              </View>
              <View style={styles.nutritionDivider} />
              <View style={styles.macroRow}>
                <Text style={styles.macroLabel}>Protein</Text>
                <Text style={styles.macroValue}>{Math.round(macroBars.protein)}g</Text>
              </View>
              <View style={styles.macroTrack}>
                <View
                  style={[
                    styles.macroFill,
                    { width: `${Math.max(2, macroBars.proteinPct)}%`, backgroundColor: GOLD },
                  ]}
                />
              </View>
              <View style={styles.macroRow}>
                <Text style={styles.macroLabel}>Carbs</Text>
                <Text style={styles.macroValue}>{Math.round(macroBars.carbs)}g</Text>
              </View>
              <View style={styles.macroTrack}>
                <View
                  style={[
                    styles.macroFill,
                    { width: `${Math.max(2, macroBars.carbsPct)}%`, backgroundColor: GOLD },
                  ]}
                />
              </View>
              <View style={styles.macroRow}>
                <Text style={styles.macroLabel}>Fat</Text>
                <Text style={styles.macroValue}>{Math.round(macroBars.fat)}g</Text>
              </View>
              <View style={styles.macroTrack}>
                <View
                  style={[
                    styles.macroFill,
                    { width: `${Math.max(2, macroBars.fatPct)}%`, backgroundColor: GOLD },
                  ]}
                />
              </View>
            </GlassCard>
          </View>
        ) : null}

        {/* Utensils */}
        {utensils.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.utensilsLabel}>UTENSILS NEEDED</Text>
            <View style={styles.utensilsRow}>
              {utensils.map((u) => (
                <View key={u} style={styles.utensilChip}>
                  <Text style={styles.utensilChipText}>{u}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Preparation steps */}
        {steps.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitleLarge}>Preparation Steps</Text>
            <View style={styles.stepsList}>
              {steps.map((step) => {
                const detectedTimer = step.timer_minutes ?? detectStepTimerMinutes(step.instruction);
                const stepTitle = deriveStepTitle(step.instruction, step.step_number);
                return (
                  <View key={step.id} style={styles.stepRow}>
                    <View style={styles.stepCircle}>
                      <Text style={styles.stepCircleText}>{step.step_number}</Text>
                    </View>
                    <View style={styles.stepBody}>
                      <View style={styles.stepTitleRow}>
                        <Text style={styles.stepTitle}>{stepTitle}</Text>
                        {detectedTimer ? (
                          <View style={styles.stepTimerPill}>
                            <Text style={styles.stepTimerText}>{detectedTimer} min</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.stepInstruction}>{step.instruction}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Tags */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.utensilsLabel}>TAGS</Text>
            <Pressable onPress={() => setShowTagInput(!showTagInput)}>
              <Text style={styles.swapButton}>{showTagInput ? 'Done' : '+ Add'}</Text>
            </Pressable>
          </View>
          {tags.length > 0 ? (
            <View style={styles.utensilsRow}>
              {tags.map((tag) => (
                <Pressable
                  key={tag.id}
                  onPress={() => handleDeleteTag(tag.id)}
                  style={styles.tagChip}
                >
                  <Text style={styles.tagChipText}>{tag.tag}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {showTagInput ? (
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInput}
                value={newTag}
                onChangeText={setNewTag}
                placeholder="Add tag..."
                placeholderTextColor={colors.textTertiary}
                onSubmitEditing={handleAddTag}
              />
              <Pressable style={styles.tagAddButton} onPress={handleAddTag}>
                <Text style={styles.tagAddButtonText}>Add</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Notes */}
        {recipe.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <GlassCard level={1}>
              <Text style={styles.notesText}>{recipe.notes}</Text>
            </GlassCard>
          </View>
        ) : null}

        {recipe.source_url ? (
          <View style={styles.section}>
            <Text style={styles.sourceText}>Source: {recipe.source_url}</Text>
          </View>
        ) : null}

        {/* Overflow menu actions */}
        {showOverflow ? (
          <View style={styles.section}>
            <GlassCard level={2}>
              <Pressable style={styles.overflowItem} onPress={() => { void handleShare(); setShowOverflow(false); }}>
                <Text style={styles.overflowItemText}>Share recipe</Text>
              </Pressable>
              <Pressable style={styles.overflowItem} onPress={handlePreviewDeduction}>
                <Text style={styles.overflowItemText}>I cooked this</Text>
              </Pressable>
              <Pressable style={styles.overflowItem} onPress={() => { setShowCollections(!showCollections); }}>
                <Text style={styles.overflowItemText}>Add to collection</Text>
              </Pressable>
              <Pressable style={styles.overflowItem} onPress={() => { router.push(`/(recipes)/add-recipe?editId=${recipe.id}`); setShowOverflow(false); }}>
                <Text style={styles.overflowItemText}>Edit recipe</Text>
              </Pressable>
              <Pressable style={styles.overflowItem} onPress={handleDelete}>
                <Text style={[styles.overflowItemText, { color: colors.danger }]}>Delete recipe</Text>
              </Pressable>
            </GlassCard>
          </View>
        ) : null}

        {showCollections ? (
          <View style={styles.section}>
            <GlassCard level={2}>
              <Text style={styles.sectionTitle}>Add to collection</Text>
              {collections.length === 0 ? (
                <Text style={styles.subText}>No collections yet</Text>
              ) : (
                collections.map((col) => (
                  <Pressable
                    key={col.id}
                    style={styles.overflowItem}
                    onPress={() => handleAddToCollection(col.id)}
                  >
                    <Text style={styles.overflowItemText}>{col.name}</Text>
                  </Pressable>
                ))
              )}
            </GlassCard>
          </View>
        ) : null}

        {showDeduction && deductionPreview ? (
          <View style={styles.section}>
            <GlassCard level={2}>
              <Text style={styles.sectionTitle}>Pantry deduction preview</Text>
              {deductionPreview.deducted.map((d, i) => (
                <View key={i} style={styles.deductRow}>
                  <Text style={styles.ingredientText}>{d.ingredientItem}</Text>
                  <Text
                    style={[
                      styles.deductValue,
                      { color: d.removed ? colors.danger : colors.success },
                    ]}
                  >
                    {d.previousQuantity ?? 0} → {d.removed ? 'removed' : (d.newQuantity ?? 0)}
                  </Text>
                </View>
              ))}
              {deductionPreview.unmatched.length > 0 ? (
                <Text style={styles.subText}>
                  Unmatched: {deductionPreview.unmatched.join(', ')}
                </Text>
              ) : null}
              <View style={styles.deductButtons}>
                <Pressable style={styles.confirmButton} onPress={handleConfirmDeduction}>
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </Pressable>
                <Pressable style={styles.cancelButton} onPress={() => setShowDeduction(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </GlassCard>
          </View>
        ) : null}
      </ScrollView>

      {/* Glass header overlay */}
      <View style={styles.headerOverlay} pointerEvents="box-none">
        <Pressable style={styles.glassButton} onPress={() => router.back()} hitSlop={6}>
          <Text style={styles.glassButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerRightGroup}>
          <Pressable style={styles.glassButton} onPress={handleFavorite} hitSlop={6}>
            <Text
              style={[
                styles.glassButtonText,
                recipe.is_favorite ? styles.heartActive : null,
              ]}
            >
              {recipe.is_favorite ? '♥' : '♡'}
            </Text>
          </Pressable>
          <Pressable style={styles.glassButton} onPress={() => void handleShare()} hitSlop={6}>
            <Text style={styles.glassButtonText}>↗</Text>
          </Pressable>
          <Pressable style={styles.glassButton} onPress={() => setShowOverflow(!showOverflow)} hitSlop={6}>
            <Text style={styles.glassButtonText}>⋯</Text>
          </Pressable>
        </View>
      </View>

      {/* Start cooking CTA */}
      {steps.length > 0 ? (
        <View style={styles.ctaWrap} pointerEvents="box-none">
          <Pressable
            style={styles.ctaButton}
            onPress={() => router.push(`/(recipes)/cooking-mode?recipeId=${recipe.id}`)}
          >
            <Text style={styles.ctaIcon}>▶</Text>
            <Text style={styles.ctaText}>START COOKING</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// Local Text wrapper to ensure consistent typography defaults.
function Text({
  style,
  children,
  ...rest
}: React.ComponentProps<typeof RNText>) {
  return (
    <RNText style={[styles.defaultText, style]} {...rest}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#131318' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },

  // Default text uses Plus Jakarta
  defaultText: {
    fontFamily: JAKARTA_FONTS.regular,
    color: colors.text,
  },

  // Hero
  heroWrap: { width: '100%', height: 380, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: {
    backgroundColor: RECIPES_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderLetter: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 96,
    color: colors.textTertiary,
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },

  // Header overlay
  headerOverlay: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRightGroup: { flexDirection: 'row', gap: 8 },
  glassButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(19, 19, 24, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: '#E4E1E9',
  },
  heartActive: { color: '#F87171' },

  // Title section
  titleSection: {
    paddingHorizontal: 24,
    marginTop: -56,
    gap: 12,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  ratingPillStar: { color: ACCENT, fontSize: 12 },
  ratingPillText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: ACCENT,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: colors.text,
  },
  description: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Stat row
  statRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statIcon: { fontSize: 18 },
  servingsStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: RECIPES_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: colors.text,
    lineHeight: 16,
  },
  statValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
  },
  statLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  // Section
  section: { marginTop: 32, paddingHorizontal: 24, gap: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.3,
  },
  sectionTitleLarge: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 24,
    color: colors.text,
    letterSpacing: -0.3,
  },
  unitToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unitToggle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  unitToggleActive: { color: GOLD },
  unitToggleSep: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Ingredients
  ingredientList: { gap: 10 },
  ingredientItem: {},
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: RECIPES_SURFACES.lift,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: RECIPES_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: GOLD,
  },
  checkboxMark: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
    color: '#1a1008',
  },
  ingredientText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
  },
  ingredientTextChecked: {
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  ingredientQty: {
    fontFamily: JAKARTA_FONTS.bold,
    color: colors.text,
  },
  swapButton: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: GOLD,
  },
  subList: {
    paddingLeft: 50,
    paddingVertical: 8,
    gap: 4,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  subInPantry: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: ACCENT,
  },

  // Nutrition
  nutritionCard: { padding: 20, gap: 16 },
  nutritionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  nutritionCalories: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 36,
    color: GOLD,
    letterSpacing: -1,
  },
  nutritionCaloriesLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    paddingBottom: 6,
  },
  nutritionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  macroValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: colors.text,
  },
  macroTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    marginTop: -10,
  },
  macroFill: { height: '100%', borderRadius: 2 },

  // Utensils
  utensilsLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  utensilsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  utensilChip: {
    backgroundColor: RECIPES_SURFACES.highest,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  utensilChipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: colors.text,
  },

  // Tags
  tagChip: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagChipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: ACCENT,
  },
  tagInputRow: { flexDirection: 'row', gap: 8 },
  tagInput: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
  },
  tagAddButton: {
    backgroundColor: GOLD,
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: 'center',
  },
  tagAddButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: '#1a1008',
  },

  // Steps
  stepsList: { gap: 28 },
  stepRow: { flexDirection: 'row', gap: 16 },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: ACCENT,
  },
  stepBody: { flex: 1, gap: 6, paddingTop: 6 },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepTitle: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  stepTimerPill: {
    backgroundColor: 'rgba(255,184,119,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stepTimerText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    color: GOLD,
    letterSpacing: 0.5,
  },
  stepInstruction: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Notes
  notesText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  sourceText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Overflow + collections
  overflowItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  overflowItemText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },

  // Deduction
  deductRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  deductValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
  },
  deductButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
  confirmButton: {
    flex: 1,
    backgroundColor: ACCENT,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: '#0E0E13',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.focus,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },

  // CTA
  ctaWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
  },
  ctaButton: {
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 999,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  ctaIcon: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  ctaText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 13,
    letterSpacing: 2,
    color: '#FFFFFF',
  },
});
