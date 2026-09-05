import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { Difficulty } from '@mylife/bestchef';
import { Card, Text, colors, spacing } from '@mylife/ui';

const ACCENT = colors.modules.recipes;

export interface RecipeFormValues {
  title: string;
  description: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  difficulty: Difficulty | '';
  notes: string;
  sourceUrl: string;
  ingredientLines: string[];
  stepLines: string[];
}

const EMPTY_VALUES: RecipeFormValues = {
  title: '',
  description: '',
  servings: '',
  prepTime: '',
  cookTime: '',
  difficulty: '',
  notes: '',
  sourceUrl: '',
  ingredientLines: [''],
  stepLines: [''],
};

interface RecipeFormProps {
  initialValues?: Partial<RecipeFormValues>;
  onSave: (values: RecipeFormValues) => void;
  saveLabel?: string;
  header?: React.ReactNode;
}

export function RecipeForm({
  initialValues,
  onSave,
  saveLabel = 'Create Recipe',
  header,
}: RecipeFormProps) {
  const merged = { ...EMPTY_VALUES, ...initialValues };
  const [title, setTitle] = useState(merged.title);
  const [description, setDescription] = useState(merged.description);
  const [servings, setServings] = useState(merged.servings);
  const [prepTime, setPrepTime] = useState(merged.prepTime);
  const [cookTime, setCookTime] = useState(merged.cookTime);
  const [difficulty, setDifficulty] = useState<Difficulty | ''>(merged.difficulty);
  const [notes, setNotes] = useState(merged.notes);
  const [sourceUrl, setSourceUrl] = useState(merged.sourceUrl);
  const [ingredientLines, setIngredientLines] = useState<string[]>(
    merged.ingredientLines.length > 0 ? merged.ingredientLines : [''],
  );
  const [stepLines, setStepLines] = useState<string[]>(
    merged.stepLines.length > 0 ? merged.stepLines : [''],
  );

  const handleSave = () => {
    onSave({
      title,
      description,
      servings,
      prepTime,
      cookTime,
      difficulty,
      notes,
      sourceUrl,
      ingredientLines,
      stepLines,
    });
  };

  const addIngredientLine = () => setIngredientLines((prev) => [...prev, '']);
  const updateIngredientLine = (index: number, value: string) => {
    setIngredientLines((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };
  const removeIngredientLine = (index: number) => {
    setIngredientLines((prev) => prev.filter((_, i) => i !== index));
  };

  const addStepLine = () => setStepLines((prev) => [...prev, '']);
  const updateStepLine = (index: number, value: string) => {
    setStepLines((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };
  const removeStepLine = (index: number) => {
    setStepLines((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {header}

      <Card>
        <Text variant="subheading">{saveLabel === 'Save Changes' ? 'Edit Recipe' : 'Recipe Details'}</Text>

        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Recipe title *"
          placeholderTextColor={colors.textTertiary}
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={3}
        />

        <View style={styles.rowFields}>
          <TextInput
            style={[styles.input, styles.flex1]}
            value={servings}
            onChangeText={setServings}
            placeholder="Servings"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            value={prepTime}
            onChangeText={setPrepTime}
            placeholder="Prep (min)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            value={cookTime}
            onChangeText={setCookTime}
            placeholder="Cook (min)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.chipRow}>
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => {
            const active = difficulty === d;
            return (
              <Pressable
                key={d}
                onPress={() => setDifficulty(active ? '' : d)}
                style={[styles.chip, active ? styles.chipActive : null]}
              >
                <Text
                  variant="caption"
                  color={active ? colors.background : colors.textSecondary}
                >
                  {d}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          value={sourceUrl}
          onChangeText={setSourceUrl}
          placeholder="Source URL (optional)"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          keyboardType="url"
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optional)"
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={3}
        />
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text variant="subheading">Ingredients</Text>
          <Pressable onPress={addIngredientLine}>
            <Text variant="label" color={ACCENT}>+ Add</Text>
          </Pressable>
        </View>
        {ingredientLines.map((line, i) => (
          <View key={i} style={styles.lineRow}>
            <TextInput
              style={[styles.input, styles.flex1]}
              value={line}
              onChangeText={(val) => updateIngredientLine(i, val)}
              placeholder={`Ingredient ${i + 1}`}
              placeholderTextColor={colors.textTertiary}
            />
            {ingredientLines.length > 1 ? (
              <Pressable onPress={() => removeIngredientLine(i)} style={styles.removeBtn}>
                <Text variant="caption" color={colors.danger}>X</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text variant="subheading">Steps</Text>
          <Pressable onPress={addStepLine}>
            <Text variant="label" color={ACCENT}>+ Add</Text>
          </Pressable>
        </View>
        {stepLines.map((line, i) => (
          <View key={i} style={styles.lineRow}>
            <Text variant="caption" color={ACCENT} style={styles.stepNum}>{i + 1}.</Text>
            <TextInput
              style={[styles.input, styles.flex1, styles.multiline]}
              value={line}
              onChangeText={(val) => updateStepLine(i, val)}
              placeholder={`Step ${i + 1}`}
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            {stepLines.length > 1 ? (
              <Pressable onPress={() => removeStepLine(i)} style={styles.removeBtn}>
                <Text variant="caption" color={colors.danger}>X</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </Card>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text variant="label" color={colors.background}>
          {saveLabel}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    marginTop: spacing.xs,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  rowFields: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  flex1: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  stepNum: {
    marginTop: spacing.sm,
    fontWeight: '700',
    fontSize: 16,
  },
  removeBtn: {
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  saveButton: {
    borderRadius: 10,
    backgroundColor: ACCENT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
