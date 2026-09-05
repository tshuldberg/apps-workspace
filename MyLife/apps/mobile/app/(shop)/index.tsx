import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  listWishlists,
  listItemsByWishlist,
  type Wishlist,
  type WishlistItem,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { SHOP_ACCENT } from './_ui';

type Row = {
  list: Wishlist;
  items: WishlistItem[];
  openCount: number;
  estimatedCents: number;
};

function formatCents(cents: number): string {
  if (!cents) return '—';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function itemEstimate(item: WishlistItem): number {
  if (item.priceCents != null) return item.priceCents;
  if (item.priceRangeLow != null && item.priceRangeHigh != null) {
    return Math.round((item.priceRangeLow + item.priceRangeHigh) / 2);
  }
  return item.priceRangeLow ?? item.priceRangeHigh ?? 0;
}

export default function ShopWishlistsIndex() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const rows: Row[] = useMemo(() => {
    try {
      const lists = listWishlists(db);
      return lists.map((list) => {
        const items = listItemsByWishlist(db, list.id);
        const open = items.filter((i) => !i.isPurchased);
        const estimatedCents = open.reduce((sum, i) => sum + itemEstimate(i), 0);
        return { list, items, openCount: open.length, estimatedCents };
      });
    } catch {
      return [];
    }
  }, [db, tick]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Wishlist</Text>
        <Text style={styles.title}>Your wishlists</Text>
        <Text style={styles.subtitle}>
          Private wishlists for gifts, birthdays, and every store. Local only.
        </Text>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/(shop)/wishlist/create-list')}
      >
        <Text style={styles.primaryButtonText}>+ New list</Text>
      </Pressable>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No wishlists yet</Text>
          <Text style={styles.emptyBody}>
            Create your first wishlist to start saving things you want without a retailer account.
          </Text>
        </View>
      ) : (
        <View style={styles.listGrid}>
          {rows.map(({ list, openCount, estimatedCents }) => (
            <Pressable
              key={list.id}
              style={styles.listCard}
              onPress={() => router.push(`/(shop)/wishlist/${list.id}`)}
            >
              <View style={styles.listHeader}>
                <Text style={styles.listName}>{list.name}</Text>
                {list.occasion ? (
                  <View style={styles.occasionBadge}>
                    <Text style={styles.occasionBadgeText}>{list.occasion}</Text>
                  </View>
                ) : null}
              </View>
              {list.description ? (
                <Text style={styles.listDescription} numberOfLines={2}>
                  {list.description}
                </Text>
              ) : null}
              <View style={styles.listMeta}>
                <Text style={styles.metaPrimary}>{openCount} open</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaSecondary}>{formatCents(estimatedCents)} est.</Text>
                {list.isShareable ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.shareBadge}>shared</Text>
                  </>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 16 },
  hero: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SHOP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  empty: {
    gap: 8,
    padding: 20,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  listGrid: { gap: 12 },
  listCard: {
    gap: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listName: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  occasionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  occasionBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  listDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaPrimary: { color: colors.text, fontSize: 13, fontWeight: '700' },
  metaSecondary: { color: colors.textSecondary, fontSize: 13 },
  metaDot: { color: colors.textSecondary, fontSize: 13 },
  shareBadge: { color: SHOP_ACCENT, fontSize: 12, fontWeight: '700' },
});
