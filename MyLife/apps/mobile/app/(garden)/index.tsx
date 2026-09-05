import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Leaf, Sprout, Droplet, Search, Bell } from 'lucide-react-native';
import {
  getPlants,
  getGardenStats,
  getWateringSchedule,
  getEntriesByDate,
  getHarvests,
  getSetting,
  waterPlant,
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_DANGER,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  SectionHeader,
  GlassCard,
  StatCard,
  QuickActionButton,
  GardenTimelineEntry,
  GradientButton,
  type Plant,
  type GardenStats,
  type WateringScheduleItem,
  type GardenEntry,
  type CareAction,
} from '@mylife/garden';
import { Text, colors, spacing, borderRadius } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

export default function GardenOverviewScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [watering, setWatering] = useState(false);

  const stats: GardenStats = useMemo(() => getGardenStats(db), [db, tick]);
  const schedule: WateringScheduleItem[] = useMemo(
    () => getWateringSchedule(db),
    [db, tick],
  );
  const plants: Plant[] = useMemo(() => getPlants(db), [db, tick]);
  const harvests = useMemo(() => getHarvests(db), [db, tick]);
  const onboardingComplete = useMemo(
    () => getSetting(db, 'onboarding_complete'),
    [db, tick],
  );

  const recentEntries: GardenEntry[] = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = today.toISOString().slice(0, 10);
    return getEntriesByDate(db, startStr, endStr).slice(0, 5);
  }, [db, tick]);

  const plantNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of plants) map.set(p.id, p.name);
    return map;
  }, [plants]);

  const overduePlants = useMemo(
    () => schedule.filter((s) => s.isOverdue),
    [schedule],
  );

  const harvestReadyCount = useMemo(() => {
    const ids = new Set<string>();
    for (const h of harvests) ids.add(h.plantId);
    return ids.size;
  }, [harvests]);

  const totalHarvests = harvests.length;

  const oldestPlant = useMemo(() => {
    const withDate = plants
      .filter((p): p is Plant & { acquiredDate: string } => p.acquiredDate != null)
      .sort((a, b) => a.acquiredDate.localeCompare(b.acquiredDate));
    return withDate[0] ?? null;
  }, [plants]);

  const speciesCount = useMemo(() => {
    const set = new Set<string>();
    for (const p of plants) {
      if (p.species != null && p.species.trim() !== '') {
        set.add(p.species.toLowerCase());
      }
    }
    return set.size;
  }, [plants]);

  const gardenAgeLabel = useMemo(() => {
    if (oldestPlant == null) return null;
    const start = new Date(oldestPlant.acquiredDate);
    const now = new Date();
    const months =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth());
    if (months < 1) return 'New';
    if (months < 12) return `${months}m`;
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths === 0 ? `${years}y` : `${years}y ${remMonths}m`;
  }, [oldestPlant]);

  const oldestPlantAgeLabel = useMemo(() => {
    if (oldestPlant == null) return null;
    const start = new Date(oldestPlant.acquiredDate);
    const now = new Date();
    const years = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years < 1) {
      const months = Math.max(1, Math.round(years * 12));
      return `${months} month${months === 1 ? '' : 's'}`;
    }
    const rounded = Math.round(years * 10) / 10;
    return `${rounded} year${rounded === 1 ? '' : 's'}`;
  }, [oldestPlant]);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d
      .toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
      .toUpperCase();
  }, []);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleWaterAll = useCallback(async () => {
    setWatering(true);
    let completed = 0;
    for (const item of overduePlants) {
      try {
        waterPlant(db, item.plantId);
        completed++;
      } catch {
        Alert.alert(
          'Partial Failure',
          `Couldn't water ${item.plantName}. ${completed} of ${overduePlants.length} completed.`,
        );
        break;
      }
    }
    refresh();
    setWatering(false);
  }, [db, overduePlants, refresh]);

  const isFirstRun = plants.length === 0 && !onboardingComplete;

  if (isFirstRun) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.onboardingContent}>
        <Header />
        <View style={styles.onboardingCard}>
          <Text variant="heading">Welcome to MyGarden</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.mt8}>
            Set up in 3 quick steps:
          </Text>
          <Pressable
            style={styles.onboardingStep}
            onPress={() => router.push('/(garden)/frost')}
          >
            <Text variant="body" color={GARDEN_ACCENT}>
              1. Set your frost zone
            </Text>
          </Pressable>
          <Pressable
            style={styles.onboardingStep}
            onPress={() => router.push('/(garden)/zones')}
          >
            <Text variant="body" color={GARDEN_ACCENT}>
              2. Create a zone (e.g. "Living Room")
            </Text>
          </Pressable>
          <Pressable
            style={styles.onboardingStep}
            onPress={() => router.push('/(garden)/add-plant')}
          >
            <Text variant="body" color={GARDEN_ACCENT}>
              3. Add your first plant
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (plants.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.emptyContainer}>
        <Sprout size={48} color={GARDEN_ACCENT} strokeWidth={1.5} />
        <Text variant="subheading" style={styles.mt8}>
          Your garden awaits
        </Text>
        <Text variant="body" color={colors.textSecondary} style={styles.mt8}>
          Add your first plant to start tracking care.
        </Text>
        <View style={styles.mt16}>
          <GradientButton
            title="Add Plant"
            onPress={() => router.push('/(garden)/add-plant')}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textSecondary}
        />
      }
    >
      <Header overdueCount={stats.overdueWateringCount} />

      {/* Greeting */}
      <View style={styles.greetingBlock}>
        <RNText style={styles.greetingHeadline}>Today</RNText>
        <RNText style={styles.greetingDate}>{todayLabel}</RNText>
      </View>

      {/* Overdue Watering Alert Banner */}
      {overduePlants.length > 0 && (
        <View style={styles.alertBanner}>
          <View style={styles.alertLeft}>
            <View style={styles.alertIconCircle}>
              <Droplet size={20} color={GARDEN_DANGER} strokeWidth={2} />
            </View>
            <View style={styles.alertText}>
              <RNText style={styles.alertTitle}>
                {overduePlants.length} plant
                {overduePlants.length === 1 ? '' : 's'} need
                {overduePlants.length === 1 ? 's' : ''} water
              </RNText>
              <RNText style={styles.alertSubtitle} numberOfLines={1}>
                Thirsty:{' '}
                {overduePlants
                  .slice(0, 2)
                  .map((p) => p.plantName)
                  .join(', ')}
                {overduePlants.length > 2 ? '…' : ''}
              </RNText>
            </View>
          </View>
          <Pressable
            onPress={handleWaterAll}
            disabled={watering}
            style={styles.alertCta}
          >
            <RNText style={styles.alertCtaText}>
              {watering ? '...' : 'Water Now'}
            </RNText>
          </Pressable>
        </View>
      )}

      {/* Live Overview */}
      <View style={styles.section}>
        <View style={styles.statHeaderRow}>
          <RNText style={styles.uppercaseLabel}>Live Overview</RNText>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statRow}
        >
          <View style={styles.statSlot}>
            <StatCard
              label="Active Plants"
              value={String(stats.totalPlants).padStart(2, '0')}
              icon="🌱"
            />
          </View>
          <View style={styles.statSlot}>
            <StatCard
              label="Overdue"
              value={String(stats.overdueWateringCount).padStart(2, '0')}
              icon="💧"
              color={stats.overdueWateringCount > 0 ? GARDEN_DANGER : undefined}
            />
          </View>
          <View style={styles.statSlot}>
            <StatCard
              label="Harvest Ready"
              value={String(harvestReadyCount).padStart(2, '0')}
              icon="🧺"
            />
          </View>
          <View style={styles.statSlot}>
            <StatCard
              label="Total Harvests"
              value={String(totalHarvests).padStart(2, '0')}
              icon="✓"
            />
          </View>
        </ScrollView>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <View style={styles.quickActionGrid}>
          <View style={styles.quickActionItem}>
            <QuickActionButton
              icon="+"
              label="Add Plant"
              onPress={() => router.push('/(garden)/add-plant')}
            />
          </View>
          <View style={styles.quickActionItem}>
            <QuickActionButton
              icon="💧"
              label="Log Water"
              onPress={() => router.push('/(garden)/watering')}
            />
          </View>
          <View style={styles.quickActionItem}>
            <QuickActionButton
              icon="✓"
              label="Add Task"
              onPress={() => router.push('/(garden)/tasks')}
            />
          </View>
          <View style={styles.quickActionItem}>
            <QuickActionButton
              icon="✂︎"
              label="Log Harvest"
              onPress={() => router.push('/(garden)/harvest/add')}
            />
          </View>
        </View>
      </View>

      {/* Garden Biography */}
      <View style={styles.section}>
        <SectionHeader label="Garden Biography" title="Your Sanctuary" />
        <View style={styles.bioCardWrap}>
          <GlassCard level={1}>
            <View style={styles.bioInner}>
              {oldestPlant?.imageUri != null ? (
                <Image
                  source={{ uri: oldestPlant.imageUri }}
                  style={styles.bioImage}
                />
              ) : (
                <View style={[styles.bioImage, styles.bioImagePlaceholder]}>
                  <Leaf size={32} color={GARDEN_ACCENT} strokeWidth={1.5} />
                </View>
              )}
              <View style={styles.bioBody}>
                <RNText style={styles.bioMiniLabel}>Oldest Plant</RNText>
                <RNText style={styles.bioName}>
                  {oldestPlant?.name ?? 'No plants yet'}
                </RNText>
                {oldestPlant?.species != null && (
                  <RNText style={styles.bioSpecies}>
                    {oldestPlant.species}
                  </RNText>
                )}
                {oldestPlantAgeLabel != null && (
                  <RNText style={styles.bioAccent}>
                    {oldestPlantAgeLabel} old
                  </RNText>
                )}

                <View style={styles.bioStatRow}>
                  <View style={styles.bioStatCell}>
                    <RNText style={styles.bioMiniLabel}>Diversity</RNText>
                    <RNText style={styles.bioStatValue}>
                      {speciesCount} Species
                    </RNText>
                  </View>
                  <View style={styles.bioStatCell}>
                    <RNText style={styles.bioMiniLabel}>Garden Age</RNText>
                    <RNText style={styles.bioStatValue}>
                      {gardenAgeLabel ?? '--'}
                    </RNText>
                  </View>
                </View>

                <Pressable
                  onPress={() => router.push('/(garden)/plants')}
                  hitSlop={6}
                  style={styles.bioLinkWrap}
                >
                  <RNText style={styles.bioLink}>View Full Biography →</RNText>
                </Pressable>
              </View>
            </View>
          </GlassCard>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <SectionHeader
          label="Recent Activity"
          title="Garden Journal"
          action={{
            text: 'View All',
            onPress: () => router.push('/(garden)/journal'),
          }}
        />
        <View style={styles.timelineWrap}>
          {recentEntries.length === 0 ? (
            <RNText style={styles.timelineEmpty}>
              No activity yet. Log your first care entry to see it here.
            </RNText>
          ) : (
            recentEntries.map((entry, i) => {
              const meta = describeAction(entry.action);
              const plantName =
                entry.plantId != null
                  ? plantNameById.get(entry.plantId) ?? 'Unknown plant'
                  : 'Garden';
              return (
                <GardenTimelineEntry
                  key={entry.id}
                  icon={meta.icon}
                  iconColor={meta.color}
                  title={`${meta.verb} ${plantName}`}
                  subtitle={entry.notes ?? undefined}
                  time={formatRelativeTime(entry.date)}
                  isLast={i === recentEntries.length - 1}
                />
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function Header({ overdueCount = 0 }: { overdueCount?: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Leaf size={24} color={GARDEN_ACCENT} strokeWidth={2} />
        <RNText style={styles.headerTitle}>MyGarden</RNText>
      </View>
      <View style={styles.headerRight}>
        <Pressable hitSlop={8} style={styles.headerIconBtn}>
          <Search size={20} color="rgba(228,225,233,0.6)" strokeWidth={1.8} />
        </Pressable>
        <Pressable hitSlop={8} style={styles.headerIconBtn}>
          <Bell
            size={20}
            color={overdueCount > 0 ? GARDEN_DANGER : 'rgba(228,225,233,0.6)'}
            strokeWidth={1.8}
          />
          {overdueCount > 0 && <View style={styles.headerDot} />}
        </Pressable>
      </View>
    </View>
  );
}

function describeAction(action: CareAction): {
  icon: string;
  color: string;
  verb: string;
} {
  switch (action) {
    case 'water':
      return { icon: '💧', color: GARDEN_ACCENT_LIGHT, verb: 'Watered' };
    case 'fertilize':
      return { icon: '✦', color: GARDEN_ACCENT, verb: 'Fertilized' };
    case 'prune':
      return { icon: '✂︎', color: GARDEN_ACCENT, verb: 'Pruned' };
    case 'repot':
      return { icon: '⟳', color: GARDEN_ACCENT, verb: 'Repotted' };
    case 'harvest':
      return { icon: '🧺', color: GARDEN_ACCENT, verb: 'Harvested' };
    case 'pest_treatment':
      return { icon: '⚠', color: GARDEN_DANGER, verb: 'Treated' };
    case 'photo':
      return { icon: '◉', color: GARDEN_ACCENT, verb: 'Photographed' };
    case 'note':
    default:
      return { icon: '•', color: GARDEN_ACCENT, verb: 'Noted' };
  }
}

function formatRelativeTime(dateStr: string): string {
  const then = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingBottom: 120,
    gap: 24,
  },
  onboardingContent: {
    paddingBottom: 120,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
    letterSpacing: -0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GARDEN_DANGER,
  },
  greetingBlock: {
    paddingHorizontal: 24,
    gap: 4,
  },
  greetingHeadline: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  greetingDate: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  alertBanner: {
    marginHorizontal: 24,
    backgroundColor: 'rgba(255, 180, 171, 0.06)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  alertIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 180, 171, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: { flex: 1, gap: 2 },
  alertTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
  },
  alertSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  alertCta: {
    backgroundColor: GARDEN_ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  alertCtaText: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: '#0B1A04',
  },
  section: {
    gap: 12,
  },
  statHeaderRow: {
    paddingHorizontal: 24,
  },
  uppercaseLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_ACCENT,
  },
  statRow: {
    paddingHorizontal: 24,
    gap: 12,
  },
  statSlot: {
    width: 144,
  },
  quickActionGrid: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
  },
  quickActionItem: {
    flex: 1,
  },
  bioCardWrap: {
    paddingHorizontal: 24,
  },
  bioInner: {
    flexDirection: 'row',
    gap: 16,
  },
  bioImage: {
    width: 112,
    height: 168,
    borderRadius: 12,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  bioImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioBody: {
    flex: 1,
    gap: 4,
  },
  bioMiniLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  bioName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  bioSpecies: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  bioAccent: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    color: GARDEN_ACCENT,
    marginTop: 2,
  },
  bioStatRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  bioStatCell: {
    flex: 1,
    gap: 2,
  },
  bioStatValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  bioLinkWrap: {
    marginTop: 12,
  },
  bioLink: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    color: GARDEN_ACCENT,
  },
  timelineWrap: {
    paddingHorizontal: 24,
  },
  timelineEmpty: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  onboardingCard: {
    margin: 24,
    padding: spacing.lg,
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  onboardingStep: {
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
});
