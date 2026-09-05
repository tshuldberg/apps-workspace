import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NU_SOURCE_BADGES,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  NU_WATER,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export type FoodRowSource =
  | 'usda'
  | 'off'
  | 'open_food_facts'
  | 'fatsecret'
  | 'custom'
  | 'ai_photo';

export interface FoodRowProps {
  foodName: string;
  calories: number;
  servingSize: string;
  source: FoodRowSource;
  macros?: {
    p: number;
    c: number;
    f: number;
  };
  onPress?: () => void;
  onAdd?: () => void;
  leadingImage?: string;
}

export function FoodRow({
  foodName,
  calories,
  servingSize,
  source,
  macros,
  onPress,
  onAdd,
  leadingImage,
}: FoodRowProps) {
  const badge = NU_SOURCE_BADGES[source];

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? styles.rowPressed : null,
      ]}
    >
      <View style={styles.left}>
        {leadingImage ? (
          <Image source={{ uri: leadingImage }} style={styles.image} />
        ) : null}
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>
            {foodName}
          </Text>
          <Text style={styles.serving} numberOfLines={1}>
            {servingSize}
          </Text>
          <View style={styles.metaRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: `${badge.color}20` },
              ]}
            >
              <MaterialSymbol name={badge.icon} size={12} color={badge.color} />
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
            {macros ? (
              <Text style={styles.macros} numberOfLines={1}>
                P {macros.p}g • C {macros.c}g • F {macros.f}g
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.kcal}>{Math.round(calories)}</Text>
        <Text style={styles.kcalLabel}>kcal</Text>
        {onAdd ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onAdd();
            }}
            style={({ pressed }) => [
              styles.addButton,
              pressed ? styles.addButtonPressed : null,
            ]}
          >
            <MaterialSymbol name="add" size={16} color={NU_WATER} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: NU_SURFACES.low,
  },
  rowPressed: {
    backgroundColor: NU_SURFACES.mid,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  image: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  serving: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    ...NU_TYPOGRAPHY.labelUpper,
  },
  macros: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  kcal: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  kcalLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  addButtonPressed: {
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
  },
});
