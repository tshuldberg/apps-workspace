import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type TextProps,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  Clock,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  X,
  GripVertical,
  ChefHat,
  PlusCircle,
} from 'lucide-react-native';
import {
  addIngredient,
  createRecipe,
  deleteIngredient,
  detectStepTimerMinutes,
  getIngredients,
  getRecipeById,
  parseIngredientText,
  updateRecipe,
  type Difficulty,
  type Step,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const SAVE_GREEN_DIM = '#1F3D2E';
const SAVE_GREEN_TEXT = '#A7F3D0';
const HIGHLIGHT_ORANGE = '#FFB877';
const ICON_DIM = 'rgba(255,255,255,0.4)';
const PLACEHOLDER = 'rgba(255,255,255,0.25)';
const DASH_BORDER = 'rgba(159,142,129,0.35)';

interface IngredientItem {
  id: string;
  raw: string;
  quantity: string | null;
  unit: string | null;
  item: string;
  prepNote: string | null;
}

interface StepItem {
  id: string;
  text: string;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

function makeIngredient(raw: string): IngredientItem {
  const parsed = parseIngredientText(raw);
  const qtyStr =
    parsed.quantity != null
      ? Number.isInteger(parsed.quantity)
        ? String(parsed.quantity)
        : parsed.quantity.toFixed(2).replace(/\.?0+$/, '')
      : null;
  return {
    id: uuid(),
    raw: raw.trim(),
    quantity: qtyStr,
    unit: parsed.unit,
    item: parsed.item || raw.trim(),
    prepNote: parsed.prepNote,
  };
}

function buildQuantityLabel(ing: IngredientItem): string | null {
  if (!ing.quantity && !ing.unit) return null;
  return [ing.quantity, ing.unit].filter(Boolean).join(' ');
}

function buildItemLabel(ing: IngredientItem): string {
  if (ing.prepNote) return `${ing.item}, ${ing.prepNote}`;
  return ing.item;
}

export default function AddRecipeScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const router = useRouter();
  const db = useDatabase();
  const isEditing = !!editId;

  const [title, setTitle] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [servings, setServings] = useState(4);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');

  const [ingredientInput, setIngredientInput] = useState('');
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);

  const [steps, setSteps] = useState<StepItem[]>([{ id: uuid(), text: '' }]);

  const [tags, setTags] = useState<string[]>(['Dinner']);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const [loaded, setLoaded] = useState(!isEditing);

  useEffect(() => {
    if (!editId) return;
    const recipe = getRecipeById(db, editId);
    if (!recipe) {
      setLoaded(true);
      return;
    }

    setTitle(recipe.title);
    setImageUri(recipe.image_uri ?? null);
    setServings(recipe.servings ?? 4);
    setDifficulty(recipe.difficulty ?? 'easy');
    setPrepTime(recipe.prep_time_mins != null ? String(recipe.prep_time_mins) : '');
    setCookTime(recipe.cook_time_mins != null ? String(recipe.cook_time_mins) : '');

    const existingIngredients = getIngredients(db, editId);
    setIngredients(
      existingIngredients.map((ing) => ({
        id: ing.id,
        raw: [ing.quantity, ing.unit, ing.name].filter(Boolean).join(' '),
        quantity: ing.quantity ?? null,
        unit: ing.unit ?? null,
        item: ing.item ?? ing.name,
        prepNote: ing.prep_note ?? null,
      })),
    );

    const existingSteps = db.query<Step>(
      `SELECT id, recipe_id, step_number, instruction, timer_minutes, sort_order
       FROM rc_steps WHERE recipe_id = ? ORDER BY sort_order ASC, step_number ASC`,
      [editId],
    );
    setSteps(
      existingSteps.length > 0
        ? existingSteps.map((s) => ({ id: s.id, text: s.instruction }))
        : [{ id: uuid(), text: '' }],
    );

    setLoaded(true);
  }, [db, editId]);

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to add a cover photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open image picker.');
    }
  };

  const handleAddIngredient = () => {
    const text = ingredientInput.trim();
    if (!text) return;
    setIngredients((prev) => [...prev, makeIngredient(text)]);
    setIngredientInput('');
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddStep = () => {
    setSteps((prev) => [...prev, { id: uuid(), text: '' }]);
  };

  const handleUpdateStep = (id: string, text: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  };

  const handleRemoveStep = (id: string) => {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  };

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (!t) {
      setShowTagInput(false);
      return;
    }
    if (!tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
    setShowTagInput(false);
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const incServings = () => setServings((s) => Math.min(s + 1, 99));
  const decServings = () => setServings((s) => Math.max(s - 1, 1));

  const persistIngredients = (recipeId: string) => {
    const existing = getIngredients(db, recipeId);
    for (const old of existing) deleteIngredient(db, old.id);
    ingredients.forEach((ing, i) => {
      addIngredient(db, uuid(), {
        recipe_id: recipeId,
        name: ing.prepNote ? `${ing.item}, ${ing.prepNote}` : ing.item || ing.raw,
        quantity: ing.quantity,
        unit: ing.unit,
        item: ing.item || ing.raw,
        quantity_value: ing.quantity ? Number.parseFloat(ing.quantity) || null : null,
        prep_note: ing.prepNote,
        sort_order: i,
      });
    });
  };

  const persistSteps = (recipeId: string) => {
    db.execute(`DELETE FROM rc_steps WHERE recipe_id = ?`, [recipeId]);
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
  };

  const handleSave = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Missing title', 'Enter a recipe title.');
      return;
    }

    const prepNum = prepTime ? Number.parseInt(prepTime, 10) || null : null;
    const cookNum = cookTime ? Number.parseInt(cookTime, 10) || null : null;
    const totalNum = (prepNum || 0) + (cookNum || 0) || null;

    try {
      if (isEditing && editId) {
        updateRecipe(db, editId, {
          title: cleanTitle,
          servings,
          prep_time_mins: prepNum,
          cook_time_mins: cookNum,
          total_time_mins: totalNum,
          difficulty,
          image_uri: imageUri,
        });
        persistIngredients(editId);
        persistSteps(editId);
      } else {
        const recipeId = uuid();
        createRecipe(db, recipeId, {
          title: cleanTitle,
          description: null,
          servings,
          prep_time_mins: prepNum,
          cook_time_mins: cookNum,
          total_time_mins: totalNum,
          difficulty,
          source_url: null,
          image_uri: imageUri,
          notes: null,
          rating: 0,
          is_favorite: 0,
        });
        persistIngredients(recipeId);
        persistSteps(recipeId);
      }
      router.back();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Could not save recipe.');
    }
  };

  const headerRight = useMemo(
    () => (
      <Pressable onPress={handleSave} style={styles.saveButton} hitSlop={8}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    ),
    [title, imageUri, servings, difficulty, prepTime, cookTime, ingredients, steps, tags],
  );

  if (!loaded) return null;

  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <View style={styles.header}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={8}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.headerTitle}>{isEditing ? 'Edit Recipe' : 'New Recipe'}</Text>
              {headerRight}
            </View>
          ),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover photo */}
        <Pressable style={styles.coverPhoto} onPress={handlePickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <View style={styles.coverIconCircle}>
                <Camera size={26} color={HIGHLIGHT_ORANGE} strokeWidth={1.8} />
              </View>
              <Text style={styles.coverTitle}>Upload cover photo</Text>
              <Text style={styles.coverHint}>High resolution JPG or PNG</Text>
            </View>
          )}
        </Pressable>

        {/* Recipe title */}
        <View style={styles.titleSection}>
          <Text style={styles.fieldLabel}>RECIPE TITLE</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Miso-Glazed Chilean Sea Bass"
            placeholderTextColor={PLACEHOLDER}
            style={styles.titleInput}
            multiline
          />
          <View style={styles.titleUnderline} />
        </View>

        {/* Servings + Difficulty */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.fieldLabel}>SERVINGS</Text>
              <Text style={styles.cardSubtitle}>Yield count</Text>
            </View>
            <View style={styles.stepperPill}>
              <Pressable onPress={decServings} style={styles.stepperBtn} hitSlop={6}>
                <Minus size={18} color={HIGHLIGHT_ORANGE} strokeWidth={2.2} />
              </Pressable>
              <Text style={styles.stepperValue}>{servings}</Text>
              <Pressable onPress={incServings} style={styles.stepperBtn} hitSlop={6}>
                <Plus size={18} color={HIGHLIGHT_ORANGE} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>DIFFICULTY LEVEL</Text>
          <View style={styles.segmentRow}>
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDifficulty(d)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Text
                    style={[styles.segmentLabel, active && styles.segmentLabelActive]}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Prep + Cook time */}
        <View style={styles.timeRow}>
          <View style={[styles.card, styles.timeCard]}>
            <Clock size={20} color={HIGHLIGHT_ORANGE} strokeWidth={1.8} />
            <View style={styles.timeContent}>
              <Text style={styles.fieldLabel}>PREP TIME</Text>
              <TextInput
                value={prepTime}
                onChangeText={setPrepTime}
                placeholder="15 min"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="numeric"
                style={styles.timeInput}
              />
            </View>
          </View>
          <View style={[styles.card, styles.timeCard]}>
            <ChefHat size={20} color={HIGHLIGHT_ORANGE} strokeWidth={1.8} />
            <View style={styles.timeContent}>
              <Text style={styles.fieldLabel}>COOK TIME</Text>
              <TextInput
                value={cookTime}
                onChangeText={setCookTime}
                placeholder="30 min"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="numeric"
                style={styles.timeInput}
              />
            </View>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.sectionHint}>Try: "2 cloves garlic, minced"</Text>
          </View>

          <View style={styles.smartInputRow}>
            <Sparkles size={18} color={`${HIGHLIGHT_ORANGE}99`} strokeWidth={1.8} />
            <TextInput
              value={ingredientInput}
              onChangeText={setIngredientInput}
              placeholder="2 cloves garlic, minced"
              placeholderTextColor={PLACEHOLDER}
              style={styles.smartInput}
              onSubmitEditing={handleAddIngredient}
              returnKeyType="done"
            />
            <Pressable onPress={handleAddIngredient} hitSlop={6}>
              <Text style={styles.addPillText}>ADD</Text>
            </Pressable>
          </View>

          {ingredients.map((ing) => {
            const qty = buildQuantityLabel(ing);
            return (
              <View key={ing.id} style={styles.ingredientRow}>
                <GripVertical size={18} color={ICON_DIM} strokeWidth={1.5} />
                <View style={styles.ingredientText}>
                  {qty ? <Text style={styles.ingredientQty}>{qty}</Text> : null}
                  <Text style={styles.ingredientName}>{buildItemLabel(ing)}</Text>
                </View>
                <Pressable
                  onPress={() => handleRemoveIngredient(ing.id)}
                  hitSlop={8}
                  style={styles.iconBtn}
                >
                  <X size={16} color="#FFB4AB" strokeWidth={2} />
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>

          {steps.map((step, i) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.stepBadgeColumn}>
                <GripVertical size={16} color={ICON_DIM} strokeWidth={1.5} />
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{i + 1}</Text>
                </View>
              </View>
              <TextInput
                value={step.text}
                onChangeText={(text) => handleUpdateStep(step.id, text)}
                placeholder={i === 0 ? 'Describe the first step...' : `Step ${i + 1}...`}
                placeholderTextColor={PLACEHOLDER}
                style={styles.stepInput}
                multiline
              />
              {steps.length > 1 ? (
                <Pressable
                  onPress={() => handleRemoveStep(step.id)}
                  hitSlop={8}
                  style={styles.iconBtn}
                >
                  <Trash2 size={16} color="#FFB4AB" strokeWidth={1.8} />
                </Pressable>
              ) : null}
            </View>
          ))}

          <Pressable onPress={handleAddStep} style={styles.addStepBtn}>
            <PlusCircle size={18} color={HIGHLIGHT_ORANGE} strokeWidth={1.8} />
            <Text style={styles.addStepText}>Add Step</Text>
          </Pressable>
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>CATEGORIES & TAGS</Text>
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
                <Pressable onPress={() => handleRemoveTag(tag)} hitSlop={6}>
                  <X size={12} color={colors.textSecondary} strokeWidth={2} />
                </Pressable>
              </View>
            ))}
            {showTagInput ? (
              <View style={styles.tagInputChip}>
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="Tag name"
                  placeholderTextColor={PLACEHOLDER}
                  style={styles.tagInput}
                  autoFocus
                  onSubmitEditing={handleAddTag}
                  onBlur={handleAddTag}
                  returnKeyType="done"
                />
              </View>
            ) : (
              <Pressable
                onPress={() => setShowTagInput(true)}
                style={styles.addTagButton}
              >
                <Plus size={14} color={HIGHLIGHT_ORANGE} strokeWidth={2} />
                <Text style={styles.addTagText}>Tag</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

// Local typed Text wrapper to avoid pulling rich variants from @mylife/ui
function Text(props: TextProps) {
  return <RNText {...props} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.depth,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: 'rgba(19, 19, 24, 0.85)',
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  cancelText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: 'rgba(228,225,233,0.6)',
  },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.2,
  },
  saveButton: {
    backgroundColor: SAVE_GREEN_DIM,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: SAVE_GREEN_TEXT,
    letterSpacing: 0.2,
  },

  // Cover photo
  coverPhoto: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 20,
    backgroundColor: RECIPES_SURFACES.lift,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: DASH_BORDER,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    alignItems: 'center',
    gap: 10,
  },
  coverIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: RECIPES_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  coverHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Title
  titleSection: {
    gap: 6,
  },
  fieldLabel: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  titleInput: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 26,
    color: colors.text,
    paddingVertical: 4,
    paddingHorizontal: 0,
    minHeight: 38,
  },
  titleUnderline: {
    height: 1,
    backgroundColor: 'rgba(82,68,58,0.4)',
    marginTop: 4,
  },

  // Card
  card: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 16,
    padding: 18,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSubtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },

  // Stepper
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: RECIPES_SURFACES.highest,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
    minWidth: 16,
    textAlign: 'center',
  },

  // Difficulty segments
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(82,68,58,0.5)',
  },
  segmentActive: {
    backgroundColor: HIGHLIGHT_ORANGE,
    borderColor: HIGHLIGHT_ORANGE,
  },
  segmentLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: '#3A1F00',
  },

  // Time row
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeContent: {
    flex: 1,
  },
  timeInput: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 2,
    paddingHorizontal: 0,
    marginTop: 2,
  },

  // Sections
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
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.2,
  },
  sectionHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    fontStyle: 'italic',
    color: 'rgba(214,195,181,0.55)',
  },

  // Smart input
  smartInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: RECIPES_SURFACES.focus,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,184,119,0.25)',
  },
  smartInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  addPillText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: HIGHLIGHT_ORANGE,
    letterSpacing: 0.3,
  },

  // Ingredient row
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  ingredientText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ingredientQty: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: HIGHLIGHT_ORANGE,
  },
  ingredientName: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
  },
  iconBtn: {
    padding: 4,
  },

  // Step row
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 18,
    padding: 18,
  },
  stepBadgeColumn: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,184,119,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 11,
    color: HIGHLIGHT_ORANGE,
  },
  stepInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
    padding: 0,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: DASH_BORDER,
  },
  addStepText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Tags
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.highest,
  },
  tagText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.text,
  },
  tagInputChip: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.highest,
    minWidth: 80,
  },
  tagInput: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 4,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,184,119,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,119,0.3)',
  },
  addTagText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: HIGHLIGHT_ORANGE,
  },
});

// Suppress unused warning for tokens we keep available for theme parity
void RECIPES_ACCENT;
void RECIPES_SECONDARY;
