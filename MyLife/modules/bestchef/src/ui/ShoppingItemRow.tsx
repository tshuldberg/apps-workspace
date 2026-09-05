import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import {
  RECIPES_ACCENT,
  RECIPES_CATEGORY_COLORS,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
  type RecipesCategory,
} from './tokens';

interface ShoppingItemRowProps {
  name: string;
  quantity: string;
  category: string;
  sourceRecipe?: string;
  checked?: boolean;
  onToggle?: () => void;
}

function categoryAccent(category: string): string {
  const key = category.toLowerCase() as RecipesCategory;
  return RECIPES_CATEGORY_COLORS[key] ?? RECIPES_SURFACES.highest;
}

export function ShoppingItemRow({
  name,
  quantity,
  category,
  sourceRecipe,
  checked = false,
  onToggle,
}: ShoppingItemRowProps) {
  const accent = categoryAccent(category);
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.row, { borderLeftColor: accent }, checked && styles.rowChecked]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.check}>✓</Text>}
      </View>
      <View style={styles.body}>
        <Text
          numberOfLines={1}
          style={[styles.name, checked && styles.textChecked]}
        >
          {name}
        </Text>
        {sourceRecipe != null && (
          <Text numberOfLines={1} style={styles.source}>
            from {sourceRecipe}
          </Text>
        )}
      </View>
      <Text style={[styles.quantity, checked && styles.textChecked]}>{quantity}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  rowChecked: {
    opacity: 0.55,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: RECIPES_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: RECIPES_ACCENT,
  },
  check: {
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...RECIPES_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    lineHeight: 1.4 * 15,
    color: colors.text,
  },
  source: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  quantity: {
    ...RECIPES_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  textChecked: {
    textDecorationLine: 'line-through',
  },
});
