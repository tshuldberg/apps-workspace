import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  deleteWishlist,
  generateShareToken,
  getWishlistById,
  listItemsByWishlist,
  markAsPurchased,
  type Category,
  type WishlistItem,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { PRIORITY_COLOR, SHOP_ACCENT } from '../_ui';

const CATEGORIES: Array<'all' | Category> = [
  'all',
  'tech',
  'clothing',
  'books',
  'home',
  'kitchen',
  'gaming',
  'music',
  'sports',
  'gifts',
  'hobby',
  'other',
];

function formatCents(cents: number | null): string {
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function priceLabel(item: WishlistItem): string {
  if (item.priceCents != null) return formatCents(item.priceCents);
  if (item.priceRangeLow != null && item.priceRangeHigh != null) {
    return `${formatCents(item.priceRangeLow)}–${formatCents(item.priceRangeHigh)}`;
  }
  return '';
}

export default function WishlistDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ listId: string }>();
  const listId = Array.isArray(params.listId) ? params.listId[0] : params.listId;

  const [tick, setTick] = useState(0);
  const [category, setCategory] = useState<'all' | Category>('all');

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const list = useMemo(() => {
    if (!listId) return null;
    try {
      return getWishlistById(db, listId);
    } catch {
      return null;
    }
  }, [db, listId, tick]);

  const items = useMemo(() => {
    if (!listId) return [];
    try {
      return listItemsByWishlist(
        db,
        listId,
        category === 'all' ? undefined : { category },
      );
    } catch {
      return [];
    }
  }, [db, listId, tick, category]);

  if (!list) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>List not found</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/(shop)/')}>
          <Text style={styles.primaryButtonText}>Back to wishlists</Text>
        </Pressable>
      </View>
    );
  }

  const handleShare = async () => {
    try {
      const withToken = generateShareToken(db, list.id);
      if (!withToken?.shareToken) {
        Alert.alert('Error', "Couldn't generate share link.");
        return;
      }
      const url = `https://mylife.local/shop/share/${withToken.shareToken}`;
      await Share.share({ message: `My wishlist: ${list.name}\n${url}`, url });
      setTick((t) => t + 1);
    } catch {
      Alert.alert('Error', 'Sharing failed.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete list?', `This removes "${list.name}" and all items.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteWishlist(db, list.id);
          router.replace('/(shop)/');
        },
      },
    ]);
  };

  const handlePurchased = (item: WishlistItem) => {
    markAsPurchased(db, item.id, { purchasedAt: new Date().toISOString() });
    setTick((t) => t + 1);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{list.name}</Text>
        {list.description ? <Text style={styles.description}>{list.description}</Text> : null}
        <View style={styles.headerMeta}>
          {list.occasion ? <Text style={styles.metaChip}>{list.occasion}</Text> : null}
          {list.personId ? <Text style={styles.metaChip}>for {list.personId}</Text> : null}
          {list.shareToken ? <Text style={[styles.metaChip, styles.metaChipAccent]}>shared</Text> : null}
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push({ pathname: '/(shop)/wishlist/add-item', params: { listId: list.id } })}
        >
          <Text style={styles.primaryButtonText}>+ Add item</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleShare}>
          <Text style={styles.secondaryButtonText}>Share</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={handleDelete}>
          <Text style={styles.dangerButtonText}>Delete</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.filterPill, category === c && styles.filterPillActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.filterText, category === c && styles.filterTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptyBody}>Add your first wish with a name and optional price.</Text>
        </View>
      ) : (
        <View style={styles.itemGrid}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.itemCard, item.isPurchased && styles.itemCardPurchased]}
              onPress={() => router.push(`/(shop)/wishlist/item/${item.id}`)}
            >
              <View style={styles.itemHeader}>
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: PRIORITY_COLOR[item.priority] },
                  ]}
                />
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.isPurchased ? <Text style={styles.doneBadge}>done</Text> : null}
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemCategory}>{item.category}</Text>
                {priceLabel(item) ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.itemPrice}>{priceLabel(item)}</Text>
                  </>
                ) : null}
                {item.store ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.itemStore}>{item.store}</Text>
                  </>
                ) : null}
              </View>
              {!item.isPurchased ? (
                <Pressable
                  style={styles.quickAction}
                  onPress={() => handlePurchased(item)}
                  hitSlop={8}
                >
                  <Text style={styles.quickActionText}>Mark purchased</Text>
                </Pressable>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 14 },
  header: {
    gap: 8,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  headerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  metaChip: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  metaChipAccent: {
    color: SHOP_ACCENT,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  dangerButton: {
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  dangerButtonText: { color: '#FF6B6B', fontSize: 13, fontWeight: '700' },
  filterRow: { gap: 6, paddingRight: 20 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: SHOP_ACCENT, borderColor: SHOP_ACCENT },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  filterTextActive: { color: '#0E0E13' },
  empty: {
    gap: 8,
    padding: 20,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  itemGrid: { gap: 10 },
  itemCard: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemCardPurchased: { opacity: 0.55 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  itemName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  doneBadge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemCategory: { color: colors.textSecondary, fontSize: 12, textTransform: 'capitalize' },
  itemPrice: { color: colors.text, fontSize: 12, fontWeight: '700' },
  itemStore: { color: colors.textSecondary, fontSize: 12 },
  metaDot: { color: colors.textSecondary, fontSize: 12 },
  quickAction: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionText: { color: SHOP_ACCENT, fontSize: 12, fontWeight: '700' },
});
