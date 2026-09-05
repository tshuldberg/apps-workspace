import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import {
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  StatCard,
  createWishListItem,
  deleteWishListItem,
  getWishList,
  markWishListAcquired,
  type WishListItem,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useRouter } from 'expo-router';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  GardenCategory,
  classifyGardenCategory,
  createLocalId,
  priorityToStars,
  starsToPriority,
} from './phase3-utils';

type WishlistFilter = 'all' | GardenCategory;

function availableNow(category: GardenCategory, month: number): boolean {
  if (category === 'vegetable') return month >= 2 && month <= 5;
  if (category === 'herb') return month >= 2 && month <= 8;
  if (category === 'flower') return month >= 1 && month <= 4;
  if (category === 'tree' || category === 'shrub') return month >= 8 || month <= 2;
  return true;
}

export default function WishListScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<WishlistFilter>('all');
  const [showComposer, setShowComposer] = useState(false);
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  const month = new Date().getMonth();

  const items: WishListItem[] = useMemo(() => {
    try {
      return getWishList(db, true);
    } catch {
      return [];
    }
  }, [db, tick]);

  const activeItems = items.filter((item) => !item.acquired);

  const stats = useMemo(() => {
    const totalValue = activeItems.reduce(
      (sum, item) => sum + (item.estimatedPrice ?? 0),
      0,
    );
    const highPriority = activeItems.filter((item) => item.priority === 'high').length;
    const readyToBuy = activeItems.filter((item) =>
      availableNow(classifyGardenCategory(item.name, item.species), month),
    ).length;
    return {
      total: activeItems.length,
      highPriority,
      readyToBuy,
      totalValue,
    };
  }, [activeItems, month]);

  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      if (filter === 'all') return true;
      return classifyGardenCategory(item.name, item.species) === filter;
    });
  }, [activeItems, filter]);

  const inSeasonCount = stats.readyToBuy;

  const handleCreate = () => {
    if (!name.trim()) return;
    createWishListItem(db, createLocalId(), {
      name: name.trim(),
      source: source.trim() || null,
      estimatedPrice: price.trim() ? Number(price) : null,
      notes: notes.trim() || null,
      priority: 'medium',
    });
    setTick((value) => value + 1);
    setShowComposer(false);
    setName('');
    setSource('');
    setPrice('');
    setNotes('');
  };

  const handleMoveToGarden = (item: WishListItem) => {
    Alert.alert('Move to garden?', 'This will mark the wish as acquired and open Add Plant.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => {
          markWishListAcquired(db, item.id);
          setTick((value) => value + 1);
          router.push('/(garden)/add-plant');
        },
      },
    ]);
  };

  const handleRemove = (itemId: string) => {
    deleteWishListItem(db, itemId);
    setTick((value) => value + 1);
  };

  const setPriority = (itemId: string, stars: number) => {
    db.execute('UPDATE gd_wishlist SET priority = ?, updated_at = ? WHERE id = ?', [
      starsToPriority(stars),
      new Date().toISOString(),
      itemId,
    ]);
    setTick((value) => value + 1);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <RNText style={styles.headerLabel}>CURATION LIST</RNText>
          <RNText style={styles.headerTitle}>Wishlist</RNText>
          <RNText style={styles.headerBody}>
            Future curations for the sanctuary.
          </RNText>
        </View>
        <Pressable onPress={() => setShowComposer((value) => !value)}>
          <RNText style={styles.headerAction}>{showComposer ? 'Close' : '+ Add'}</RNText>
        </Pressable>
      </View>

      <View style={styles.statGrid}>
        <StatCard label="Total Wishes" value={stats.total} icon="◦" />
        <StatCard label="High Priority" value={stats.highPriority} icon="◦" color={GARDEN_ACCENT_LIGHT} />
        <StatCard label="Ready to Buy" value={stats.readyToBuy} icon="◦" color={GARDEN_GOLD} />
        <StatCard label="Wishlist Value" value={`$${stats.totalValue.toFixed(0)}`} icon="◦" />
      </View>

      <View style={styles.filterRow}>
        {([
          ['all', 'All'],
          ['vegetable', 'Vegetables'],
          ['herb', 'Herbs'],
          ['flower', 'Flowers'],
          ['tree', 'Trees'],
          ['shrub', 'Shrubs'],
          ['houseplant', 'Houseplants'],
        ] as const).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setFilter(value)}
            style={[styles.filterChip, filter === value && styles.filterChipActive]}
          >
            <RNText
              style={[
                styles.filterChipText,
                filter === value && styles.filterChipTextActive,
              ]}
            >
              {label}
            </RNText>
          </Pressable>
        ))}
      </View>

      {showComposer && (
        <GlassCard level={2} style={styles.composerCard}>
          <RNText style={styles.composerTitle}>Add a future plant</RNText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Alocasia Frydek"
            placeholderTextColor="rgba(214, 195, 181, 0.45)"
            style={styles.input}
          />
          <View style={styles.composerRow}>
            <TextInput
              value={source}
              onChangeText={setSource}
              placeholder="Nursery or seller"
              placeholderTextColor="rgba(214, 195, 181, 0.45)"
              style={[styles.input, styles.flexInput]}
            />
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="$"
              keyboardType="decimal-pad"
              placeholderTextColor="rgba(214, 195, 181, 0.45)"
              style={[styles.input, styles.priceInput]}
            />
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="South-facing shelf, velvet leaves, spring purchase"
            placeholderTextColor="rgba(214, 195, 181, 0.45)"
            style={[styles.input, styles.notesInput]}
            multiline
          />
          <GradientButton title="Save wish" onPress={handleCreate} />
        </GlassCard>
      )}

      <GlassCard level={1} style={styles.bannerCard}>
        <RNText style={styles.bannerTitle}>
          {inSeasonCount} wishlist items are in-season now
        </RNText>
        <Pressable onPress={() => setFilter('all')}>
          <RNText style={styles.bannerLink}>View Available</RNText>
        </Pressable>
      </GlassCard>

      <View style={styles.cardList}>
        {filteredItems.map((item) => {
          const stars = priorityToStars(item.priority);
          const category = classifyGardenCategory(item.name, item.species);
          return (
            <GlassCard key={item.id} level={1} style={styles.itemCard}>
              <View style={styles.itemHero}>
                <View style={styles.itemImagePlaceholder}>
                  <RNText style={styles.itemImageIcon}>◦</RNText>
                </View>
                <View style={styles.itemCopy}>
                  <RNText style={styles.itemName}>{item.name}</RNText>
                  <RNText style={styles.itemSubtitle}>
                    {item.species ?? category}
                  </RNText>
                  {item.source && (
                    <View style={styles.sourceChip}>
                      <RNText style={styles.sourceChipText}>{item.source}</RNText>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.priceRow}>
                <RNText style={styles.priceLabel}>Estimated price</RNText>
                <RNText style={styles.priceValue}>
                  {item.estimatedPrice != null ? `$${item.estimatedPrice.toFixed(0)}` : 'TBD'}
                </RNText>
              </View>

              <StarRow
                value={stars}
                onSelect={(value) => setPriority(item.id, value)}
              />

              <RNText style={styles.notesBody}>
                {item.notes || 'No notes yet. Capture shelf, care, or nursery details here.'}
              </RNText>

              <View style={styles.actionRow}>
                <GradientButton
                  title="Move to Garden"
                  onPress={() => handleMoveToGarden(item)}
                />
                <GradientButton
                  title="Remove"
                  onPress={() => handleRemove(item.id)}
                  variant="danger"
                />
              </View>
            </GlassCard>
          );
        })}
      </View>
    </ScrollView>
  );
}

