import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { TrailDifficulty } from '../../types';
import {
  TR_DIFFICULTY,
  TR_PILL_RADIUS,
  TR_TYPOGRAPHY,
  withAlpha,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export type DifficultyChipSize = 'sm' | 'md';

export interface DifficultyChipProps {
  level: TrailDifficulty;
  size?: DifficultyChipSize;
  style?: StyleProp<ViewStyle>;
}

const SIZE_MAP = {
  sm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    iconSize: 12,
    fontSize: 10,
  },
  md: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    iconSize: 14,
    fontSize: 11,
  },
} as const;

export function getDifficultyChipMeta(level: TrailDifficulty) {
  switch (level) {
    case 'easy':
      return {
        color: TR_DIFFICULTY.easy,
        icon: 'terrain',
        label: 'Easy',
      } as const;
    case 'moderate':
      return {
        color: TR_DIFFICULTY.moderate,
        icon: 'trending_up',
        label: 'Moderate',
      } as const;
    case 'hard':
      return {
        color: TR_DIFFICULTY.hard,
        icon: 'landscape',
        label: 'Hard',
      } as const;
    case 'expert':
      return {
        color: TR_DIFFICULTY.expert,
        icon: 'warning',
        label: 'Expert',
      } as const;
  }
}

export function DifficultyChip({
  level,
  size = 'md',
  style,
}: DifficultyChipProps) {
  const meta = getDifficultyChipMeta(level);
  const metrics = SIZE_MAP[size];

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: withAlpha(meta.color, 0.14),
          paddingHorizontal: metrics.paddingHorizontal,
          paddingVertical: metrics.paddingVertical,
          gap: metrics.gap,
        },
        style,
      ]}
    >
      <MaterialSymbol name={meta.icon} size={metrics.iconSize} color={meta.color} />
      <Text
        style={[
          styles.label,
          {
            color: meta.color,
            fontSize: metrics.fontSize,
          },
        ]}
      >
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: TR_PILL_RADIUS,
  },
  label: {
    ...TR_TYPOGRAPHY.labelUpper,
    fontSize: 11,
  },
});
