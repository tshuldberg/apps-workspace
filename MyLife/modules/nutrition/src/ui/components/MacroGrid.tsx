import { StyleSheet, View } from 'react-native';
import { NU_MACROS } from '../tokens';
import { MacroBar, type MacroLabel } from './MacroBar';

export interface MacroGridProps {
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  goals: {
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
}

export function MacroGrid({
  protein,
  carbs,
  fat,
  fiber,
  goals,
}: MacroGridProps) {
  const items: Array<{
    key: MacroLabel;
    grams: number;
    goalGrams: number;
    color: string;
  }> = [
    { key: 'protein', grams: protein, goalGrams: goals.protein, color: NU_MACROS.protein },
    { key: 'carbs', grams: carbs, goalGrams: goals.carbs, color: NU_MACROS.carbs },
    { key: 'fat', grams: fat, goalGrams: goals.fat, color: NU_MACROS.fat },
    ...(fiber !== undefined
      ? [
          {
            key: 'fiber' as const,
            grams: fiber,
            goalGrams: goals.fiber ?? 0,
            color: NU_MACROS.fiber,
          },
        ]
      : []),
  ];

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.key} style={styles.cell}>
          <MacroBar
            label={item.key}
            grams={item.grams}
            goalGrams={item.goalGrams}
            color={item.color}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cell: {
    flexBasis: '31%',
    flexGrow: 1,
  },
});
