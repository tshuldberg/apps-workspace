import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, TrendingUp } from 'lucide-react-native';
import {
  getHarvests,
  getPlants,
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_CTA_GRADIENT,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  StatCard,
  SectionHeader,
  GardenTimelineEntry,
  type HarvestRecord,
  type Plant,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type ChartMode = 'weight' | 'count';

const GRAMS_PER_LB = 453.592;
const GRAMS_PER_KG = 1000;
const GRAMS_PER_OZ = 28.3495;

function toGrams(h: HarvestRecord): number {
  switch (h.unit) {
    case 'grams':
      return h.quantity;
    case 'kg':
      return h.quantity * GRAMS_PER_KG;
    case 'oz':
      return h.quantity * GRAMS_PER_OZ;
    case 'lbs':
      return h.quantity * GRAMS_PER_LB;
    default:
      return 0;
  }
}

function gramsToLb(g: number): number {
  return g / GRAMS_PER_LB;
}

function formatWeightLb(g: number): string {
  const lb = gramsToLb(g);
  if (lb >= 10) return `${lb.toFixed(0)} lb`;
  if (lb >= 1) return `${lb.toFixed(1)} lb`;
  if (g >= 1) return `${g.toFixed(0)} g`;
  return '0 g';
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function getSeasonStart(): Date {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  // Meteorological seasons: Spring=Mar-May, Summer=Jun-Aug, Fall=Sep-Nov, Winter=Dec-Feb
  let startMonth: number;
  if (m >= 2 && m <= 4) startMonth = 2;
  else if (m >= 5 && m <= 7) startMonth = 5;
  else if (m >= 8 && m <= 10) startMonth = 8;
  else startMonth = 11;
  const year = m === 0 || m === 1 ? y - 1 : y;
  return new Date(year, startMonth, 1);
}

export default function HarvestsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [chartMode, setChartMode] = useState<ChartMode>('weight');

  const harvests: HarvestRecord[] = useMemo(() => {
    try {
      return getHarvests(db);
    } catch {
      return [];
    }
  }, [db]);

  const plants: Plant[] = useMemo(() => {
    try {
      return getPlants(db);
    } catch {
      return [];
    }
  }, [db]);

  const plantById = useMemo(() => {
    const map = new Map<string, Plant>();
    for (const p of plants) map.set(p.id, p);
    return map;
  }, [plants]);

  // Stats calculation
  const now = new Date();
  const weekStart = getWeekStart(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const seasonStart = getSeasonStart();

  const rollup = useMemo(() => {
    const r = {
      week: { count: 0, grams: 0 },
      month: { count: 0, grams: 0 },
      season: { count: 0, grams: 0 },
      lifetime: { count: 0, grams: 0 },
    };
    for (const h of harvests) {
      const d = new Date(h.date);
      const g = toGrams(h);
      r.lifetime.count += 1;
      r.lifetime.grams += g;
      if (d >= seasonStart) {
        r.season.count += 1;
        r.season.grams += g;
      }
      if (d >= monthStart) {
        r.month.count += 1;
        r.month.grams += g;
      }
      if (d >= weekStart) {
        r.week.count += 1;
        r.week.grams += g;
      }
    }
    return r;
  }, [harvests, weekStart, monthStart, seasonStart]);

  // 12-week yield chart
  const chartData = useMemo(() => {
    const buckets: { label: string; count: number; grams: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() - i * 7);
      buckets.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        count: 0,
        grams: 0,
      });
    }
    const earliest = new Date(weekStart);
    earliest.setDate(earliest.getDate() - 11 * 7);
    for (const h of harvests) {
      const d = new Date(h.date);
      if (d < earliest) continue;
      const diffDays = Math.floor((d.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
      const idx = Math.floor(diffDays / 7);
      if (idx >= 0 && idx < 12) {
        buckets[idx].count += 1;
        buckets[idx].grams += toGrams(h);
      }
    }
    return buckets;
  }, [harvests, weekStart]);

  const maxChartValue = useMemo(() => {
    let m = 0;
    for (const b of chartData) {
      const v = chartMode === 'weight' ? b.grams : b.count;
      if (v > m) m = v;
    }
    return m;
  }, [chartData, chartMode]);

  // Top crops this season
  const topCrops = useMemo(() => {
    const map = new Map<string, { count: number; grams: number; plantId: string }>();
    for (const h of harvests) {
      const d = new Date(h.date);
      if (d < seasonStart) continue;
      const key = h.cropType ?? plantById.get(h.plantId)?.name ?? 'Unknown';
      const existing = map.get(key) ?? { count: 0, grams: 0, plantId: h.plantId };
      existing.count += 1;
      existing.grams += toGrams(h);
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].grams - a[1].grams)
      .slice(0, 8)
      .map(([name, data]) => ({ name, ...data }));
  }, [harvests, seasonStart, plantById]);

  // Recent 20 harvests
  const recent = useMemo(() => harvests.slice(0, 20), [harvests]);

  const displayTotalLb = gramsToLb(rollup.lifetime.grams);
  const subtitleText = `${rollup.lifetime.count} harvests · ${displayTotalLb.toFixed(1)} lb`;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.kicker}>DASHBOARD</Text>
          <Text style={styles.title}>Harvest Log</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsGrid}>
          <StatCard
            label="This Week"
            value={`${rollup.week.count}`}
            icon="📅"
          />
          <StatCard
            label="This Month"
            value={formatWeightLb(rollup.month.grams)}
            icon="🌱"
          />
          <StatCard
            label="This Season"
            value={`${rollup.season.count}`}
            icon="☀️"
          />
          <StatCard
            label="Lifetime"
            value={formatWeightLb(rollup.lifetime.grams)}
            icon="🏆"
          />
        </View>

        {/* Yield chart */}
        <GlassCard level={1} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <TrendingUp size={16} color={GARDEN_ACCENT} />
              <Text style={styles.chartTitle}>Yield · Last 12 Weeks</Text>
            </View>
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => setChartMode('weight')}
                style={[
                  styles.togglePill,
                  chartMode === 'weight' && styles.togglePillActive,
                ]}
                hitSlop={6}
              >
                <Text
                  style={[
                    styles.toggleText,
                    chartMode === 'weight' && styles.toggleTextActive,
                  ]}
                >
                  Weight
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setChartMode('count')}
                style={[
                  styles.togglePill,
                  chartMode === 'count' && styles.togglePillActive,
                ]}
                hitSlop={6}
              >
                <Text
                  style={[
                    styles.toggleText,
                    chartMode === 'count' && styles.toggleTextActive,
                  ]}
                >
                  Count
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.chart}>
            {chartData.map((b, i) => {
              const v = chartMode === 'weight' ? b.grams : b.count;
              const pct = maxChartValue > 0 ? v / maxChartValue : 0;
              const heightPct = Math.max(pct * 100, v > 0 ? 4 : 1);
              return (
                <View key={i} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${heightPct}%`,
                          backgroundColor:
                            v > 0 ? GARDEN_ACCENT : 'rgba(132, 204, 22, 0.15)',
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.chartAxis}>
            <Text style={styles.axisLabel}>{chartData[0]?.label ?? ''}</Text>
            <Text style={styles.axisLabel}>
              {chartData[Math.floor(chartData.length / 2)]?.label ?? ''}
            </Text>
            <Text style={styles.axisLabel}>
              {chartData[chartData.length - 1]?.label ?? ''}
            </Text>
          </View>
        </GlassCard>

        {/* Top crops */}
        {topCrops.length > 0 && (
          <View style={styles.section}>
            <SectionHeader label="THIS SEASON" title="Top Crops" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cropsRow}
            >
              {topCrops.map((crop) => (
                <GlassCard key={crop.name} level={2} style={styles.cropCard}>
                  <View style={styles.cropIconWrap}>
                    <Text style={styles.cropIcon}>🌿</Text>
                  </View>
                  <Text style={styles.cropName} numberOfLines={1}>
                    {crop.name}
                  </Text>
                  <Text style={styles.cropCount}>
                    {crop.count} {crop.count === 1 ? 'harvest' : 'harvests'}
                  </Text>
                  <Text style={styles.cropWeight}>
                    {formatWeightLb(crop.grams)}
                  </Text>
                </GlassCard>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent timeline */}
        {recent.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader label="TIMELINE" title="Recent Harvests" />
            <View style={styles.timeline}>
              {recent.map((h, i) => {
                const plant = plantById.get(h.plantId);
                const cropLabel = h.cropType ?? plant?.name ?? 'Unknown';
                const unitLabel =
                  h.unit === 'grams' ? 'g' : ` ${h.unit}`;
                const quantityText = `${h.quantity}${unitLabel}`;
                return (
                  <GardenTimelineEntry
                    key={h.id}
                    icon="🌽"
                    title={`${quantityText} · ${cropLabel}`}
                    subtitle={plant?.name && plant.name !== cropLabel ? plant.name : undefined}
                    time={h.date}
                    isLast={i === recent.length - 1}
                  />
                );
              })}
            </View>
          </View>
        ) : (
          <GlassCard level={1} style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🌽</Text>
            <Text style={styles.emptyTitle}>No harvests yet</Text>
            <Text style={styles.emptySub}>
              When your garden produces, log it here.
            </Text>
          </GlassCard>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => router.push('/(garden)/harvest/add')}
        style={[styles.fabWrap, { bottom: insets.bottom + 24 }]}
      >
        <LinearGradient
          colors={[GARDEN_CTA_GRADIENT.from, GARDEN_CTA_GRADIENT.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Plus size={22} color="#0B1a04" strokeWidth={3} />
          <Text style={styles.fabText}>Log Harvest</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GARDEN_SURFACES.base },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    gap: 24,
  },
  header: {
    gap: 6,
    paddingTop: spacing.sm,
  },
  kicker: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_ACCENT,
    letterSpacing: 2,
  },
  title: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
    fontSize: 34,
    letterSpacing: -0.02 * 34,
  },
  subtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chartCard: {
    gap: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: GARDEN_SURFACES.depth,
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  togglePillActive: {
    backgroundColor: GARDEN_ACCENT,
  },
  toggleText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: '#0B1a04',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 6,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  chartAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  axisLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    color: colors.textTertiary,
  },
  section: {
    gap: 8,
  },
  cropsRow: {
    paddingHorizontal: 4,
    gap: 12,
  },
  cropCard: {
    width: 140,
    gap: 6,
  },
  cropIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(132, 204, 22, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropIcon: {
    fontSize: 22,
  },
  cropName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },
  cropCount: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textTertiary,
  },
  cropWeight: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 13,
    color: GARDEN_ACCENT_LIGHT,
  },
  timeline: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  emptySub: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fabWrap: {
    position: 'absolute',
    right: 20,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: GARDEN_ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  fabText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: '#0B1a04',
    fontWeight: '700',
  },
});
