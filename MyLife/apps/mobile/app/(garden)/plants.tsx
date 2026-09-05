import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Search, Sprout } from 'lucide-react-native';
import {
  GARDEN_ACCENT,
  GARDEN_CTA_GRADIENT,
  GARDEN_DANGER,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GradientButton,
  HealthDot,
  PlantCard,
  ZoneChip,
  getPlants,
  getWateringSchedule,
  type GardenHealthStatus,
  type Plant,
  type WateringScheduleItem,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useDatabase } from '../../components/DatabaseProvider';

type FilterKey = 'all' | 'needs_attention' | 'healthy' | 'by_zone';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_attention', label: 'Needs Attention' },
  { key: 'healthy', label: 'Healthy' },
  { key: 'by_zone', label: 'By Zone' },
];

export default function PlantsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const plants: Plant[] = useMemo(() => getPlants(db), [db]);
  const schedule: WateringScheduleItem[] = useMemo(
    () => getWateringSchedule(db),
    [db],
  );
  const scheduleByPlant = useMemo(() => {
    const map = new Map<string, WateringScheduleItem>();
    for (const item of schedule) map.set(item.plantId, item);
    return map;
  }, [schedule]);

  const overdueIds = useMemo(
    () => new Set(schedule.filter((s) => s.isOverdue).map((s) => s.plantId)),
    [schedule],
  );
  const hasOverdue = overdueIds.size > 0;

  const filteredPlants = useMemo(() => {
    let list = plants;
    const q = search.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.species != null && p.species.toLowerCase().includes(q)) ||
          (p.zone != null && p.zone.toLowerCase().includes(q)),
      );
    }
    if (filter === 'needs_attention') {
      list = list.filter(
        (p) => overdueIds.has(p.id) || p.status === 'needs_attention',
      );
    } else if (filter === 'healthy') {
      list = list.filter(
        (p) => p.status === 'healthy' && !overdueIds.has(p.id),
      );
    }
    return list;
  }, [plants, search, filter, overdueIds]);

  const groupedByZone = useMemo(() => {
    if (filter !== 'by_zone') return null;
    const map = new Map<string, Plant[]>();
    for (const p of filteredPlants) {
      const key = p.zone ?? 'Unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredPlants, filter]);

  const toHealthStatus = useCallback(
    (plant: Plant): GardenHealthStatus => {
      if (overdueIds.has(plant.id)) return 'needsWater';
      if (plant.status === 'needs_attention') return 'needsWater';
      if (plant.status === 'dormant' || plant.status === 'dead') return 'dormant';
      return 'healthy';
    },
    [overdueIds],
  );

  const formatNextWater = (item?: WateringScheduleItem): string | undefined => {
    if (item == null) return undefined;
    if (item.isOverdue) {
      return `${item.daysOverdue}d overdue`;
    }
    if (item.nextWaterDate == null) return undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(item.nextWaterDate);
    next.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays}d`;
  };

  const goToPlant = (id: string) => router.push(`/(garden)/plant/${id}`);
  const goToAddPlant = () => router.push('/(garden)/add-plant');

  const renderGrid = (items: Plant[]) => (
    <View style={styles.grid}>
      {items.map((plant) => {
        const item = scheduleByPlant.get(plant.id);
        return (
          <View key={plant.id} style={styles.gridCell}>
            <PlantCard
              photoUri={plant.imageUri ?? undefined}
              name={plant.name}
              species={plant.species ?? undefined}
              zone={plant.zone ?? undefined}
              healthStatus={toHealthStatus(plant)}
              nextWaterIn={formatNextWater(item)}
              lastWatered={plant.lastWatered ?? undefined}
              onPress={() => goToPlant(plant.id)}
            />
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 140 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleStack}>
              <View style={styles.titleLine}>
                <Text style={styles.title}>My Plants</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {plants.length} {plants.length === 1 ? 'SPECIMEN' : 'SPECIMENS'}
                  </Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                Curation of your indoor sanctuary
              </Text>
            </View>
            <Pressable
              onPress={() => setSearchOpen((v) => !v)}
              style={styles.searchToggle}
              hitSlop={8}
              accessibilityLabel="Toggle search"
            >
              <Search size={20} color={colors.textSecondary} strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>

        {/* Search bar */}
        {(searchOpen || plants.length >= 8) && (
          <View style={styles.searchBar}>
            <Search
              size={18}
              color={colors.textSecondary}
              strokeWidth={1.8}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search species, variety..."
              placeholderTextColor="rgba(214, 195, 181, 0.5)"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {/* Filter chips */}
        {plants.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const isAttention = f.key === 'needs_attention' && hasOverdue;
              const accent = isAttention ? GARDEN_DANGER : GARDEN_ACCENT;
              return (
                <ZoneChip
                  key={f.key}
                  label={f.label}
                  active={active}
                  color={accent}
                  onPress={() => setFilter(f.key)}
                />
              );
            })}
          </ScrollView>
        )}

        {/* Sort bar */}
        {plants.length > 0 && (
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>
              Sort: <Text style={styles.sortValue}>Name ▾</Text>
            </Text>
          </View>
        )}

        {/* Empty state */}
        {plants.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Sprout size={48} color={GARDEN_ACCENT} strokeWidth={1.4} />
            </View>
            <Text style={styles.emptyTitle}>Your garden awaits</Text>
            <Text style={styles.emptySubtitle}>
              Plant your first specimen to begin curating
            </Text>
            <View style={styles.emptyCta}>
              <GradientButton title="Add Plant" onPress={goToAddPlant} />
            </View>
          </View>
        ) : filteredPlants.length === 0 ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>
              {search.trim().length > 0
                ? `No plants match "${search.trim()}"`
                : 'No plants in this filter'}
            </Text>
          </View>
        ) : groupedByZone != null ? (
          groupedByZone.map(([zoneName, zonePlants]) => (
            <View key={zoneName} style={styles.zoneGroup}>
              <View style={styles.zoneGroupHeader}>
                <View style={styles.zoneAccent} />
                <Text style={styles.zoneGroupLabel}>{zoneName}</Text>
                <Text style={styles.zoneGroupCount}>{zonePlants.length}</Text>
              </View>
              {renderGrid(zonePlants)}
            </View>
          ))
        ) : (
          renderGrid(filteredPlants)
        )}

        {/* Health legend (small affordance for HealthDot meaning) */}
        {plants.length > 0 && (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <HealthDot status="healthy" size={8} />
              <Text style={styles.legendLabel}>Healthy</Text>
            </View>
            <View style={styles.legendItem}>
              <HealthDot status="needsWater" size={8} />
              <Text style={styles.legendLabel}>Needs water</Text>
            </View>
            <View style={styles.legendItem}>
              <HealthDot status="harvestReady" size={8} />
              <Text style={styles.legendLabel}>Harvest</Text>
            </View>
            <View style={styles.legendItem}>
              <HealthDot status="dormant" size={8} />
              <Text style={styles.legendLabel}>Dormant</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={goToAddPlant}
        style={[styles.fab, { bottom: insets.bottom + 96 }]}
        accessibilityLabel="Add plant"
        hitSlop={6}
      >
        <LinearGradient
          colors={[GARDEN_CTA_GRADIENT.from, GARDEN_CTA_GRADIENT.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Plus size={28} color="#0B1A04" strokeWidth={2.6} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  header: {},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleStack: { flex: 1, gap: 6 },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: GARDEN_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: GARDEN_TYPOGRAPHY.displayLg.fontSize,
    letterSpacing: GARDEN_TYPOGRAPHY.displayLg.letterSpacing,
    color: colors.text,
  },
  countBadge: {
    backgroundColor: 'rgba(132, 204, 22, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countBadgeText: {
    fontFamily: GARDEN_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: GARDEN_ACCENT,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
  },
  searchToggle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.lift,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GARDEN_SURFACES.highest,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 15,
    paddingVertical: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: -spacing.xs,
  },
  sortLabel: {
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
  },
  sortValue: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  gridCell: {
    width: '47.5%',
  },
  zoneGroup: { gap: spacing.sm },
  zoneGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zoneAccent: {
    width: 18,
    height: 2,
    backgroundColor: GARDEN_ACCENT,
    borderRadius: 1,
  },
  zoneGroupLabel: {
    fontFamily: GARDEN_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  zoneGroupCount: {
    fontFamily: GARDEN_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 11,
    color: GARDEN_ACCENT,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: 'rgba(132, 204, 22, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyCta: { marginTop: spacing.md },
  noResults: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  noResultsText: {
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLabel: {
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 11,
    color: colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
