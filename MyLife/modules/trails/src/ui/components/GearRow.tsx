import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  TR_ACCENT,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  withAlpha,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface GearRowItem {
  name: string;
  category?: string | null;
  icon?: string | null;
}

export interface GearRowProps {
  gear: GearRowItem;
  weight?: string | number | null;
  owned: boolean;
  onPress?: () => void;
}

function formatWeight(weight?: string | number | null): string {
  if (weight == null) {
    return '--';
  }
  return typeof weight === 'number' ? `${weight} g` : weight;
}

export function GearRow({
  gear,
  weight,
  owned,
  onPress,
}: GearRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.leftRail}>
        <View style={styles.iconWrap}>
          <MaterialSymbol
            name={gear.icon ?? 'backpack'}
            size={18}
            color={TR_ACCENT}
          />
        </View>
        <View style={styles.copy}>
          <Text style={styles.name}>{gear.name}</Text>
          <Text style={styles.category}>
            {gear.category ?? 'Trail kit'} · {formatWeight(weight)}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.toggle,
          owned ? styles.toggleOwned : styles.toggleNeeded,
        ]}
      >
        <Text style={[styles.toggleCopy, owned ? styles.toggleOwnedCopy : styles.toggleNeededCopy]}>
          {owned ? 'Owned' : 'Need'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(TR_ACCENT, 0.12),
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  category: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  toggleOwned: {
    backgroundColor: withAlpha(TR_ACCENT, 0.16),
  },
  toggleNeeded: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  toggleCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
  },
  toggleOwnedCopy: {
    color: TR_ACCENT,
  },
  toggleNeededCopy: {
    color: TR_TEXT_TERTIARY,
  },
});
