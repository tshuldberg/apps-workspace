import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  StatCard,
  createSeed,
  getSeeds,
  getZones,
  updateSeedQuantity,
  type Seed,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  GardenCategory,
  classifyGardenCategory,
  createLocalId,
} from './phase3-utils';

type SeedFilter = 'all' | 'vegetable' | 'herb' | 'flower' | 'expiring' | 'low-stock';

function daysUntil(dateLike: string | null): number | null {
  if (!dateLike) return null;
  const diff = new Date(dateLike).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function germinationDays(category: GardenCategory): string {
  if (category === 'vegetable') return '7-12d';
  if (category === 'herb') return '10-14d';
  if (category === 'flower') return '8-20d';
  return '10-18d';
}

export default function SeedsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<SeedFilter>('all');
  const [showComposer, setShowComposer] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('12');
  const [source, setSource] = useState('');
  const [expiry, setExpiry] = useState('');

  const seeds: Seed[] = useMemo(() => {
    try {
      return getSeeds(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const zones = useMemo(() => getZones(db), [db]);

  const stats = useMemo(() => {
    const expiringSoon = seeds.filter((seed) => {
      const remaining = daysUntil(seed.expiryDate);
      return remaining != null && remaining <= 90;
    }).length;
    const viableThisYear = seeds.filter((seed) => {
      const remaining = daysUntil(seed.expiryDate);
      return remaining == null || remaining > 180;
    }).length;
    return {
      total: seeds.length,
      viableThisYear,
      expiringSoon,
      zonesCovered: zones.length,
    };
  }, [seeds, zones.length]);

  const filteredSeeds = useMemo(() => {
    return seeds.filter((seed) => {
      const category = classifyGardenCategory(seed.name, seed.species);
      const remaining = daysUntil(seed.expiryDate);
      if (filter === 'vegetable' || filter === 'herb' || filter === 'flower') {
        return category === filter;
      }
      if (filter === 'expiring') {
        return remaining != null && remaining <= 90;
      }
      if (filter === 'low-stock') {
        return seed.quantity <= 3;
      }
      return true;
    });
  }, [filter, seeds]);

  const handleCreateSeed = () => {
    if (!name.trim()) return;
    createSeed(db, createLocalId(), {
      name: name.trim(),
      quantity: Number(quantity) || 0,
      source: source.trim() || null,
      expiryDate: expiry.trim() || null,
    });
    setTick((value) => value + 1);
    setShowComposer(false);
    setName('');
    setQuantity('12');
    setSource('');
    setExpiry('');
  };

  const adjustQuantity = (seed: Seed, delta: number) => {
    updateSeedQuantity(db, seed.id, Math.max(0, seed.quantity + delta));
    setTick((value) => value + 1);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <RNText style={styles.headerLabel}>INVENTORY</RNText>
            <RNText style={styles.headerTitle}>Seed Library</RNText>
          </View>
          <View style={styles.countBadge}>
            <RNText style={styles.countBadgeText}>{seeds.length} packets</RNText>
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatCard label="Total Packets" value={stats.total} icon="◦" />
          <StatCard label="Viable This Year" value={stats.viableThisYear} icon="◦" color={GARDEN_ACCENT} />
          <StatCard label="Expiring Soon" value={stats.expiringSoon} icon="◦" color={GARDEN_GOLD} />
          <StatCard label="Zones Covered" value={stats.zonesCovered} icon="◦" color={GARDEN_ACCENT_LIGHT} />
        </View>

        <View style={styles.filterRow}>
          {([
            ['all', 'All'],
            ['vegetable', 'Vegetable'],
            ['herb', 'Herb'],
            ['flower', 'Flower'],
            ['expiring', 'Expiring'],
            ['low-stock', 'Low Stock'],
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
            <RNText style={styles.composerTitle}>Add seed packet</RNText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Cucumber"
              placeholderTextColor="rgba(214, 195, 181, 0.45)"
              style={styles.input}
            />
            <View style={styles.composerRow}>
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                placeholder="Qty"
                keyboardType="number-pad"
                placeholderTextColor="rgba(214, 195, 181, 0.45)"
                style={[styles.input, styles.smallInput]}
              />
              <TextInput
                value={source}
                onChangeText={setSource}
                placeholder="Source"
                placeholderTextColor="rgba(214, 195, 181, 0.45)"
                style={[styles.input, styles.flexInput]}
              />
            </View>
            <TextInput
              value={expiry}
              onChangeText={setExpiry}
              placeholder="Expiry YYYY-MM-DD"
              placeholderTextColor="rgba(214, 195, 181, 0.45)"
              style={styles.input}
            />
            <Pressable onPress={handleCreateSeed}>
              <LinearGradient
                colors={[GARDEN_ACCENT_LIGHT, GARDEN_ACCENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButton}
              >
                <RNText style={styles.saveButtonText}>Save packet</RNText>
              </LinearGradient>
            </Pressable>
          </GlassCard>
        )}

        <View style={styles.grid}>
          {filteredSeeds.map((seed) => {
            const category = classifyGardenCategory(seed.name, seed.species);
            const remaining = daysUntil(seed.expiryDate);
            const badgeTone =
              remaining == null || remaining > 180
                ? GARDEN_ACCENT
                : remaining > 60
                  ? GARDEN_GOLD
                  : colors.danger;
            return (
              <GlassCard key={seed.id} level={1} style={styles.seedCard}>
                <View style={styles.seedHero}>
                  <RNText style={styles.seedHeroIcon}>◦</RNText>
                  <View
                    style={[
                      styles.viabilityBadge,
                      { backgroundColor: `${badgeTone}22` },
                    ]}
                  >
                    <RNText style={[styles.viabilityBadgeText, { color: badgeTone }]}>
                      {remaining == null || remaining > 180
                        ? 'Viable'
                        : remaining > 60
                          ? 'Watch'
                          : 'Urgent'}
                    </RNText>
                  </View>
                </View>

                <RNText style={styles.seedName}>{seed.name}</RNText>
                <RNText style={styles.seedSubtitle}>
                  {seed.species ?? category}
                </RNText>

                <View style={styles.seedMetaRow}>
                  <RNText style={styles.seedMetaLabel}>Qty</RNText>
                  <RNText style={styles.seedMetaValue}>{seed.quantity} packets</RNText>
                </View>
                <View style={styles.seedMetaRow}>
                  <RNText style={styles.seedMetaLabel}>Last planted</RNText>
                  <RNText style={styles.seedMetaValue}>
                    {seed.purchasedDate ?? 'Not logged'}
                  </RNText>
                </View>
                <View style={styles.seedMetaRow}>
                  <RNText style={styles.seedMetaLabel}>Germination</RNText>
                  <RNText style={styles.seedMetaValue}>{germinationDays(category)}</RNText>
                </View>

                <View style={styles.quantityRow}>
                  <Pressable onPress={() => adjustQuantity(seed, -1)} style={styles.quantityButton}>
                    <RNText style={styles.quantityButtonText}>-</RNText>
                  </Pressable>
                  <Pressable onPress={() => adjustQuantity(seed, 1)} style={styles.quantityButton}>
                    <RNText style={styles.quantityButtonText}>+</RNText>
                  </Pressable>
                </View>
              </GlassCard>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => setShowComposer((value) => !value)}
        style={styles.fab}
      >
        <LinearGradient
          colors={[GARDEN_ACCENT_LIGHT, GARDEN_ACCENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <RNText style={styles.fabText}>{showComposer ? '×' : '+'}</RNText>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: `${GARDEN_ACCENT}18`,
  },
  countBadgeText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
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
  smallInput: {
    width: 88,
  },
  flexInput: {
    flex: 1,
  },
  saveButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.background,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  seedCard: {
    width: '47%',
    gap: spacing.sm,
  },
  seedHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seedHeroIcon: {
    fontSize: 28,
    color: GARDEN_ACCENT,
  },
  viabilityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  viabilityBadgeText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
  },
  seedName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  seedSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  seedMetaRow: {
    gap: 2,
  },
  seedMetaLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  seedMetaValue: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quantityButton: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: `${GARDEN_ACCENT}18`,
  },
  quantityButtonText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: GARDEN_ACCENT_LIGHT,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xl,
  },
  fabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.background,
  },
});
