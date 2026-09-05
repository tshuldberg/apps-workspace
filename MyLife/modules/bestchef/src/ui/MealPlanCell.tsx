import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import {
  RECIPES_ACCENT,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from './tokens';

interface MealPlanCellProps {
  recipe?: {
    title: string;
    imageUri?: string;
    calories?: number;
  };
  mealType: string;
  onPress?: () => void;
  onAssign?: () => void;
}

export function MealPlanCell({ recipe, mealType, onPress, onAssign }: MealPlanCellProps) {
  const isEmpty = recipe == null;

  return (
    <View style={styles.container}>
      <Text style={styles.mealType}>{mealType}</Text>
      {isEmpty ? (
        <Pressable onPress={onAssign} style={[styles.cell, styles.emptyCell]}>
          <Text style={styles.plus}>+</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onPress} style={styles.cell}>
          {recipe.imageUri != null ? (
            <Image source={{ uri: recipe.imageUri }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Text style={styles.thumbGlyph}>🍽️</Text>
            </View>
          )}
          <View style={styles.body}>
            <Text numberOfLines={2} style={styles.title}>
              {recipe.title}
            </Text>
            {recipe.calories != null && (
              <View style={styles.calBadge}>
                <Text style={styles.calBadgeText}>{recipe.calories} cal</Text>
              </View>
            )}
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    flex: 1,
  },
  mealType: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  cell: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    minHeight: 96,
  },
  emptyCell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECIPES_SURFACES.base,
  },
  plus: {
    fontSize: 28,
    color: 'rgba(255,255,255,0.3)',
  },
  thumb: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: 8,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbGlyph: {
    fontSize: 24,
  },
  body: {
    gap: 6,
  },
  title: {
    ...RECIPES_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    lineHeight: 1.4 * 12,
    color: colors.text,
  },
  calBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
  },
  calBadgeText: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: RECIPES_ACCENT,
  },
});
