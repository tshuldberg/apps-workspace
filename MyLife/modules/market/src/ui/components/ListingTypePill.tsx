import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ListingType } from '../../types';
import {
  MK_ACCENT_DARK,
  MK_SURFACES,
  MK_TEXT_SECONDARY,
  MK_TYPOGRAPHY,
} from '../tokens';
import { getListingTypeMeta } from '../logic';
import { MaterialSymbol } from './MaterialSymbol';

export interface ListingTypePillProps {
  type: ListingType;
  selected?: boolean;
  onPress?: () => void;
}

function ListingTypePillBody({
  type,
  selected,
}: {
  type: ListingType;
  selected: boolean;
}) {
  const meta = getListingTypeMeta(type);
  const foreground = selected ? MK_ACCENT_DARK : MK_TEXT_SECONDARY;

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: selected ? meta.color : MK_SURFACES.low,
        },
      ]}
    >
      <MaterialSymbol name={meta.icon} size={14} color={foreground} />
      <Text style={[styles.label, { color: foreground }]}>{meta.label}</Text>
    </View>
  );
}

export function ListingTypePill({
  type,
  selected = false,
  onPress,
}: ListingTypePillProps) {
  if (!onPress) {
    return <ListingTypePillBody type={type} selected={selected} />;
  }

  return (
    <Pressable onPress={onPress}>
      <ListingTypePillBody type={type} selected={selected} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    ...MK_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    lineHeight: 14,
  },
});
