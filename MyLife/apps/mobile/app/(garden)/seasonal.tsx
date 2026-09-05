import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import {
  CalendarDays,
  CheckCircle2,
  Leaf,
  Sprout,
  Wheat,
} from 'lucide-react-native';
import {
  createSeasonalTask,
  getFrostConfig,
  getPendingSeasonalTasks,
  getPlantingCalendar,
  getPlants,
  getSeason,
  getSeasonalTasksForCategory,
  getSetting,
  inferCategory,
  lookupZone,
  GARDEN_ACCENT,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TERTIARY,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  SectionHeader,
  type Season,
} from '@mylife/garden';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type CalendarMode = 'planting' | 'seasonal';

type PlantingWindow = {
  crop: string;
  indoorMonth: number | null;
  outdoorMonth: number;
  harvestMonth: number;
  directSow: boolean;
  isUserPlant: boolean;
};

type SeasonalTemplate = {
  category: string;
  taskType: string;
  description: string;
  dueMonth: number | null;
};

type SeasonalCardData = {
  season: Season;
  label: string;
  months: string;
  tasks: SeasonalTemplate[];
};

type HistoryRow = {
  season: Season;
  total: number;
  completed: number;
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const SEASONS: Array<{ key: Season; label: string; months: string }> = [
  { key: 'spring', label: 'Spring', months: 'Mar - May' },
  { key: 'summer', label: 'Summer', months: 'Jun - Aug' },
  { key: 'fall', label: 'Fall', months: 'Sep - Nov' },
  { key: 'winter', label: 'Winter', months: 'Dec - Feb' },
];

const WINDOW_COLORS = {
  indoor: GARDEN_GOLD,
  outdoor: GARDEN_ACCENT,
  harvest: GARDEN_TERTIARY,
} as const;

const SEASON_TASK_ICONS: Record<Season, typeof Sprout> = {
  spring: Sprout,
  summer: Wheat,
  fall: Leaf,
  winter: CalendarDays,
};

function addWeeks(base: Date, weeks: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatTimingLabel(date: Date): string {
  const day = date.getDate();
  const prefix = day <= 10 ? 'Early' : day <= 20 ? 'Mid' : 'Late';
  return `${prefix} ${MONTHS[date.getMonth()]}`;
}

function formatTaskLabel(taskType: string): string {
  return taskType.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function seedId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function SeasonalScreen() {
  const db = useDatabase();
  const [mode, setMode] = useState<CalendarMode>('planting');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [tick, setTick] = useState(0);

  const currentSeason = useMemo(() => getSeason(new Date().getMonth()), []);
  const plants = useMemo(() => getPlants(db), [db, tick]);
  const pendingTasks = useMemo(() => getPendingSeasonalTasks(db), [db, tick]);
  const location = useMemo(() => getSetting(db, 'default_location') ?? 'Asheville, NC', [db, tick]);
  const frostConfig = useMemo(() => getFrostConfig(db), [db, tick]);
  const usdaZone = frostConfig?.usdaZone ?? '7a';
  const frostDates = useMemo(() => lookupZone(usdaZone) ?? lookupZone('7a'), [usdaZone]);

  const plantNames = useMemo(() => {
    const set = new Set<string>();
    for (const plant of plants) {
      set.add(normalizeKey(plant.name));
      set.add(normalizeKey(plant.species));
    }
    return set;
  }, [plants]);

  const plantingWindows = useMemo<PlantingWindow[]>(() => {
    const lastFrostDate = new Date();
    const firstFrostDate = new Date();
    const year = new Date().getFullYear();
    const lastFrost = frostDates?.avgLastFrost ?? '04-05';
    const firstFrost = frostDates?.avgFirstFrost ?? '10-25';
    const [lastMonth, lastDay] = lastFrost.split('-').map(Number);
    const [firstMonth, firstDay] = firstFrost.split('-').map(Number);
    lastFrostDate.setFullYear(year, lastMonth - 1, lastDay);
    firstFrostDate.setFullYear(year, firstMonth - 1, firstDay);

    return getPlantingCalendar().map((entry) => {
      const indoorDate =
        entry.indoorStartWeeksBefore != null
          ? addWeeks(lastFrostDate, -entry.indoorStartWeeksBefore)
          : null;
      const outdoorDate = addWeeks(lastFrostDate, entry.transplantWeeksAfter ?? 0);
      const harvestDate = addWeeks(firstFrostDate, -(entry.harvestWeeksBefore ?? 0));
      const cropKey = normalizeKey(entry.crop);
      return {
        crop: entry.crop,
        indoorMonth: indoorDate?.getMonth() ?? null,
        outdoorMonth: outdoorDate.getMonth(),
        harvestMonth: harvestDate.getMonth(),
        directSow: entry.directSow,
        isUserPlant: plantNames.has(cropKey),
      };
    });
  }, [frostDates, plantNames]);

  const selectedMonthWindows = useMemo(() => {
    const lastFrostDate = new Date();
    const firstFrostDate = new Date();
    const year = new Date().getFullYear();
    const [lastMonth, lastDay] = (frostDates?.avgLastFrost ?? '04-05').split('-').map(Number);
    const [firstMonth, firstDay] = (frostDates?.avgFirstFrost ?? '10-25').split('-').map(Number);
    lastFrostDate.setFullYear(year, lastMonth - 1, lastDay);
    firstFrostDate.setFullYear(year, firstMonth - 1, firstDay);

    const buckets = {
      indoor: [] as Array<{ crop: string; timing: string }>,
      outdoor: [] as Array<{ crop: string; timing: string; directSow: boolean }>,
      harvest: [] as Array<{ crop: string; timing: string }>,
    };

    for (const entry of getPlantingCalendar()) {
      if (entry.indoorStartWeeksBefore != null) {
        const indoorDate = addWeeks(lastFrostDate, -entry.indoorStartWeeksBefore);
        if (indoorDate.getMonth() === selectedMonth) {
          buckets.indoor.push({
            crop: entry.crop,
            timing: formatTimingLabel(indoorDate),
          });
        }
      }
        const outdoorDate = addWeeks(lastFrostDate, entry.transplantWeeksAfter ?? 0);
      if (outdoorDate.getMonth() === selectedMonth) {
        buckets.outdoor.push({
          crop: entry.crop,
          timing: formatTimingLabel(outdoorDate),
          directSow: entry.directSow,
        });
      }
      const harvestDate = addWeeks(firstFrostDate, -(entry.harvestWeeksBefore ?? 0));
      if (harvestDate.getMonth() === selectedMonth) {
        buckets.harvest.push({
          crop: entry.crop,
          timing: formatTimingLabel(harvestDate),
        });
      }
    }

    return buckets;
  }, [frostDates, selectedMonth]);

  const focusTasks = useMemo(() => {
    const items = [
      ...selectedMonthWindows.indoor.map((item) => ({
        title: `Sow ${item.crop}`,
        detail: item.timing,
        color: WINDOW_COLORS.indoor,
      })),
      ...selectedMonthWindows.outdoor.map((item) => ({
        title: item.crop,
        detail: item.directSow ? 'Direct sow' : item.timing,
        color: WINDOW_COLORS.outdoor,
      })),
      ...selectedMonthWindows.harvest.map((item) => ({
        title: `Harvest ${item.crop}`,
        detail: item.timing,
        color: WINDOW_COLORS.harvest,
      })),
    ];
    return items.slice(0, 3);
  }, [selectedMonthWindows]);

  const relevantCategories = useMemo(() => {
    const categories = new Set<string>();
    for (const plant of plants) {
      categories.add(inferCategory(plant.species));
    }
    if (categories.size === 0) {
      categories.add('vegetable');
      categories.add('herb');
      categories.add('flower');
    }
    return Array.from(categories);
  }, [plants]);

  const seasonalCards = useMemo<SeasonalCardData[]>(() => {
    return SEASONS.map((seasonRow) => {
      const map = new Map<string, SeasonalTemplate>();
      for (const category of relevantCategories) {
        const tasks = getSeasonalTasksForCategory(category, seasonRow.key);
        for (const task of tasks) {
          const key = `${task.taskType}-${task.description}`;
          if (!map.has(key)) {
            map.set(key, {
              category,
              taskType: task.taskType,
              description: task.description,
              dueMonth: task.dueMonth,
            });
          }
        }
      }
      return {
        season: seasonRow.key,
        label: seasonRow.label,
        months: seasonRow.months,
        tasks: Array.from(map.values()).slice(0, 4),
      };
    });
  }, [relevantCategories]);

  const currentSeasonCard =
    seasonalCards.find((card) => card.season === currentSeason) ?? seasonalCards[0];

  const history = useMemo<HistoryRow[]>(() => {
    const rows = db.query<Record<string, unknown>>(
      `SELECT season,
              COUNT(*) as total,
              SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed
         FROM gd_seasonal_tasks
        WHERE created_at >= ?
        GROUP BY season`,
      [`${new Date().getFullYear()}-01-01T00:00:00.000Z`],
    );
    const keyed = new Map<Season, HistoryRow>();
    for (const row of rows) {
      keyed.set(row.season as Season, {
        season: row.season as Season,
        total: Number(row.total ?? 0),
        completed: Number(row.completed ?? 0),
      });
    }
    return SEASONS.map((seasonRow) => keyed.get(seasonRow.key) ?? {
      season: seasonRow.key,
      total: 0,
      completed: 0,
    });
  }, [db, tick]);

  const handleAddSeasonTasks = (card: SeasonalCardData) => {
    if (card.tasks.length === 0) {
      Alert.alert('No Tasks', `${card.label} does not have recommendations yet.`);
      return;
    }
    const existing = new Set(
      pendingTasks
        .filter((task) => task.season === card.season)
        .map((task) => `${task.taskType}-${task.description ?? ''}`),
    );

    let created = 0;
    for (const task of card.tasks) {
      const key = `${task.taskType}-${task.description}`;
      if (existing.has(key)) continue;
      createSeasonalTask(db, seedId(card.season), {
        season: card.season,
        taskType: task.taskType,
        description: task.description,
        dueMonth: task.dueMonth,
      });
      created += 1;
    }

    if (created === 0) {
      Alert.alert('Already Added', `${card.label} tasks are already in your queue.`);
      return;
    }

    setTick((value) => value + 1);
    Alert.alert('Added to Tasks', `${created} ${card.label.toLowerCase()} tasks were queued.`);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <RNText style={styles.headerTitle}>Calendar</RNText>
        <RNText style={styles.headerSubtitle}>
          USDA {usdaZone.toUpperCase()} · {location}
        </RNText>
      </View>

      <SegmentedControl
        options={[
          { key: 'planting', label: 'Planting' },
          { key: 'seasonal', label: 'Seasonal Care' },
        ]}
        value={mode}
        onChange={(next) => setMode(next as CalendarMode)}
      />

      {mode === 'planting' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthStrip}
          >
            {MONTHS.map((month, index) => {
              const active = index === selectedMonth;
              return (
                <Pressable
                  key={month}
                  onPress={() => setSelectedMonth(index)}
                  style={[styles.monthButton, active && styles.monthButtonActive]}
                >
                  <RNText style={[styles.monthButtonText, active && styles.monthButtonTextActive]}>
                    {month}
                  </RNText>
                </Pressable>
              );
            })}
          </ScrollView>

          <GlassCard level={2} style={styles.focusCard}>
            <RNText style={styles.kicker}>Current Focus</RNText>
            <RNText style={styles.focusTitle}>What to do in {MONTHS[selectedMonth]}</RNText>
            <View style={styles.focusList}>
              {focusTasks.length === 0 ? (
                <View style={styles.focusTaskRow}>
                  <RNText style={styles.focusTaskTitle}>No priority windows</RNText>
                  <RNText style={styles.focusTaskMeta}>Use the grid below for the annual plan.</RNText>
                </View>
              ) : (
                focusTasks.map((task) => (
                  <View key={`${task.title}-${task.detail}`} style={styles.focusTaskRow}>
                    <View style={[styles.focusTaskDot, { backgroundColor: task.color }]} />
                    <View style={styles.focusTaskCopy}>
                      <RNText style={styles.focusTaskTitle}>{task.title}</RNText>
                      <RNText style={styles.focusTaskMeta}>{task.detail}</RNText>
                    </View>
                  </View>
                ))
              )}
            </View>
          </GlassCard>

          <SectionHeader label="Window Legend" title="Annual Planning Grid" />
          <View style={styles.legendRow}>
            <LegendPill label="Sow Indoors" color={WINDOW_COLORS.indoor} />
            <LegendPill label="Transplant Out" color={WINDOW_COLORS.outdoor} />
            <LegendPill label="Harvest Window" color={WINDOW_COLORS.harvest} />
          </View>

          <GlassCard level={1} style={styles.timelineCard}>
            <View style={styles.gridHeaderRow}>
              <RNText style={styles.gridHeaderCrop}>Plant Species</RNText>
              <View style={styles.gridMonthRow}>
                {MONTHS.map((month) => (
                  <RNText key={month} style={styles.gridMonthLabel}>
                    {month.slice(0, 1)}
                  </RNText>
                ))}
              </View>
            </View>
            {plantingWindows.map((window) => (
              <View
                key={window.crop}
                style={[
                  styles.gridRow,
                  window.isUserPlant && styles.gridRowUserPlant,
                ]}
              >
                <View style={styles.gridCropMeta}>
                  <RNText style={styles.gridCropName}>{window.crop}</RNText>
                  <RNText style={styles.gridCropSub}>
                    {window.isUserPlant ? 'In your garden' : 'Suggested crop'}
                  </RNText>
                </View>
                <View style={styles.gridMonthRow}>
                  {MONTHS.map((month, index) => {
                    const tint =
                      index === window.indoorMonth
                        ? WINDOW_COLORS.indoor
                        : index === window.outdoorMonth
                          ? WINDOW_COLORS.outdoor
                          : index === window.harvestMonth
                            ? WINDOW_COLORS.harvest
                            : 'transparent';
                    return (
                      <View
                        key={`${window.crop}-${month}`}
                        style={[
                          styles.gridCell,
                          index === selectedMonth && styles.gridCellSelected,
                          tint !== 'transparent' && { backgroundColor: tint },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </GlassCard>

          <SectionHeader label="Monthly Windows" title={`${MONTHS[selectedMonth]} breakdown`} />
          <View style={styles.windowStack}>
            <WindowCard
              title="Sow Indoors"
              color={WINDOW_COLORS.indoor}
              items={selectedMonthWindows.indoor}
            />
            <WindowCard
              title="Sow Outdoors"
              color={WINDOW_COLORS.outdoor}
              items={selectedMonthWindows.outdoor}
            />
            <WindowCard
              title="Harvest"
              color={WINDOW_COLORS.harvest}
              items={selectedMonthWindows.harvest}
            />
          </View>
        </>
      ) : (
        <>
          <GlassCard level={2} style={styles.currentSeasonCard}>
            <RNText style={styles.kicker}>This Week in {currentSeasonCard.label}</RNText>
            <RNText style={styles.focusTitle}>{currentSeasonCard.months}</RNText>
            <View style={styles.focusList}>
              {currentSeasonCard.tasks.slice(0, 3).map((task) => (
                <View key={`${task.taskType}-${task.description}`} style={styles.focusTaskRow}>
                  <View style={[styles.focusTaskDot, { backgroundColor: GARDEN_ACCENT }]} />
                  <View style={styles.focusTaskCopy}>
                    <RNText style={styles.focusTaskTitle}>{formatTaskLabel(task.taskType)}</RNText>
                    <RNText style={styles.focusTaskMeta}>
                      {task.description}
                      {task.dueMonth != null ? ` · ${MONTHS[task.dueMonth]}` : ''}
                    </RNText>
                  </View>
                </View>
              ))}
            </View>
          </GlassCard>

          <SectionHeader label="Season Cards" title="Care calendar" />
          <View style={styles.seasonCardStack}>
            {seasonalCards.map((card) => {
              const Icon = SEASON_TASK_ICONS[card.season];
              return (
                <GlassCard key={card.season} level={1} style={styles.seasonCard}>
                  <View style={styles.seasonHeaderRow}>
                    <View style={styles.seasonTitleGroup}>
                      <View style={styles.seasonIconWrap}>
                        <Icon size={18} color={GARDEN_ACCENT} strokeWidth={1.8} />
                      </View>
                      <View style={styles.seasonTitleCopy}>
                        <RNText style={styles.seasonTitle}>{card.label}</RNText>
                        <RNText style={styles.seasonMonths}>{card.months}</RNText>
                      </View>
                    </View>
                    <RNText style={styles.seasonStat}>{card.tasks.length} tasks</RNText>
                  </View>
                  <View style={styles.seasonTaskList}>
                    {card.tasks.map((task) => (
                      <View key={`${card.season}-${task.taskType}-${task.description}`} style={styles.seasonTaskRow}>
                        <CheckCircle2 size={16} color={GARDEN_GOLD} strokeWidth={1.8} />
                        <RNText style={styles.seasonTaskText}>
                          {task.description}
                          {task.dueMonth != null ? ` · ${MONTHS[task.dueMonth]}` : ''}
                        </RNText>
                      </View>
                    ))}
                  </View>
                  <GradientButton title="Add to Tasks" onPress={() => handleAddSeasonTasks(card)} />
                </GlassCard>
              );
            })}
          </View>

          <SectionHeader label="Historical Chart" title="Tasks completed this year" />
          <GlassCard level={1} style={styles.historyCard}>
            <View style={styles.historyBars}>
              {history.map((row) => {
                const total = Math.max(row.total, 1);
                const completedHeight = row.completed === 0 ? 8 : Math.max(20, (row.completed / total) * 120);
                const totalHeight = Math.max(20, (row.total / Math.max(...history.map((item) => item.total), 1)) * 120);
                return (
                  <View key={row.season} style={styles.historyColumn}>
                    <View style={styles.historyTrack}>
                      <View style={[styles.historyTotalBar, { height: totalHeight }]} />
                      <View style={[styles.historyCompletedBar, { height: completedHeight }]} />
                    </View>
                    <RNText style={styles.historyLabel}>
                      {row.season.slice(0, 3).toUpperCase()}
                    </RNText>
                    <RNText style={styles.historyMeta}>
                      {row.completed}/{row.total}
                    </RNText>
                  </View>
                );
              })}
            </View>
          </GlassCard>
        </>
      )}
    </ScrollView>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.segmentedWrap}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.segmentedButton, active && styles.segmentedButtonActive]}
          >
            <RNText style={[styles.segmentedText, active && styles.segmentedTextActive]}>
              {option.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

function LegendPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.legendPill}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <RNText style={styles.legendText}>{label}</RNText>
    </View>
  );
}

function WindowCard({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: Array<{ crop: string; timing: string }>;
}) {
  return (
    <GlassCard level={1} style={styles.windowCard}>
      <View style={styles.windowTitleRow}>
        <View style={[styles.windowTitleDot, { backgroundColor: color }]} />
        <RNText style={styles.windowTitle}>{title}</RNText>
      </View>
      {items.length === 0 ? (
        <RNText style={styles.windowEmpty}>No windows this month.</RNText>
      ) : (
        <View style={styles.windowChipWrap}>
          {items.map((item) => (
            <View key={`${item.crop}-${item.timing}`} style={styles.windowChip}>
              <RNText style={styles.windowChipTitle}>{item.crop}</RNText>
              <RNText style={styles.windowChipMeta}>{item.timing}</RNText>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.base,
  },
  content: {
    paddingTop: 104,
    paddingBottom: 140,
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  segmentedWrap: {
    flexDirection: 'row',
    backgroundColor: GARDEN_SURFACES.depth,
    borderRadius: 18,
    padding: 4,
    gap: 4,
  },
  segmentedButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentedButtonActive: {
    backgroundColor: 'rgba(132, 204, 22, 0.18)',
  },
  segmentedText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentedTextActive: {
    color: GARDEN_ACCENT,
    fontFamily: GARDEN_TYPOGRAPHY.labelUpper.fontFamily,
  },
  monthStrip: {
    gap: 8,
    paddingRight: 12,
  },
  monthButton: {
    minWidth: 54,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: GARDEN_SURFACES.depth,
    alignItems: 'center',
  },
  monthButtonActive: {
    backgroundColor: GARDEN_ACCENT,
  },
  monthButtonText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  monthButtonTextActive: {
    color: colors.background,
  },
  focusCard: {
    padding: 20,
    gap: 14,
  },
  kicker: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_GOLD,
  },
  focusTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    color: colors.text,
  },
  focusList: {
    gap: 10,
  },
  focusTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  focusTaskDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  focusTaskCopy: {
    flex: 1,
    gap: 2,
  },
  focusTaskTitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  focusTaskMeta: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: -4,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  timelineCard: {
    padding: 16,
    gap: 12,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridHeaderCrop: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    flex: 1,
    color: colors.textSecondary,
  },
  gridMonthRow: {
    flexDirection: 'row',
    gap: 4,
  },
  gridMonthLabel: {
    width: 18,
    textAlign: 'center',
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    color: colors.textTertiary,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  gridRowUserPlant: {
    backgroundColor: 'rgba(132, 204, 22, 0.04)',
    borderRadius: 14,
    paddingHorizontal: 10,
    marginHorizontal: -10,
  },
  gridCropMeta: {
    flex: 1,
    gap: 2,
  },
  gridCropName: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  gridCropSub: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    color: colors.textSecondary,
  },
  gridCell: {
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  gridCellSelected: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  windowStack: {
    gap: 12,
  },
  windowCard: {
    padding: 16,
    gap: 14,
  },
  windowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  windowTitleDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  windowTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  windowEmpty: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  windowChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  windowChip: {
    minWidth: '47%',
    borderRadius: 16,
    padding: 12,
    backgroundColor: GARDEN_SURFACES.depth,
    gap: 2,
  },
  windowChipTitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  windowChipMeta: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  currentSeasonCard: {
    padding: 20,
    gap: 14,
  },
  seasonCardStack: {
    gap: 12,
  },
  seasonCard: {
    padding: 18,
    gap: 16,
  },
  seasonHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  seasonTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  seasonIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  seasonTitleCopy: {
    flex: 1,
    gap: 2,
  },
  seasonTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    color: colors.text,
  },
  seasonMonths: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  seasonStat: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_GOLD,
  },
  seasonTaskList: {
    gap: 10,
  },
  seasonTaskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  seasonTaskText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    flex: 1,
    color: colors.textSecondary,
  },
  historyCard: {
    padding: 18,
  },
  historyBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 170,
  },
  historyColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  historyTrack: {
    width: '100%',
    minHeight: 124,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  historyTotalBar: {
    width: '70%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 184, 119, 0.2)',
    position: 'absolute',
    bottom: 0,
  },
  historyCompletedBar: {
    width: '70%',
    borderRadius: 999,
    backgroundColor: GARDEN_ACCENT,
    position: 'absolute',
    bottom: 0,
  },
  historyLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  historyMeta: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textTertiary,
  },
});
