import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  Droplet,
} from 'lucide-react-native';
import {
  getPlants,
  getWateringSchedule,
  waterPlant,
  type Plant,
  type WateringScheduleItem,
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_DANGER,
  GARDEN_SURFACES,
  GARDEN_TERTIARY,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  SectionHeader,
  StatCard,
  GardenTimelineEntry,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

interface UpcomingGroup {
  key: string;
  label: string;
  items: WateringScheduleItem[];
}

interface HistoryItem {
  plantId: string;
  plantName: string;
  lastWatered: string;
}

export default function WateringScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [watering, setWatering] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [skipOnRain, setSkipOnRain] = useState(false);

  const schedule: WateringScheduleItem[] = useMemo(
    () => getWateringSchedule(db),
    [db, tick],
  );
  const plants: Plant[] = useMemo(() => getPlants(db), [db, tick]);
  const plantById = useMemo(() => {
    const map = new Map<string, Plant>();
    for (const p of plants) map.set(p.id, p);
    return map;
  }, [plants]);

  const overduePlants = useMemo(
    () => schedule.filter((s) => s.isOverdue),
    [schedule],
  );

  const dueTodayPlants = useMemo(
    () =>
      schedule.filter((s) => {
        if (s.isOverdue) return false;
        if (s.nextWaterDate == null) return false;
        return s.nextWaterDate === todayIso();
      }),
    [schedule],
  );

  const upcomingGroups = useMemo<UpcomingGroup[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 7);

    const groups = new Map<string, UpcomingGroup>();
    for (const s of schedule) {
      if (s.isOverdue) continue;
      if (s.nextWaterDate == null) continue;
      const due = new Date(`${s.nextWaterDate}T00:00:00`);
      if (Number.isNaN(due.getTime())) continue;
      if (due <= today) continue;
      if (due > cutoff) continue;

      const key = s.nextWaterDate;
      if (!groups.has(key)) {
        groups.set(key, { key, label: dayLabel(due, today), items: [] });
      }
      groups.get(key)!.items.push(s);
    }
    return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [schedule]);

  const recentHistory = useMemo<HistoryItem[]>(() => {
    return schedule
      .filter((s): s is WateringScheduleItem & { lastWatered: string } => s.lastWatered != null)
      .map((s) => ({
        plantId: s.plantId,
        plantName: s.plantName,
        lastWatered: s.lastWatered as string,
      }))
      .sort((a, b) => b.lastWatered.localeCompare(a.lastWatered))
      .slice(0, 10);
  }, [schedule]);

  const lastWateredCount = useMemo(() => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    yest.setHours(0, 0, 0, 0);
    const tomorrow = new Date(yest);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return schedule.filter((s) => {
      if (s.lastWatered == null) return false;
      const t = new Date(s.lastWatered).getTime();
      return t >= yest.getTime() && t < tomorrow.getTime();
    }).length;
  }, [schedule]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleWater = useCallback(
    (plantId: string) => {
      try {
        waterPlant(db, plantId);
        refresh();
      } catch {
        Alert.alert('Error', "Couldn't save. Tap to retry.");
      }
    },
    [db, refresh],
  );

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

  const lastWateredSubtitle =
    lastWateredCount === 0
      ? 'No plants watered yesterday'
      : `${lastWateredCount} plant${lastWateredCount === 1 ? '' : 's'} watered yesterday`;

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Watering</Text>
        <Text style={styles.subtitle}>{lastWateredSubtitle}</Text>
      </View>

      {/* Overdue Banner */}
      {overduePlants.length > 0 && (
        <GlassCard level={2} style={styles.overdueCard}>
          <View style={styles.overdueHeader}>
            <View style={[styles.overdueIconWrap, { backgroundColor: 'rgba(255,180,171,0.12)' }]}>
              <Droplet size={20} color={GARDEN_DANGER} strokeWidth={2} />
            </View>
            <View style={styles.overdueHeadlineWrap}>
              <Text style={styles.overdueLabel}>NEEDS WATER NOW</Text>
              <Text style={styles.overdueHeadline}>
                {overduePlants.length} plant{overduePlants.length === 1 ? '' : 's'} overdue
              </Text>
            </View>
            <AlertTriangle size={18} color={GARDEN_DANGER} strokeWidth={2} />
          </View>

          <View style={styles.overdueList}>
            {overduePlants.map((item) => (
              <View key={item.plantId} style={styles.overdueRow}>
                <View style={styles.overdueRowLeft}>
                  <View style={styles.overdueDot} />
                  <View style={styles.overdueRowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.plantName}
                    </Text>
                    <Text style={styles.overdueMeta}>
                      {item.daysOverdue} day{item.daysOverdue === 1 ? '' : 's'} overdue
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleWater(item.plantId)}
                  style={styles.waterPill}
                  hitSlop={6}
                >
                  <Text style={styles.waterPillText}>Water</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.overdueCta}>
            <GradientButton
              title={watering ? 'Watering...' : 'Water All'}
              onPress={handleWaterAll}
            />
          </View>
        </GlassCard>
      )}

      {/* Due Today Section */}
      <View>
        <SectionHeader label="DUE TODAY" title="Today's Schedule" />
        {dueTodayPlants.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>Nothing scheduled for today.</Text>
          </View>
        ) : (
          <View style={styles.listGap}>
            {dueTodayPlants.map((item) => {
              const plant = plantById.get(item.plantId);
              const progress = computeProgress(item);
              return (
                <GlassCard key={item.plantId} level={2} style={styles.dueCard}>
                  <View style={styles.dueRow}>
                    <View style={styles.thumb}>
                      <Text style={styles.thumbIcon}>🌿</Text>
                    </View>
                    <View style={styles.dueInfo}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {item.plantName}
                      </Text>
                      {plant?.species ? (
                        <Text style={styles.rowSpecies} numberOfLines={1}>
                          {plant.species}
                        </Text>
                      ) : null}
                      <View style={styles.intervalRow}>
                        <Clock size={11} color={colors.textTertiary} strokeWidth={2} />
                        <Text style={styles.intervalText}>
                          Every {item.frequencyDays} day{item.frequencyDays === 1 ? '' : 's'}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleWater(item.plantId)}
                      style={[styles.waterPill, styles.waterPillSolid]}
                      hitSlop={6}
                    >
                      <Droplet size={12} color="#0B1A04" strokeWidth={2.5} />
                      <Text style={styles.waterPillSolidText}>Water</Text>
                    </Pressable>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progress * 100}%`, backgroundColor: GARDEN_ACCENT },
                      ]}
                    />
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}
      </View>

      {/* Upcoming Schedule */}
      <View>
        <SectionHeader label="UPCOMING" title="Next 7 Days" />
        {upcomingGroups.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>No watering scheduled this week.</Text>
          </View>
        ) : (
          <View style={styles.listGap}>
            {upcomingGroups.map((group) => (
              <GlassCard key={group.key} level={1} style={styles.upcomingCard}>
                <View style={styles.upcomingHeaderRow}>
                  <Calendar size={12} color={GARDEN_TERTIARY} strokeWidth={2} />
                  <Text style={styles.upcomingDayLabel}>{group.label}</Text>
                  <Text style={styles.upcomingCount}>
                    {group.items.length} plant{group.items.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.upcomingList}>
                  {group.items.map((item) => {
                    const plant = plantById.get(item.plantId);
                    return (
                      <View key={item.plantId} style={styles.upcomingRow}>
                        <View style={styles.upcomingRowText}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {item.plantName}
                          </Text>
                          {plant?.species ? (
                            <Text style={styles.rowSpecies} numberOfLines={1}>
                              {plant.species}
                            </Text>
                          ) : null}
                        </View>
                        {plant?.zone ? (
                          <View style={styles.zoneChip}>
                            <Text style={styles.zoneChipText}>{plant.zone}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </GlassCard>
            ))}
          </View>
        )}
      </View>

      {/* Per-Plant Stats Grid */}
      {schedule.length > 0 && (
        <View>
          <SectionHeader label="HYDRATION PATTERNS" title="Plant Stats" />
          <View style={styles.statsGrid}>
            {schedule.slice(0, 6).map((item) => {
              const plant = plantById.get(item.plantId);
              const totalWaterings = estimateTotalWaterings(plant, item);
              const lastLabel = item.lastWatered ? formatRelative(item.lastWatered) : 'Never';
              return (
                <View key={item.plantId} style={styles.statCardWrap}>
                  <View style={styles.statCardInner}>
                    <View style={styles.statCardHeader}>
                      <BarChart3 size={12} color={GARDEN_ACCENT} strokeWidth={2} />
                      <Text style={styles.statCardName} numberOfLines={1}>
                        {item.plantName}
                      </Text>
                    </View>
                    <View style={styles.statCardRow}>
                      <Text style={styles.statCardLabel}>AVG INTERVAL</Text>
                      <Text style={styles.statCardValue}>
                        {item.frequencyDays}d
                      </Text>
                    </View>
                    <View style={styles.statCardRow}>
                      <Text style={styles.statCardLabel}>LAST</Text>
                      <Text style={styles.statCardValue}>{lastLabel}</Text>
                    </View>
                    <View style={styles.statCardRow}>
                      <Text style={styles.statCardLabel}>LIFETIME</Text>
                      <Text style={styles.statCardValue}>{totalWaterings}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Recent Waterings Timeline */}
      {recentHistory.length > 0 && (
        <View>
          <SectionHeader label="RECENT WATERINGS" title="History" />
          <GlassCard level={1} style={styles.historyCard}>
            {recentHistory.map((entry, idx) => (
              <GardenTimelineEntry
                key={`${entry.plantId}-${idx}`}
                icon="💧"
                iconColor={GARDEN_TERTIARY}
                title={entry.plantName}
                subtitle="Watered"
                time={formatRelative(entry.lastWatered)}
                isLast={idx === recentHistory.length - 1}
              />
            ))}
          </GlassCard>
        </View>
      )}

      {/* Settings Row */}
      <GlassCard level={2} style={styles.settingsCard}>
        <View style={styles.settingsRow}>
          <View style={styles.settingsText}>
            <Text style={styles.settingsTitle}>Reminder Notifications</Text>
            <Text style={styles.settingsHint}>
              Get notified when plants need water
            </Text>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={setRemindersEnabled}
            trackColor={{ false: GARDEN_SURFACES.highest, true: GARDEN_ACCENT }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.settingsDivider} />
        <View style={styles.settingsRow}>
          <View style={styles.settingsText}>
            <Text style={styles.settingsTitle}>Skip on Rain Days</Text>
            <Text style={styles.settingsHint}>
              Pause watering when rain is forecast (requires weather data)
            </Text>
          </View>
          <Switch
            value={skipOnRain}
            onValueChange={setSkipOnRain}
            trackColor={{ false: GARDEN_SURFACES.highest, true: GARDEN_ACCENT }}
            thumbColor="#FFFFFF"
          />
        </View>
      </GlassCard>
    </ScrollView>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayLabel(due: Date, today: Date): string {
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) {
    return due.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function computeProgress(item: WateringScheduleItem): number {
  if (item.lastWatered == null || item.frequencyDays <= 0) return 1;
  const last = new Date(item.lastWatered).getTime();
  const elapsed = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return Math.min(1, Math.max(0, elapsed / item.frequencyDays));
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours <= 0) return 'Just now';
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function estimateTotalWaterings(
  plant: Plant | undefined,
  item: WateringScheduleItem,
): number {
  if (plant?.acquiredDate == null || item.frequencyDays <= 0) {
    return item.lastWatered ? 1 : 0;
  }
  const acquired = new Date(plant.acquiredDate).getTime();
  if (Number.isNaN(acquired)) return item.lastWatered ? 1 : 0;
  const days = Math.max(0, (Date.now() - acquired) / (1000 * 60 * 60 * 24));
  return Math.max(item.lastWatered ? 1 : 0, Math.floor(days / item.frequencyDays));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl + 60,
    gap: spacing.lg,
  },
  header: { gap: spacing.xs, paddingHorizontal: 4, paddingTop: spacing.lg },
  title: {
    fontFamily: GARDEN_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: GARDEN_TYPOGRAPHY.displayLg.fontSize,
    letterSpacing: GARDEN_TYPOGRAPHY.displayLg.letterSpacing,
    color: colors.text,
  },
  subtitle: {
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Overdue
  overdueCard: {
    gap: spacing.md,
    backgroundColor: 'rgba(255,180,171,0.06)',
  },
  overdueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overdueIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueHeadlineWrap: { flex: 1, gap: 2 },
  overdueLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: GARDEN_DANGER,
  },
  overdueHeadline: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 17,
    color: colors.text,
  },
  overdueList: { gap: 8 },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
  },
  overdueRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overdueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GARDEN_DANGER,
  },
  overdueRowText: { flex: 1 },
  overdueMeta: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: GARDEN_DANGER,
    marginTop: 2,
  },
  overdueCta: {
    alignItems: 'stretch',
  },
  // Due Today
  listGap: { gap: spacing.sm },
  dueCard: { gap: 10 },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: GARDEN_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: { fontSize: 22 },
  dueInfo: { flex: 1, gap: 2 },
  rowName: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 15,
    color: colors.text,
  },
  rowSpecies: {
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  intervalText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textTertiary,
  },
  waterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(132,204,22,0.12)',
    minHeight: 32,
  },
  waterPillText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: GARDEN_ACCENT_LIGHT,
  },
  waterPillSolid: {
    backgroundColor: GARDEN_ACCENT,
  },
  waterPillSolidText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: '#0B1A04',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  // Upcoming
  upcomingCard: { gap: 10 },
  upcomingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upcomingDayLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: GARDEN_TERTIARY,
    flex: 1,
  },
  upcomingCount: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textTertiary,
  },
  upcomingList: { gap: 8 },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 8,
  },
  upcomingRowText: { flex: 1, gap: 2 },
  zoneChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  zoneChipText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textSecondary,
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCardWrap: {
    width: '48%',
  },
  statCardInner: {
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statCardName: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  statCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textTertiary,
  },
  statCardValue: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 12,
    color: GARDEN_ACCENT_LIGHT,
  },
  // History
  historyCard: { gap: 0 },
  // Settings
  settingsCard: { gap: 0 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 12,
  },
  settingsText: { flex: 1, gap: 2 },
  settingsTitle: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 14,
    color: colors.text,
  },
  settingsHint: {
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 4,
  },
  // Empty
  emptyBlock: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
