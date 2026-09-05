import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart, List } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useAddedToast } from '@mylife/bestchef/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useDatabase } from '../../providers/DatabaseProvider';
import { addRecipeIngredientsToGrocery } from '../../data/kitchen';

export interface RecipeActionPillsProps {
  submissionId: string;
  ingredients: string[];
}

/**
 * Two full-width action pills: Add to grocery + Cook mode.
 * Add to grocery uses ensureShoppingList + addShoppingListItem for each ingredient,
 * then fires the imperative AddedToast.
 */
export function RecipeActionPills({ submissionId, ingredients }: RecipeActionPillsProps) {
  const router = useRouter();
  const { t } = useI18n();
  const tc = useThemeColors();
  const db = useDatabase();
  const toast = useAddedToast();

  const handleAddToGrocery = () => {
    if (ingredients.length === 0) return;
    addRecipeIngredientsToGrocery(db, ingredients);
    toast.show(t('Added to grocery list'));
  };

  return (
    <View style={styles.row}>
      <ActionPill
        icon={<ShoppingCart size={16} color={tc.primary} strokeWidth={2} />}
        label={t('Add to grocery')}
        tint={tc.primary}
        onPress={handleAddToGrocery}
      />
      <ActionPill
        icon={<List size={16} color={tc.primaryContainer} strokeWidth={2} />}
        label={t('Cook mode')}
        tint={tc.primaryContainer}
        onPress={() => router.push(`/cook-mode/${submissionId}`)}
      />
    </View>
  );
}

interface ActionPillProps {
  icon: ReactNode;
  label: string;
  tint: string;
  onPress: () => void;
}

function ActionPill({ icon, label, tint, onPress }: ActionPillProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pill,
        { borderColor: `${tint}55`, backgroundColor: `${tint}14` },
        pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  label: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
  },
});
