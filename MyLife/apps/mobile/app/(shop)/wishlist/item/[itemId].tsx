import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  deleteWishlistItem,
  getWishlistItemById,
  markAsPurchased,
  type WishlistItem,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { PRIORITY_COLOR, SHOP_ACCENT } from '../../_ui';

function formatCents(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function priceDisplay(item: WishlistItem): string {
  if (item.priceCents != null) return formatCents(item.priceCents);
  if (item.priceRangeLow != null && item.priceRangeHigh != null) {
    return `${formatCents(item.priceRangeLow)}–${formatCents(item.priceRangeHigh)}`;
  }
  return '—';
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function WishlistItemDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ itemId: string }>();
  const itemId = Array.isArray(params.itemId) ? params.itemId[0] : params.itemId;

  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const item = useMemo(() => {
    if (!itemId) return null;
    try {
      return getWishlistItemById(db, itemId);
    } catch {
      return null;
    }
  }, [db, itemId, tick]);

  if (!item) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Item not found</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert('Delete item?', `Remove "${item.name}" from the wishlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteWishlistItem(db, item.id);
          router.back();
        },
      },
    ]);
  };

  const handlePurchased = () => {
    router.push({
      pathname: '/(shop)/purchase/log',
      params: { wishlistItemId: item.id },
    });
  };

  const handleMarkPurchasedOnly = () => {
    markAsPurchased(db, item.id, { purchasedAt: new Date().toISOString() });
    setTick((t) => t + 1);
  };

  const handleOpenUrl = async () => {
    if (item.url) {
      try {
        await Linking.openURL(item.url);
      } catch {
        Alert.alert('Error', "Couldn't open link.");
      }
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.priorityRow}>
          <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[item.priority] }]} />
          <Text style={[styles.priorityLabel, { color: PRIORITY_COLOR[item.priority] }]}>
            {item.priority}
          </Text>
          {item.isPurchased ? <Text style={styles.doneBadge}>purchased</Text> : null}
        </View>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.price}>{priceDisplay(item)}</Text>
      </View>

      <View style={styles.detailCard}>
        <DetailRow label="Category" value={item.category} />
        <DetailRow label="Store" value={item.store} />
        <DetailRow label="Brand" value={item.brand} />
        <DetailRow label="Size" value={item.sizeNotes} />
        <DetailRow label="Occasion" value={item.occasionTag} />
        <DetailRow label="Gift for" value={item.isGiftFor} />
        {item.purchasedAt ? (
          <DetailRow label="Purchased" value={new Date(item.purchasedAt).toLocaleDateString()} />
        ) : null}
      </View>

      {item.descriptionMd ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.paragraph}>{item.descriptionMd}</Text>
        </View>
      ) : null}

      {item.notesMd ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.paragraph}>{item.notesMd}</Text>
        </View>
      ) : null}

      {item.url ? (
        <Pressable style={styles.linkButton} onPress={handleOpenUrl}>
          <Text style={styles.linkButtonText}>Open link</Text>
        </Pressable>
      ) : null}

      {!item.isPurchased ? (
        <>
          <Pressable style={styles.primaryButton} onPress={handlePurchased}>
            <Text style={styles.primaryButtonText}>Log purchase</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleMarkPurchasedOnly}>
            <Text style={styles.secondaryButtonText}>Just mark as purchased</Text>
          </Pressable>
        </>
      ) : null}
      <Pressable style={styles.dangerButton} onPress={handleDelete}>
        <Text style={styles.dangerButtonText}>Delete item</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 12 },
  header: {
    gap: 6,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  priorityLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  doneBadge: { marginLeft: 8, color: '#34D399', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  price: { color: SHOP_ACCENT, fontSize: 18, fontWeight: '800' },
  detailCard: {
    gap: 6,
    padding: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: colors.textSecondary, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  sectionTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  paragraph: { color: colors.text, fontSize: 14, lineHeight: 20 },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SHOP_ACCENT,
  },
  linkButtonText: { color: SHOP_ACCENT, fontSize: 14, fontWeight: '700' },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  dangerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  dangerButtonText: { color: '#FF6B6B', fontSize: 14, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
