import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createPackingList,
  getAverageWearsBetweenWashes,
  listClothingItems,
  listDirtyClothingItems,
  listOutfits,
  listPackingLists,
  listWearLogs,
  logWearEvent,
  markLaundryItemsClean,
  togglePackingListItemPacked,
} from '@mylife/closet';
import type { PackingListMode } from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const CLOSET_ACCENT = '#E879A8';
const PACKING_MODES: PackingListMode[] = ['quick_list', 'outfit_planning'];

function toggleItem(values: string[], itemId: string): string[] {
  return values.includes(itemId)
    ? values.filter((value) => value !== itemId)
    : [...values, itemId];
}

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export default function ClosetCalendarScreen() {
  const db = useDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedDirtyItemIds, setSelectedDirtyItemIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tripName, setTripName] = useState('');
  const [tripStartDate, setTripStartDate] = useState(today);
  const [tripEndDate, setTripEndDate] = useState(today);
  const [tripOccasions, setTripOccasions] = useState('');
  const [tripMode, setTripMode] = useState<PackingListMode>('quick_list');
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((value) => value + 1);
  const items = useMemo(() => listClothingItems(db, { status: 'active', limit: 200 }), [db, tick]);
  const outfits = useMemo(() => listOutfits(db), [db, tick]);
  const wearLogs = useMemo(() => listWearLogs(db, { limit: 20 }), [db, tick]);
  const dirtyItems = useMemo(() => listDirtyClothingItems(db), [db, tick]);
  const packingLists = useMemo(() => listPackingLists(db), [db, tick]);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Log Today&apos;s Wear</Text>
        <View style={styles.formGrid}>
          <Text variant="caption" color={colors.textSecondary}>Saved outfits</Text>
          <View style={styles.chipRow}>
            {outfits.map((outfit) => {
              const selected = selectedOutfitId === outfit.id;
              return (
                <Pressable
                  key={outfit.id}
                  onPress={() => setSelectedOutfitId(selected ? null : outfit.id)}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {outfit.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text variant="caption" color={colors.textSecondary}>Or pick items manually</Text>
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
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              if (!selectedOutfitId && selectedItemIds.length === 0) {
                return;
              }

              logWearEvent(db, uuid(), {
                date: today,
                outfitId: selectedOutfitId,
                itemIds: selectedItemIds,
                notes: notes.trim() || null,
              });
              setSelectedOutfitId(null);
              setSelectedItemIds([]);
              setNotes('');
              refresh();
            }}
          >
            <Text variant="label" color={colors.background}>Log Wear</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Laundry Day</Text>
        {dirtyItems.length === 0 ? (
          <Text variant="caption" color={colors.textSecondary}>
            Everything is clean. No laundry needed.
          </Text>
        ) : (
          <View style={styles.formGrid}>
            <View style={styles.list}>
              {dirtyItems.map((item) => {
                const selected = selectedDirtyItemIds.includes(item.id);
                const average = getAverageWearsBetweenWashes(db, item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedDirtyItemIds((value) => toggleItem(value, item.id))}
                    style={[styles.innerCard, selected ? styles.selectedCard : null]}
                  >
                    <Text variant="body">{item.name}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {item.careInstructions.replace('_', ' ')} · wears since wash {item.wearsSinceWash}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      Average wears between washes: {average ?? 'N/A'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                if (selectedDirtyItemIds.length === 0) {
                  return;
                }

                markLaundryItemsClean(db, {
                  itemIds: selectedDirtyItemIds,
                  eventDate: today,
                });
                setSelectedDirtyItemIds([]);
                refresh();
              }}
            >
              <Text variant="label" color={colors.background}>Mark Selected Clean</Text>
            </Pressable>
          </View>
        )}
      </Card>

      <Card>
        <Text variant="subheading">Packing Lists</Text>
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={tripName}
            onChangeText={setTripName}
            placeholder="Trip name"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={tripStartDate}
            onChangeText={setTripStartDate}
            placeholder="Start date YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={tripEndDate}
            onChangeText={setTripEndDate}
            placeholder="End date YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={tripOccasions}
            onChangeText={setTripOccasions}
            placeholder="Occasions, comma separated"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.chipRow}>
            {PACKING_MODES.map((mode) => {
              const selected = mode === tripMode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setTripMode(mode)}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {mode.replace('_', ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              if (!tripName.trim() || !tripStartDate.trim() || !tripEndDate.trim()) {
                return;
              }

              createPackingList(db, uuid(), {
                name: tripName.trim(),
                startDate: tripStartDate.trim(),
                endDate: tripEndDate.trim(),
                occasions: splitList(tripOccasions),
                mode: tripMode,
              });
              setTripName('');
              setTripOccasions('');
              setTripMode('quick_list');
              refresh();
            }}
          >
            <Text variant="label" color={colors.background}>Create Packing List</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {packingLists.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🧳</Text>
              <Text variant="subheading" style={{ textAlign: 'center' }}>Plan your next trip</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                Create a packing list to never forget what to bring.
              </Text>
            </View>
          ) : (
            packingLists.map((list) => {
              const packedCount = list.items.filter((item) => item.isPacked).length;
              return (
                <Card key={list.id} style={styles.innerCard}>
                  <Text variant="body">{list.name}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {list.startDate} to {list.endDate} · {packedCount}/{list.items.length} packed
                  </Text>
                  <View style={styles.chipRow}>
                    {list.items.slice(0, 8).map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          togglePackingListItemPacked(db, item.id);
                          refresh();
                        }}
                        style={[styles.chip, item.isPacked ? styles.chipActive : null]}
                      >
                        <Text variant="caption" color={item.isPacked ? colors.background : colors.textSecondary}>
                          {item.customName ?? itemMap.get(item.clothingItemId ?? '')?.name ?? 'Wardrobe item'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Recent Wear</Text>
        <View style={styles.list}>
          {wearLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text variant="subheading" style={{ textAlign: 'center' }}>Start your style journal</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                Log what you wear each day to discover your patterns.
              </Text>
            </View>
          ) : (
            wearLogs.map((log) => (
              <Card key={log.id} style={styles.innerCard}>
                <Text variant="body">{log.date}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {log.itemIds.map((itemId) => itemMap.get(itemId)?.name ?? 'Unknown').join(', ')}
                </Text>
                {log.notes ? (
                  <Text variant="caption" color={colors.textSecondary}>{log.notes}</Text>
                ) : null}
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
  selectedCard: {
    borderColor: CLOSET_ACCENT,
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
