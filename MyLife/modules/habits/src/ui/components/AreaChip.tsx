import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HB_SURFACES, HB_TEXT, HB_TEXT_SECONDARY, HB_TYPOGRAPHY, withAlpha } from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export type AreaChipArea = {
  name: string;
  color?: string | null;
  icon?: string | null;
};

export interface AreaChipProps {
  area: AreaChipArea;
  selected?: boolean;
  onPress?: () => void;
}

export function AreaChip({
  area,
  selected = false,
  onPress,
}: AreaChipProps) {
  const tint = area.color ?? HB_TEXT_SECONDARY;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={onPress == null}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? withAlpha(tint, 0.18) : HB_SURFACES.low,
        },
      ]}
    >
      {area.icon ? (
        <MaterialSymbol
          name={area.icon}
          size={14}
          color={tint}
        />
      ) : (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: tint,
            },
          ]}
        />
      )}
      <Text
        style={[
          styles.label,
          {
            color: selected ? HB_TEXT : tint,
          },
        ]}
      >
        {area.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...HB_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 18,
  },
});
