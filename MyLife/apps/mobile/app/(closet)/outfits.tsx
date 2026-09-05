import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { createOutfit, listClothingItems, listOutfits } from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const CLOSET_ACCENT = '#E879A8';

function toggleItem(values: string[], itemId: string): string[] {
  return values.includes(itemId)
    ? values.filter((value) => value !== itemId)
    : [...values, itemId];
}

export default function ClosetOutfitsScreen() {
  const db = useDatabase();
  const [name, setName] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((value) => value + 1);
  const items = useMemo(() => listClothingItems(db, { status: 'active', limit: 200 }), [db, tick]);
  const outfits = useMemo(() => listOutfits(db), [db, tick]);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Build Outfit</Text>
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Outfit name"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.chipRow}>
            {items.map((item) => {
              const selected = selectedItemIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedItemIds((value) => toggleItem(value, item.id))}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              if (!name.trim() || selectedItemIds.length === 0) {
                return;
              }

              createOutfit(db, uuid(), {
                name: name.trim(),
                itemIds: selectedItemIds,
              });
              setName('');
              setSelectedItemIds([]);
              refresh();
            }}
          >
            <Text variant="label" color={colors.background}>Save Outfit</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Saved Outfits</Text>
        <View style={styles.list}>
          {outfits.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🧥</Text>
              <Text variant="subheading" style={{ textAlign: 'center' }}>Your looks await</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                Combine wardrobe items into reusable outfits.
              </Text>
            </View>
          ) : (
            outfits.map((outfit) => (
              <Card key={outfit.id} style={styles.innerCard}>
                <Text variant="body">{outfit.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {outfit.itemIds.map((itemId) => itemMap.get(itemId)?.name ?? 'Unknown').join(', ')}
                </Text>
              </Card>
            ))
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  formGrid: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: CLOSET_ACCENT,
    borderColor: CLOSET_ACCENT,
  },
  primaryButton: {
    backgroundColor: CLOSET_ACCENT,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  innerCard: {
    gap: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
});
