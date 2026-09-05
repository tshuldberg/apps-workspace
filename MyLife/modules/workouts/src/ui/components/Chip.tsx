import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WK_ACCENT, WK_ON_ACCENT, WK_SURFACES } from '../tokens';
import { WK_FONTS } from '../typography';
import { MaterialSymbol } from './MaterialSymbol';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accent?: string;
  leadingIcon?: string;
}

function ChipBody({
  label,
  selected,
  accent,
  leadingIcon,
}: {
  label: string;
  selected: boolean;
  accent: string;
  leadingIcon?: string;
}) {
  const textColor = selected ? WK_ON_ACCENT : 'rgba(214, 195, 181, 0.88)';

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: selected ? accent : WK_SURFACES.high },
      ]}
    >
      {leadingIcon ? <MaterialSymbol name={leadingIcon} size={14} color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  accent = WK_ACCENT,
  leadingIcon,
}: ChipProps) {
  if (!onPress) {
    return (
      <ChipBody
        label={label}
        selected={selected}
        accent={accent}
        leadingIcon={leadingIcon}
      />
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <ChipBody
        label={label}
        selected={selected}
        accent={accent}
        leadingIcon={leadingIcon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 14,
  },
});
