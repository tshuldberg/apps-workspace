import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BG_ACCENT,
  BG_CARD_RADIUS,
  BG_ON_ACCENT,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
} from '../tokens';
import { BG_FONTS } from '../typography';
import { MaterialSymbol } from './MaterialSymbol';

type CategoryChipSize = 'sm' | 'md';

const SIZE_MAP = {
  sm: {
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
    icon: 12,
    fontSize: 11,
  },
  md: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
    icon: 14,
    fontSize: 12,
  },
} as const;

export interface BudgetCategoryLike {
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface CategoryChipProps {
  category: BudgetCategoryLike;
  size?: CategoryChipSize;
  selected?: boolean;
  onPress?: () => void;
}

function ChipBody({
  category,
  size,
  selected,
}: {
  category: BudgetCategoryLike;
  size: CategoryChipSize;
  selected: boolean;
}) {
  const tone = category.color ?? BG_ACCENT;
  const config = SIZE_MAP[size];
  const textColor = selected ? BG_ON_ACCENT : BG_TEXT;

  return (
    <View
      style={[
        styles.chip,
        {
          minHeight: config.minHeight,
          paddingHorizontal: config.paddingHorizontal,
          paddingVertical: config.paddingVertical,
          backgroundColor: selected ? tone : BG_SURFACES.high,
        },
      ]}
    >
      {category.icon ? (
        category.icon.length <= 2 ? (
          <Text style={[styles.emoji, { fontSize: config.icon }]}>{category.icon}</Text>
        ) : (
          <MaterialSymbol name={category.icon} size={config.icon} color={textColor} />
        )
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            fontSize: config.fontSize,
            color: selected ? BG_ON_ACCENT : BG_TEXT_SECONDARY,
          },
        ]}
      >
        {category.name}
      </Text>
    </View>
  );
}

export function CategoryChip({
  category,
  size = 'md',
  selected = false,
  onPress,
}: CategoryChipProps) {
  if (!onPress) {
    return <ChipBody category={category} size={size} selected={selected} />;
  }

  return (
    <Pressable onPress={onPress}>
      <ChipBody category={category} size={size} selected={selected} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BG_CARD_RADIUS,
    alignSelf: 'flex-start',
  },
  emoji: {
    color: BG_TEXT,
  },
  label: {
    fontFamily: BG_FONTS.medium,
  },
});
