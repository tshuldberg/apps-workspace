import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createRegistryItem,
  getRegistryItemsByEvent,
  claimRegistryItem,
  getEvents,
} from '@mylife/rsvp';
import { Card, Text, EmptyState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';

const ACCENT = colors.modules.rsvp;

export default function RegistryScreen() {
  const db = useDatabase();
  const { selectedEventId } = useRsvpContext();
  const [tick, setTick] = useState(0);
  const [itemName, setItemName] = useState('');
  const [itemUrl, setItemUrl] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [quantity, setQuantity] = useState('1');

  const refresh = () => setTick((v) => v + 1);
  const events = useMemo(() => getEvents(db), [db, tick]);
  const eventId = selectedEventId ?? events[0]?.id ?? null;

  const items = useMemo(
    () => (eventId ? getRegistryItemsByEvent(db, eventId) : []),
    [db, eventId, tick],
  );

  const totalValue = items.reduce((sum, item) => sum + (item.priceCents ?? 0) * item.quantityWanted, 0);
  const claimedCount = items.filter((item) => item.quantityClaimed > 0).length;

  const handleAddItem = () => {
    if (!eventId || !itemName.trim()) return;
    const priceCents = priceStr.trim() ? Math.round(parseFloat(priceStr) * 100) : undefined;
    const qty = parseInt(quantity, 10);
    const id = `reg_${Date.now()}`;
    createRegistryItem(db, id, eventId, {
      name: itemName.trim(),
      url: itemUrl.trim() || undefined,
      priceCents: priceCents && !isNaN(priceCents) ? priceCents : undefined,
      quantityWanted: !isNaN(qty) && qty > 0 ? qty : 1,
    });
    setItemName('');
    setItemUrl('');
    setPriceStr('');
    setQuantity('1');
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!eventId ? (
        <EmptyState
          icon={'\uD83C\uDF81'}
          title="No event selected"
          message="Select an event to manage the gift registry."
        />
      ) : (
        <>
          {/* Summary */}
          <Card>
            <Text variant="subheading">Gift Registry</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: ACCENT }]}>{items.length}</Text>
                <Text variant="caption" color={colors.textSecondary}>Items</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: ACCENT }]}>{claimedCount}</Text>
                <Text variant="caption" color={colors.textSecondary}>Claimed</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: ACCENT }]}>
                  ${(totalValue / 100).toFixed(0)}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>Total Value</Text>
              </View>
            </View>
          </Card>

          {/* Item list */}
          <Card>
            <Text variant="subheading">Items</Text>
            <View style={styles.list}>
              {items.length === 0 ? (
                <EmptyState
                  icon={'\uD83C\uDF81'}
                  title="No items in the registry yet"
                  message="Add your first gift item below."
                />
              ) : (
                items.map((item) => {
                  const isClaimed = item.quantityClaimed >= item.quantityWanted;
                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.mainCopy}>
                        <Text variant="body" style={isClaimed ? styles.claimed : undefined}>
                          {item.name}
                        </Text>
                        {item.priceCents != null && (
                          <Text variant="caption" color={colors.textSecondary}>
                            ${(item.priceCents / 100).toFixed(2)}
                            {item.quantityWanted > 1 ? ` x ${item.quantityWanted}` : ''}
                          </Text>
                        )}
                        {item.claimedByName && (
                          <Text variant="caption" color={ACCENT}>
                            Claimed by {item.claimedByName}
                          </Text>
                        )}
                      </View>
                      {!isClaimed && (
                        <Pressable
                          style={styles.claimButton}
                          onPress={() => {
                            claimRegistryItem(db, item.id, 'Guest');
                            refresh();
                          }}
                        >
                          <Text variant="label" color={colors.background}>Claim</Text>
                        </Pressable>
                      )}
                      {isClaimed && (
                        <View style={[styles.badge, { backgroundColor: colors.success }]}>
                          <Text variant="caption" color={colors.background}>CLAIMED</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </Card>

          {/* Add item form */}
          <Card>
            <Text variant="subheading">Add Item</Text>
            <View style={styles.formGrid}>
              <TextInput
                style={styles.input}
                value={itemName}
                onChangeText={setItemName}
                placeholder="Item name"
                placeholderTextColor={colors.textTertiary}
              />
              <TextInput
                style={styles.input}
                value={itemUrl}
                onChangeText={setItemUrl}
                placeholder="URL (optional)"
                placeholderTextColor={colors.textTertiary}
              />
              <TextInput
                style={styles.input}
                value={priceStr}
                onChangeText={setPriceStr}
                placeholder="Price in $ (optional)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="Quantity wanted"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
              <Pressable style={styles.primaryButton} onPress={handleAddItem}>
                <Text variant="label" color={colors.background}>Add to Registry</Text>
              </Pressable>
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
  claimed: { textDecorationLine: 'line-through', opacity: 0.5 },
  claimButton: {
    backgroundColor: ACCENT, borderRadius: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  formGrid: { gap: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