function StarRow({
  value,
  onSelect,
}: {
  value: number;
  onSelect: (value: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }, (_, index) => index + 1).map((count) => (
        <Pressable key={count} onPress={() => onSelect(count)}>
          <RNText style={[styles.star, count <= value && styles.starFilled]}>
            ★
          </RNText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 1.1,
    color: GARDEN_ACCENT,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  headerAction: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  filterChipActive: {
    backgroundColor: `${GARDEN_ACCENT}24`,
  },
  filterChipText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: GARDEN_ACCENT_LIGHT,
  },
  composerCard: {
    gap: spacing.md,
  },
  composerTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  composerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: GARDEN_SURFACES.lift,
    color: colors.text,
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 15,
  },
  flexInput: {
    flex: 1,
  },
  priceInput: {
    width: 88,
  },
  notesInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  bannerTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
  },
  bannerLink: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  cardList: {
    gap: spacing.md,
  },
  itemCard: {
    gap: spacing.md,
  },
  itemHero: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  itemImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${GARDEN_ACCENT}18`,
  },
  itemImageIcon: {
    fontSize: 28,
    color: GARDEN_ACCENT,
  },
  itemCopy: {
    flex: 1,
    gap: 6,
  },
  itemName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
  },
  itemSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  sourceChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${GARDEN_GOLD}18`,
  },
  sourceChipText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
    color: GARDEN_GOLD,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  priceValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  starRow: {
    flexDirection: 'row',
    gap: 6,
  },
  star: {
    fontSize: 22,
    color: colors.textTertiary,
  },
  starFilled: {
    color: GARDEN_ACCENT_LIGHT,
  },
  notesBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionRow: {
    gap: spacing.sm,
  },
});
