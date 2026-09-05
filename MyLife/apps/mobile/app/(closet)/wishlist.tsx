import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  listWishlistItems,
  createWishlistItem,
  deleteWishlistItem,
  markWishlistItemPurchased,
  getWishlistSummary,
  type WishlistItem,
  type WishlistSummary,
} from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#E879A8';

const PRIORITY_COLORS: Record<string, string> = {
  high: colors.danger,
  medium: '#FF9F0A',
  low: colors.textSecondary,
};

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function WishlistScreen() {
  const db = useDatabase();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [url, setUrl] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const wishlistItems: WishlistItem[] = useMemo(() => {
    try { return listWishlistItems(db, { isPurchased: false }); } catch { return []; }
  }, [db, tick]);

  const summary: WishlistSummary | null = useMemo(() => {
    try { return getWishlistSummary(db); } catch { return null; }
  }, [db, tick]);

  const handleAdd = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Enter an item name.');
      return;
    }
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const priceCents = priceStr ? Math.round(parseFloat(priceStr) * 100) : null;
      createWishlistItem(db, id, {
        name: name.trim(),
        category: 'other',
        estimatedPriceCents: isNaN(priceCents ?? NaN) ? null : priceCents,
        url: url.trim() || null,
      });
      setName(''); setPriceStr(''); setUrl('');
      setShowForm(false);
      refresh();
    } catch {
      Alert.alert('Error', "Couldn't add item.");
    }
  };

  const handlePurchased = (item: WishlistItem) => {
    try {
      markWishlistItemPurchased(db, item.id);
      refresh();
    } catch {
      Alert.alert('Error', "Couldn't mark as purchased.");
    }
  };

  const handleDelete = (item: WishlistItem) => {
    Alert.alert('Delete?', `Remove "${item.name}" from wishlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { deleteWishlistItem(db, item.id); refresh(); },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Wishlist</Text>

      {summary && (
        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Items</Text>
            <Text style={styles.metricValue}>{summary.totalItems}</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Total Value</Text>
            <Text style={styles.metricValue}>{formatCurrency(summary.totalEstimatedCents)}</Text>
          </Card>
        </View>
      )}

      <Pressable style={styles.addButton} onPress={() => setShowForm(!showForm)}>
        <Text variant="label" color={colors.background}>Add to Wishlist</Text>
      </Pressable>

      {showForm && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>NEW ITEM</Text>
          <View style={styles.formGrid}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Item name"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.formRow}>
              <TextInput
                style={styles.input}
                value={priceStr}
                onChangeText={setPriceStr}
                placeholder="Price ($)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="URL (optional)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="url"
              />
            </View>
            <Pressable style={styles.saveButton} onPress={handleAdd}>
              <Text variant="label" color={colors.background}>Save</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {wishlistItems.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>✨</Text>
            <Text variant="body" color={colors.textSecondary}>
              Your wishlist is empty
            </Text>
            <Text variant="caption" color={colors.textTertiary}>
              Save items you are considering purchasing.
            </Text>
          </View>
        </Card>
      ) : (
        wishlistItems.map((item) => (
          <Card key={item.id}>
            <View style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text variant="body">{item.name}</Text>
                <View style={styles.metaRow}>
                  {item.estimatedPriceCents != null && (
                    <Text variant="caption" color={ACCENT}>
                      {formatCurrency(item.estimatedPriceCents)}
                    </Text>
                  )}
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] ?? colors.textSecondary }]} />
                  <Text variant="iconCaption" color={colors.textTertiary}>{item.priority}</Text>
                  {item.brand && (
                    <Text variant="iconCaption" color={colors.textTertiary}>{item.brand}</Text>
                  )}
                </View>
              </View>
              <View style={styles.actionButtons}>
                <Pressable style={styles.purchasedBtn} onPress={() => handlePurchased(item)}>
                  <Text variant="iconCaption" color={colors.success}>Purchased</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(item)}>
                  <Text variant="iconCaption" color={colors.danger}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 24, fontWeight: '700' },
  addButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  formGrid: { marginTop: spacing.sm, gap: spacing.sm },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 44,
  },
  saveButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  itemInfo: { flex: 1, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  actionButtons: { alignItems: 'flex-end', gap: 8 },
  purchasedBtn: {
    borderWidth: 1, borderColor: colors.success, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
});
