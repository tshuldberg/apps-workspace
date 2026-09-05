import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialSymbol } from './MaterialSymbol';
import {
  MK_SURFACES,
  MK_TEXT,
  MK_TEXT_SECONDARY,
  MK_TYPOGRAPHY,
} from '../tokens';
import { withAlpha } from '../logic';

export interface CategoryTileProps {
  name: string;
  icon: string;
  listingCount: number;
  color: string;
  onPress?: () => void;
}

function CategoryTileBody({
  name,
  icon,
  listingCount,
  color,
}: Omit<CategoryTileProps, 'onPress'>) {
  return (
    <View style={styles.tile}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: withAlpha(color, 0.18) },
        ]}
      >
        <MaterialSymbol name={icon} size={18} color={color} />
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.count}>{listingCount} Listings</Text>
    </View>
  );
}

export function CategoryTile({
  name,
  icon,
  listingCount,
  color,
  onPress,
}: CategoryTileProps) {
  if (!onPress) {
    return (
      <CategoryTileBody
        name={name}
        icon={icon}
        listingCount={listingCount}
        color={color}
      />
    );
  }

  return (
    <Pressable onPress={onPress}>
      <CategoryTileBody
        name={name}
        icon={icon}
        listingCount={listingCount}
        color={color}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 20,
    backgroundColor: MK_SURFACES.low,
    padding: 16,
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  count: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
  },
});
