import { StyleSheet, Text, View } from 'react-native';
import type { FoodLogItem, MealType } from '../../types';
import {
  NU_CALORIE,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
} from '../tokens';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

type MealCardMealType = MealType | 'snacks';

export interface MealCardProps {
  mealType: MealCardMealType;
  items: Array<FoodLogItem & { foodName?: string | null }>;
  totalKcal: number;
  onPress: () => void;
}

const MEAL_META: Record<MealCardMealType, { label: string; icon: string }> = {
  breakfast: { label: 'Breakfast', icon: 'breakfast_dining' },
  lunch: { label: 'Lunch', icon: 'lunch_dining' },
  dinner: { label: 'Dinner', icon: 'dinner_dining' },
  snack: { label: 'Snacks', icon: 'cookie' },
  snacks: { label: 'Snacks', icon: 'cookie' },
};

export function MealCard({
  mealType,
  items,
  totalKcal,
  onPress,
}: MealCardProps) {
  const meta = MEAL_META[mealType];
  const itemNames = items
    .map((item) => item.foodName?.trim())
    .filter((value): value is string => Boolean(value));
  const preview = itemNames.slice(0, 3).join(', ');
  const hasMore = itemNames.length > 3;

  return (
    <GlassCard onPress={onPress} padding={18}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.iconWrap}>
            <MaterialSymbol name={meta.icon} size={20} color={NU_TEXT} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{meta.label}</Text>
            <Text style={styles.meta}>
              {items.length === 0
                ? 'Add food'
                : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
            </Text>
            {items.length > 0 ? (
              <Text style={styles.preview} numberOfLines={2}>
                {preview}
                {hasMore ? ` and ${itemNames.length - 3} more` : ''}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.kcal}>{Math.round(totalKcal)}</Text>
          <Text style={styles.kcalLabel}>kcal</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.high,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  meta: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  preview: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  kcal: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_CALORIE,
  },
  kcalLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
});
