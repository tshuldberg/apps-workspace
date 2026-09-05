import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  ClipboardPaste,
  Clock,
  Flame,
  Plus,
  ShoppingBasket,
  Trash2,
  Users,
} from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  parseIngredientText,
  RECIPE_TEMPLATES,
  type Difficulty,
  type RecipeTemplateId,
  type RecipeTemplateSeed,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useDatabase } from '../providers/DatabaseProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { createSavedRecipe, getSavedRecipeDetails, updateSavedRecipe } from '../data/kitchen';
import { BackArrow } from '../components/DirectionalIcons';

const DIFFICULTIES: Array<{ value: Difficulty; label: string }> = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

interface IngredientRow {
  /** Stable key for FlatList-style rendering */
  key: string;
  /** Original raw line. Drives parser on blur. */
  raw: string;
  qty: string;
  unit: string;
  name: string;
  prep: string;
  /**
   * "auto" -> last update came from the parser; show "Smart-parsed" chip.
   * "edited" -> user has touched a structured field; show "Edited" chip.
   */
  source: 'auto' | 'edited';
}

let rowKeySeq = 0;
function newRowKey(): string {
  rowKeySeq += 1;
  return `ing-${Date.now()}-${rowKeySeq}`;
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function rowToLine(row: IngredientRow): string {
  // Recompose a clean human-readable string for storage so the existing
  // createSavedRecipe / updateSavedRecipe path still works.
  const parts: string[] = [];
  const head = [row.qty.trim(), row.unit.trim()].filter((s) => s.length > 0).join(' ');
  if (head.length > 0) parts.push(head);
  const name = row.name.trim();
  if (name.length > 0) parts.push(name);
  const base = parts.join(' ').trim();
  const prep = row.prep.trim();
  if (prep.length === 0) {
    return base.length > 0 ? base : row.raw.trim();
  }
  return base.length > 0 ? `${base}, ${prep}` : `${prep}`;
}

function rowsToText(rows: IngredientRow[]): string {
  return rows
    .map(rowToLine)
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

function lineToRow(line: string): IngredientRow {
  const parsed = parseIngredientText(line);
  return {
    key: newRowKey(),
    raw: line,
    qty: parsed.quantity == null ? '' : String(parsed.quantity),
    unit: parsed.unit ?? '',
    name: parsed.item ?? '',
    prep: parsed.prepNote ?? '',
    source: 'auto',
  };
}

function emptyRow(): IngredientRow {
  return {
    key: newRowKey(),
    raw: '',
    qty: '',
    unit: '',
    name: '',
    prep: '',
    source: 'edited',
  };
}

function templateToRows(template: RecipeTemplateSeed): IngredientRow[] {
  return template.ingredientLines.map((line) => lineToRow(line));
}

export default function NewSavedRecipeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ recipeId?: string | string[] }>();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const recipeId = useMemo(() => {
    const value = params.recipeId;
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  }, [params.recipeId]);
  const isEditing = Boolean(recipeId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState('4');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | null>('medium');
  const [rows, setRows] = useState<IngredientRow[]>(() => [emptyRow()]);
  const [steps, setSteps] = useState('');
  const [groceryFlagged, setGroceryFlagged] = useState(true);
  const [saving, setSaving] = useState(false);
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const ingredientsText = useMemo(() => rowsToText(rows), [rows]);

  const canSave =
    title.trim().length > 0 && ingredientsText.trim().length > 0 && steps.trim().length > 0;

  const hasUnsavedDraft = useMemo(() => {
    const hasIngredient = rows.some((row) => rowToLine(row).trim().length > 0);
    return title.trim().length > 0 || hasIngredient || steps.trim().length > 0;
  }, [rows, steps, title]);

  useEffect(() => {
    if (!recipeId) return;
    const details = getSavedRecipeDetails(db, recipeId);
    if (!details) {
      Alert.alert(t('Recipe not found'), t('This saved recipe could not be loaded.'));
      router.replace('/(tabs)/kitchen');
      return;
    }

    setTitle(details.recipe.title);
    setDescription(details.recipe.description ?? '');
    setServings(details.recipe.servings === null ? '' : String(details.recipe.servings));
    setPrepTime(details.recipe.prep_time_mins === null ? '' : String(details.recipe.prep_time_mins));
    setCookTime(details.recipe.cook_time_mins === null ? '' : String(details.recipe.cook_time_mins));
    setDifficulty(details.recipe.difficulty);
    // Lazy-parse: existing string-only ingredients flow through the parser
    // on first edit so structured fields populate transparently.
    const loadedRows = details.ingredients.length === 0
      ? [emptyRow()]
      : details.ingredients.map((ing) => {
          const seed = (ing.item && ing.item.trim().length > 0)
            || (ing.unit && ing.unit.trim().length > 0)
            || (ing.quantity_value != null);
          if (seed) {
            return {
              key: newRowKey(),
              raw: ing.name,
              qty: ing.quantity_value != null ? String(ing.quantity_value) : (ing.quantity ?? ''),
              unit: ing.unit ?? '',
              name: (ing.item && ing.item.trim().length > 0) ? ing.item : ing.name,
              prep: ing.prep_note ?? '',
              source: 'auto' as const,
            };
          }
          return lineToRow(ing.name);
        });
    setRows(loadedRows);
    setSteps(details.steps.map((step) => step.instruction).join('\n'));
    setGroceryFlagged(details.groceryFlagged);
  }, [db, recipeId, router, t]);

  const updateRow = (key: string, patch: Partial<IngredientRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch, source: 'edited' as const } : row)));
  };

  const reparseRow = (key: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        // Only re-parse when the user has typed into the raw field and not
        // yet touched the structured columns directly.
        if (row.raw.trim().length === 0) return row;
        const parsed = parseIngredientText(row.raw);
        return {
          ...row,
          qty: parsed.quantity == null ? '' : String(parsed.quantity),
          unit: parsed.unit ?? '',
          name: parsed.item ?? '',
          prep: parsed.prepNote ?? '',
          source: 'auto' as const,
        };
      }),
    );
  };

  const addEmptyRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const deleteRow = (key: string) => {
    setRows((prev) => {
      const next = prev.filter((row) => row.key !== key);
      return next.length === 0 ? [emptyRow()] : next;
    });
    swipeRefs.current.delete(key);
  };

  const handlePasteList = () => {
    Alert.prompt?.(
      t('recipe_paste_list'),
      t('Ingredients (one per line)'),
      [
        { text: t('Keep mine'), style: 'cancel' },
        {
          text: t('Replace'),
          onPress: (input?: string) => {
            const lines = (input ?? '')
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            if (lines.length === 0) return;
            const next = lines.map(lineToRow);
            setRows(next);
          },
        },
      ],
      'plain-text',
      '',
    );
  };

  const seedTemplate = (id: RecipeTemplateId) => {
    const template = RECIPE_TEMPLATES.find((tpl) => tpl.id === id);
    if (!template) return;

    const apply = () => {
      if (title.trim().length === 0) setTitle(template.titlePlaceholder);
      setServings(String(template.servings));
      setPrepTime(String(template.prepTimeMins));
      setCookTime(String(template.cookTimeMins));
      setDifficulty(template.difficulty);
      setRows(templateToRows(template));
      setSteps(template.stepLines.join('\n'));
    };

    if (hasUnsavedDraft) {
      Alert.alert(
        t('recipe_template_seed_confirm_title'),
        t('recipe_template_seed_confirm_body'),
        [
          { text: t('recipe_template_seed_confirm_no'), style: 'cancel' },
          { text: t('recipe_template_seed_confirm_yes'), style: 'destructive', onPress: apply },
        ],
      );
      return;
    }
    apply();
  };

  const handleSave = () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        servings: parsePositiveInteger(servings),
        prepTimeMins: parsePositiveInteger(prepTime),
        cookTimeMins: parsePositiveInteger(cookTime),
        difficulty,
        ingredientsText,
        stepsText: steps,
        groceryFlagged,
      };
      const id = recipeId ?? createSavedRecipe(db, payload);
      if (recipeId) {
        const updated = updateSavedRecipe(db, recipeId, payload);
        if (!updated) {
          throw new Error(t('This saved recipe could not be loaded.'));
        }
      }
      router.replace(`/saved-recipe/${id}`);
    } catch (err) {
      Alert.alert(isEditing ? t('Recipe update failed') : t('Recipe save failed'), err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const renderRightActions = (key: string) => (
    <Pressable
      style={({ pressed }) => [
        styles.swipeDelete,
        { backgroundColor: tc.danger ?? '#B3261E' },
        pressed && { opacity: 0.8 },
      ]}
      onPress={() => deleteRow(key)}
      accessibilityRole="button"
      accessibilityLabel={t('Delete')}
    >
      <Trash2 size={20} color="#FFFFFF" strokeWidth={2.4} />
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.68, transform: [{ scale: 0.96 }] }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
        >
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{isEditing ? t('Edit Saved Recipe') : t('Add Saved Recipe')}</Text>
        <Pressable
          onPress={handleSave}
          disabled={!canSave || saving}
          hitSlop={12}
          style={({ pressed }) => [
            styles.iconButton,
            { opacity: canSave && !saving ? 1 : 0.4 },
            pressed && canSave && !saving && { transform: [{ scale: 0.96 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Save recipe')}
        >
          <Check size={22} color={tc.accent} strokeWidth={2.6} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!isEditing ? (
            <View style={styles.templateRow}>
              {RECIPE_TEMPLATES.map((template) => (
                <Pressable
                  key={template.id}
                  style={({ pressed }) => [
                    styles.templateChip,
                    { backgroundColor: tc.surface, borderColor: theme.glass.cardBorder },
                    pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => seedTemplate(template.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t(template.labelKey)}
                >
                  <Text style={[styles.templateChipText, { color: tc.textSecondary }]}>
                    {t(template.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Recipe Title')}</Text>
              <TextInput
                style={[styles.titleInput, { color: tc.text }]}
                value={title}
                onChangeText={setTitle}
                placeholder={t("e.g. Grandma's Street Pad Thai")}
                placeholderTextColor={tc.textTertiary}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: tc.border }]} />
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Description')}</Text>
              <TextInput
                style={[styles.textArea, { color: tc.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('What makes this recipe worth saving?')}
                placeholderTextColor={tc.textTertiary}
                multiline
              />
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={[styles.metaBox, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
              <Users size={16} color={tc.accent} strokeWidth={2} />
              <Text style={[styles.metaLabel, { color: tc.textSecondary }]}>{t('Servings')}</Text>
              <TextInput style={[styles.metaInput, { color: tc.text }]} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="4" placeholderTextColor={tc.textTertiary} />
            </View>
            <View style={[styles.metaBox, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
              <Clock size={16} color={tc.accent} strokeWidth={2} />
              <Text style={[styles.metaLabel, { color: tc.textSecondary }]}>{t('Prep')}</Text>
              <TextInput style={[styles.metaInput, { color: tc.text }]} value={prepTime} onChangeText={setPrepTime} keyboardType="number-pad" placeholder="10" placeholderTextColor={tc.textTertiary} />
            </View>
            <View style={[styles.metaBox, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
              <Flame size={16} color={tc.accent} strokeWidth={2} />
              <Text style={[styles.metaLabel, { color: tc.textSecondary }]}>{t('Cook')}</Text>
              <TextInput style={[styles.metaInput, { color: tc.text }]} value={cookTime} onChangeText={setCookTime} keyboardType="number-pad" placeholder="20" placeholderTextColor={tc.textTertiary} />
            </View>
          </View>

          <View style={styles.chipRow}>
            {DIFFICULTIES.map((option) => (
              <Pressable
                key={option.value}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: tc.surface },
                  difficulty === option.value && { backgroundColor: `${tc.accent}24` },
                  pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => setDifficulty(option.value)}
              >
                <Text style={[styles.chipText, { color: tc.textSecondary }, difficulty === option.value && { color: tc.accent }]}>
                  {t(option.label)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Ingredients (one per line)')}</Text>
              {rows.map((row) => (
                <Swipeable
                  key={row.key}
                  ref={(ref) => {
                    swipeRefs.current.set(row.key, ref);
                  }}
                  renderRightActions={() => renderRightActions(row.key)}
                  overshootRight={false}
                >
                  <View style={[styles.ingredientRow, { borderColor: tc.border }]}>
                    <View style={styles.ingredientStructured}>
                      <TextInput
                        style={[styles.ingredientQty, { color: tc.text, borderColor: tc.border }]}
                        value={row.qty}
                        onChangeText={(v) => updateRow(row.key, { qty: v })}
                        placeholder={t('recipe_ingredient_qty')}
                        placeholderTextColor={tc.textTertiary}
                        keyboardType="numbers-and-punctuation"
                      />
                      <TextInput
                        style={[styles.ingredientUnit, { color: tc.text, borderColor: tc.border }]}
                        value={row.unit}
                        onChangeText={(v) => updateRow(row.key, { unit: v })}
                        placeholder={t('recipe_ingredient_unit')}
                        placeholderTextColor={tc.textTertiary}
                      />
                      <TextInput
                        style={[styles.ingredientName, { color: tc.text, borderColor: tc.border }]}
                        value={row.name}
                        onChangeText={(v) => updateRow(row.key, { name: v })}
                        placeholder={t('recipe_ingredient_name')}
                        placeholderTextColor={tc.textTertiary}
                      />
                    </View>
                    <TextInput
                      style={[styles.ingredientPrep, { color: tc.textSecondary, borderColor: tc.border }]}
                      value={row.prep}
                      onChangeText={(v) => updateRow(row.key, { prep: v })}
                      placeholder={t('recipe_ingredient_prep')}
                      placeholderTextColor={tc.textTertiary}
                    />
                    <TextInput
                      style={[styles.ingredientRaw, { color: tc.textTertiary, borderColor: tc.border }]}
                      value={row.raw}
                      onChangeText={(v) => updateRow(row.key, { raw: v })}
                      onBlur={() => reparseRow(row.key)}
                      placeholder={'200 g rice noodles, soaked'}
                      placeholderTextColor={tc.textTertiary}
                    />
                    <View style={styles.ingredientStatusRow}>
                      <View
                        style={[
                          styles.statusChip,
                          {
                            backgroundColor: row.source === 'auto' ? `${tc.accent}20` : `${tc.textSecondary}20`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            { color: row.source === 'auto' ? tc.accent : tc.textSecondary },
                          ]}
                        >
                          {row.source === 'auto' ? t('recipe_smart_parsed') : t('recipe_user_edited')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Swipeable>
              ))}
              <View style={styles.ingredientActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    { borderColor: tc.border, backgroundColor: tc.surface },
                    pressed && { opacity: 0.78 },
                  ]}
                  onPress={addEmptyRow}
                  accessibilityRole="button"
                  accessibilityLabel={t('recipe_add_ingredient')}
                >
                  <Plus size={14} color={tc.accent} strokeWidth={2.4} />
                  <Text style={[styles.actionButtonText, { color: tc.text }]}>
                    {t('recipe_add_ingredient')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    { borderColor: tc.border, backgroundColor: tc.surface },
                    pressed && { opacity: 0.78 },
                  ]}
                  onPress={handlePasteList}
                  accessibilityRole="button"
                  accessibilityLabel={t('recipe_paste_list')}
                >
                  <ClipboardPaste size={14} color={tc.accent} strokeWidth={2.4} />
                  <Text style={[styles.actionButtonText, { color: tc.text }]}>
                    {t('recipe_paste_list')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Instructions (one step per line)')}</Text>
              <TextInput
                style={[styles.textAreaLarge, { color: tc.text }]}
                value={steps}
                onChangeText={setSteps}
                placeholder={"Soak noodles for 30 minutes\nHeat oil in a wok\nToss everything together"}
                placeholderTextColor={tc.textTertiary}
                multiline
              />
            </View>
          </View>

          <View style={[styles.flagCard, { backgroundColor: `${tc.accent}14`, borderColor: `${tc.accent}40` }]}>
            <View style={styles.flagText}>
              <View style={styles.flagTitleRow}>
                <ShoppingBasket size={16} color={tc.accent} strokeWidth={2} />
                <Text style={[styles.flagTitle, { color: tc.text }]}>{t('Flag for Grocery')}</Text>
              </View>
              <Text style={[styles.flagBody, { color: tc.textSecondary }]}>
                {t('Flagged recipes can be added to any grocery list.')}
              </Text>
            </View>
            <Switch
              value={groceryFlagged}
              onValueChange={setGroceryFlagged}
              trackColor={{ false: tc.surfaceElevated, true: tc.accent }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: tc.accent },
              (!canSave || saving) && { opacity: 0.45 },
              pressed && canSave && !saving && { transform: [{ scale: 0.98 }], opacity: 0.82 },
            ]}
            disabled={!canSave || saving}
            onPress={handleSave}
          >
            {isEditing ? (
              <Check size={18} color={tc.background} strokeWidth={2.5} />
            ) : (
              <Plus size={18} color={tc.background} strokeWidth={2.5} />
            )}
            <Text style={[styles.saveButtonText, { color: tc.background }]}>
              {saving ? t('Saving...') : isEditing ? t('Update Recipe') : t('Save Recipe')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { minHeight: 92, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, paddingBottom: 48, gap: 16 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  divider: { height: 1 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12, letterSpacing: 0.4 },
  titleInput: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 22, padding: 0 },
  textArea: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14, minHeight: 58, textAlignVertical: 'top', padding: 0 },
  textAreaLarge: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14, minHeight: 134, textAlignVertical: 'top', padding: 0, lineHeight: 21 },
  metaGrid: { flexDirection: 'row', gap: 10 },
  metaBox: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  metaLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 0.5 },
  metaInput: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18, padding: 0 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  chipText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  templateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templateChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  templateChipText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  ingredientRow: { gap: 6, paddingVertical: 8, borderBottomWidth: 1 },
  ingredientStructured: { flexDirection: 'row', gap: 6 },
  ingredientQty: { width: 56, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  ingredientUnit: { width: 72, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  ingredientName: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  ingredientPrep: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  ingredientRaw: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontFamily: JAKARTA_FONTS.regular, fontSize: 12, fontStyle: 'italic' },
  ingredientStatusRow: { flexDirection: 'row', gap: 6 },
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusChipText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 0.4 },
  ingredientActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 999 },
  actionButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  swipeDelete: { width: 72, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginVertical: 4 },
  flagCard: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  flagText: { flex: 1, gap: 6 },
  flagTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flagTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  flagBody: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, lineHeight: 18 },
  saveButton: { minHeight: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
});
