import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { Swipeable } from 'react-native-gesture-handler';
import {
  AreaChip,
  GlassCard,
  HabitRow,
  MaterialSymbol,
  SectionHeader,
  createArea,
  deleteArea,
  getAreas,
  getHabits,
  getMeasurableStreaks,
  getNegativeStreaks,
  getStreaks,
  reorderAreas,
  updateArea,
  updateHabit,
  type Area,
  type Habit,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  withAlpha,
} from '@mylife/habits';
import { AreaManagerSheet } from '../../../components/habits/AreaManagerSheet';
import {
  EmptyGlassState,
  FilterChip,
  HABITS_AREA_PRESETS,
  SearchField,
  resolveAreaColor,
  resolveAreaIcon,
} from '../../../components/habits/phase1-shared';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

type StatusFilter = 'all' | 'active' | 'archived' | 'paused' | 'needs_attention';
type SortMode = 'custom' | 'alphabetical' | 'frequency' | 'streak';

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
  { key: 'paused', label: 'Paused' },
  { key: 'needs_attention', label: 'Need Attention' },
];

const SORT_MODES: Array<{ key: SortMode; label: string }> = [
  { key: 'custom', label: 'Custom' },
  { key: 'alphabetical', label: 'Alphabetical' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'streak', label: 'Streak' },
];

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function getFrequencyRank(habit: Habit) {
  switch (habit.frequency) {
    case 'daily':
      return 0;
    case 'specific_days':
      return 1;
    case 'weekly':
      return 2;
    case 'monthly':
      return 3;
    default:
      return 4;
  }
}

function getHabitStreakValue(
  db: ReturnType<typeof useDatabase>,
  habit: Habit,
) {
  if (habit.habitType === 'measurable') {
    return getMeasurableStreaks(db, habit.id, habit.gracePeriod).currentStreak;
  }
  if (habit.habitType === 'negative') {
    return getNegativeStreaks(db, habit.id).daysSinceLastSlip;
  }
  return getStreaks(db, habit.id).currentStreak;
}

function isPausedHabit(habit: Habit, todayKey: string) {
  return !habit.isArchived && (
    (habit.startDate != null && habit.startDate > todayKey) ||
    (habit.endDate != null && habit.endDate < todayKey)
  );
}

function HabitSwipeRow({
  habit,
  area,
  streak,
  onPress,
  onLongPress,
  onArchive,
}: {
  habit: Habit;
  area: Area | null;
  streak: number;
  onPress: () => void;
  onLongPress?: () => void;
  onArchive: () => void;
}) {
  return (
    <Swipeable
      renderLeftActions={() => (
        <View style={styles.leftActionWrap}>
          <Pressable onPress={onPress} style={styles.editAction}>
            <MaterialSymbol color={HB_SURFACES.lowest} name="edit" size={16} />
            <Text style={styles.actionTextDark}>Edit</Text>
          </Pressable>
        </View>
      )}
      renderRightActions={() => (
        <View style={styles.rightActionWrap}>
          <Pressable onPress={onArchive} style={styles.archiveAction}>
            <MaterialSymbol color={HB_TEXT} name={habit.isArchived ? 'restore' : 'archive'} size={16} />
            <Text style={styles.actionTextLight}>{habit.isArchived ? 'Restore' : 'Archive'}</Text>
          </Pressable>
        </View>
      )}
    >
      <HabitRow
        area={area ? { name: area.name, color: resolveAreaColor(area.name, area.color), icon: resolveAreaIcon(area.name, area.icon) } : null}
        checked={false}
        habit={habit}
        onLongPress={onLongPress}
        onPress={onPress}
        showArea={area != null}
        showStreak
        streakCount={streak}
      />
    </Swipeable>
  );
}

export default function HabitsListScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [sortMode, setSortMode] = useState<SortMode>('custom');
  const [areaEditorVisible, setAreaEditorVisible] = useState(false);

  const todayKey = toDateKey(new Date());

  const screenState = useMemo(() => {
    try {
      const allHabits = getHabits(db);
      const areas = getAreas(db);
      const areasById = new Map(areas.map((area) => [area.id, area]));
      const streaks = new Map(allHabits.map((habit) => [habit.id, getHabitStreakValue(db, habit)]));
      const normalizedQuery = normalize(query);

      const matchingArea = (habit: Habit) => {
        if (selectedAreaId === 'all') return true;
        return habit.areaId === selectedAreaId;
      };

      const matchesStatus = (habit: Habit) => {
        switch (statusFilter) {
          case 'active':
            return !habit.isArchived && !isPausedHabit(habit, todayKey);
          case 'archived':
            return habit.isArchived;
          case 'paused':
            return isPausedHabit(habit, todayKey);
          case 'needs_attention':
            return !habit.isArchived && streaks.get(habit.id) === 0;
          default:
            return true;
        }
      };

      const matchesQuery = (habit: Habit) => {
        if (!normalizedQuery) return true;
        return normalize(habit.name).includes(normalizedQuery);
      };

      const filtered = allHabits
        .filter(matchingArea)
        .filter(matchesStatus)
        .filter(matchesQuery);

      const sorted = [...filtered].sort((left, right) => {
        if (sortMode === 'alphabetical') {
          return left.name.localeCompare(right.name);
        }
        if (sortMode === 'frequency') {
          return getFrequencyRank(left) - getFrequencyRank(right) || left.name.localeCompare(right.name);
        }
        if (sortMode === 'streak') {
          return (streaks.get(right.id) ?? 0) - (streaks.get(left.id) ?? 0) || left.name.localeCompare(right.name);
        }
        return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
      });

      const sectionMap = new Map<string, Habit[]>();
      for (const habit of sorted) {
        const area = habit.areaId ? areasById.get(habit.areaId) : null;
        const key = area?.name ?? 'Other';
        const current = sectionMap.get(key) ?? [];
        current.push(habit);
        sectionMap.set(key, current);
      }

      const sections = Array.from(sectionMap.entries()).map(([title, habits]) => {
        const area = habits[0]?.areaId ? areasById.get(habits[0].areaId!) ?? null : null;
        return {
          title,
          area,
          habits,
        };
      });

      const areaRail = areas.length > 0
        ? areas
        : HABITS_AREA_PRESETS.map((preset, index) => ({
          id: `preset-${preset.key}`,
          name: preset.name,
          icon: preset.icon,
          color: preset.color,
          sortOrder: index,
          createdAt: todayKey,
        }));

      return {
        error: null as string | null,
        allHabits,
        areas,
        areasById,
        areaRail,
        filtered: sorted,
        sections,
        streaks,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not load habits.',
        allHabits: [] as Habit[],
        areas: [] as Area[],
        areasById: new Map<string, Area>(),
        areaRail: [] as Area[],
        filtered: [] as Habit[],
        sections: [] as Array<{ title: string; area: Area | null; habits: Habit[] }>,
        streaks: new Map<string, number>(),
      };
    }
  }, [db, query, selectedAreaId, sortMode, statusFilter, todayKey, refreshKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 160);
  }, []);

  const handleArchiveToggle = useCallback((habit: Habit) => {
    Alert.alert(
      habit.isArchived ? 'Restore habit?' : 'Archive habit?',
      habit.isArchived
        ? `${habit.name} will return to your active ritual list.`
        : `${habit.name} will move out of the active list, but its history stays intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: habit.isArchived ? 'Restore' : 'Archive',
          onPress: () => {
            updateHabit(db, habit.id, { isArchived: !habit.isArchived });
            setRefreshKey((value) => value + 1);
          },
        },
      ],
    );
  }, [db]);

  const handleDragEnd = useCallback((data: Habit[]) => {
    const activeOrdered = screenState.allHabits
      .filter((habit) => !habit.isArchived)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    const positions = activeOrdered
      .map((habit, index) => (data.some((item) => item.id === habit.id) ? index : -1))
      .filter((index) => index >= 0);

    if (positions.length !== data.length) {
      return;
    }

    const reordered = [...activeOrdered];
    positions.forEach((position, index) => {
      reordered[position] = data[index];
    });

    reordered.forEach((habit, index) => {
      updateHabit(db, habit.id, { sortOrder: index });
    });
    setRefreshKey((value) => value + 1);
  }, [db, screenState.allHabits]);

  const moveArea = useCallback((areaId: string, direction: 'up' | 'down') => {
    const orderedIds = screenState.areas.map((area) => area.id);
    const currentIndex = orderedIds.indexOf(areaId);
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) return;
    const swapped = [...orderedIds];
    const [item] = swapped.splice(currentIndex, 1);
    swapped.splice(nextIndex, 0, item);
    reorderAreas(db, swapped);
    setRefreshKey((value) => value + 1);
  }, [db, screenState.areas]);

  if (screenState.error) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyGlassState
            title="Habits are unavailable"
            message={screenState.error}
            actionLabel="Refresh"
            onPress={onRefresh}
          />
        </ScrollView>
      </View>
    );
  }

  const useDragList = selectedAreaId !== 'all' && sortMode === 'custom' && statusFilter !== 'archived';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={HB_ACCENT_LIGHT} />}
      >
        <GlassCard level={1} contentStyle={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroEyebrow}>Habit sanctuary</Text>
              <Text style={styles.heroTitle}>Habits</Text>
              <Text style={styles.heroSubtitle}>
                Shape your ritual stack, tune the order, and keep each area of life in motion.
              </Text>
            </View>
            <Pressable onPress={() => setAreaEditorVisible(true)} style={styles.heroIconWrap}>
              <MaterialSymbol color={HB_ACCENT_LIGHT} name="tune" size={22} />
            </Pressable>
          </View>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{screenState.filtered.length}</Text>
              <Text style={styles.heroStatLabel}>Visible</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{screenState.allHabits.filter((habit) => !habit.isArchived).length}</Text>
              <Text style={styles.heroStatLabel}>Active</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{screenState.areas.length}</Text>
              <Text style={styles.heroStatLabel}>Areas</Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.sectionBlock}>
          <SectionHeader title="Area filter" action={{ label: 'Edit Areas', onPress: () => setAreaEditorVisible(true) }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaRail}>
            <AreaChip
              area={{ name: 'All', color: HB_ACCENT, icon: 'grid_view' }}
              onPress={() => setSelectedAreaId('all')}
              selected={selectedAreaId === 'all'}
            />
            {screenState.areaRail.map((area) => (
              <AreaChip
                key={area.id}
                area={{
                  name: area.name,
                  color: resolveAreaColor(area.name, area.color),
                  icon: resolveAreaIcon(area.name, area.icon),
                }}
                onPress={() => setSelectedAreaId(area.id)}
                selected={selectedAreaId === area.id}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader title="Status" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
            {STATUS_FILTERS.map((filter) => (
              <FilterChip
                key={filter.key}
                label={filter.label}
                onPress={() => setStatusFilter(filter.key)}
                selected={statusFilter === filter.key}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader title="Sort" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
            {SORT_MODES.map((mode) => (
              <FilterChip
                key={mode.key}
                label={mode.label}
                onPress={() => setSortMode(mode.key)}
                selected={sortMode === mode.key}
              />
            ))}
          </ScrollView>
        </View>

        <SearchField
          onChangeText={setQuery}
          placeholder="Search habit name"
          value={query}
        />

        {screenState.filtered.length === 0 ? (
          <EmptyGlassState
            title="No habits match this view"
            message="Try a different area, loosen the filters, or add a new ritual."
            actionLabel="Add habit"
            onPress={() => router.push('/(habits)/add-habit')}
          />
        ) : null}

        {useDragList ? (
          <GlassCard level={1} contentStyle={styles.listCard}>
            <View style={styles.listHeaderRow}>
              <SectionHeader title="Custom order" />
              <Text style={styles.dragHint}>Long-press a row to reorder</Text>
            </View>
            <DraggableFlatList
              activationDistance={10}
              containerStyle={styles.dragList}
              data={screenState.filtered}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => handleDragEnd(data)}
              renderItem={({ item, drag }: RenderItemParams<Habit>) => (
                <HabitSwipeRow
                  area={item.areaId ? screenState.areasById.get(item.areaId) ?? null : null}
                  habit={item}
                  onArchive={() => handleArchiveToggle(item)}
                  onLongPress={drag}
                  onPress={() => router.push(`/(habits)/${item.id}`)}
                  streak={screenState.streaks.get(item.id) ?? 0}
                />
              )}
              scrollEnabled={false}
            />
          </GlassCard>
        ) : null}

        {!useDragList && selectedAreaId === 'all' ? (
          <View style={styles.groupList}>
            {screenState.sections.map((section) => (
              <GlassCard key={section.title} level={1} contentStyle={styles.groupCard}>
                <View style={styles.groupTitleRow}>
                  <SectionHeader title={section.title} />
                  <Text style={[styles.groupCount, { color: resolveAreaColor(section.area?.name ?? section.title, section.area?.color) }]}>
                    {section.habits.length}
                  </Text>
                </View>
                <View style={styles.groupHabitList}>
                  {section.habits.map((habit) => (
                    <HabitSwipeRow
                      key={habit.id}
                      area={habit.areaId ? screenState.areasById.get(habit.areaId) ?? null : null}
                      habit={habit}
                      onArchive={() => handleArchiveToggle(habit)}
                      onPress={() => router.push(`/(habits)/${habit.id}`)}
                      streak={screenState.streaks.get(habit.id) ?? 0}
                    />
                  ))}
                </View>
              </GlassCard>
            ))}
          </View>
        ) : null}

        {!useDragList && selectedAreaId !== 'all' ? (
          <GlassCard level={1} contentStyle={styles.groupCard}>
            <View style={styles.groupTitleRow}>
              <SectionHeader title="Filtered habits" />
              <Text style={styles.groupCount}>{screenState.filtered.length}</Text>
            </View>
            <View style={styles.groupHabitList}>
              {screenState.filtered.map((habit) => (
                <HabitSwipeRow
                  key={habit.id}
                  area={habit.areaId ? screenState.areasById.get(habit.areaId) ?? null : null}
                  habit={habit}
                  onArchive={() => handleArchiveToggle(habit)}
                  onPress={() => router.push(`/(habits)/${habit.id}`)}
                  streak={screenState.streaks.get(habit.id) ?? 0}
                />
              ))}
            </View>
          </GlassCard>
        ) : null}
      </ScrollView>

      <Pressable onPress={() => router.push('/(habits)/add-habit')} style={styles.fabWrap}>
        <View style={styles.fab}>
          <MaterialSymbol color={HB_TEXT} name="add" size={26} />
        </View>
      </Pressable>

      <AreaManagerSheet
        areas={screenState.areas}
        onAddArea={(name, color) => {
          createArea(db, uuid(), { name, color, icon: resolveAreaIcon(name) });
          setRefreshKey((value) => value + 1);
        }}
        onClose={() => setAreaEditorVisible(false)}
        onDeleteArea={(areaId) => {
          deleteArea(db, areaId);
          if (selectedAreaId === areaId) {
            setSelectedAreaId('all');
          }
          setRefreshKey((value) => value + 1);
        }}
        onMoveArea={moveArea}
        onRenameArea={(areaId, name, color) => {
          updateArea(db, areaId, { name, color, icon: resolveAreaIcon(name) });
          setRefreshKey((value) => value + 1);
        }}
        visible={areaEditorVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 152,
    gap: 16,
  },
  heroCard: {
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroEyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
    fontSize: 10,
    lineHeight: 12,
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 34,
    lineHeight: 38,
    marginTop: 8,
  },
  heroSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    marginTop: 8,
    maxWidth: 280,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT, 0.14),
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStat: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: HB_SURFACES.low,
    gap: 4,
  },
  heroStatValue: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 22,
    lineHeight: 26,
  },
  heroStatLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 11,
    lineHeight: 15,
  },
  sectionBlock: {
    gap: 10,
  },
  areaRail: {
    gap: 10,
    paddingRight: 8,
  },
  filterRail: {
    gap: 10,
    paddingRight: 8,
  },
  listCard: {
    gap: 14,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dragHint: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
  dragList: {
    gap: 10,
  },
  groupList: {
    gap: 16,
  },
  groupCard: {
    gap: 12,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  groupCount: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_ACCENT_LIGHT,
    fontSize: 16,
    lineHeight: 20,
  },
  groupHabitList: {
    gap: 10,
  },
  leftActionWrap: {
    justifyContent: 'center',
    marginRight: 10,
  },
  rightActionWrap: {
    justifyContent: 'center',
    marginLeft: 10,
  },
  editAction: {
    width: 94,
    borderRadius: 16,
    backgroundColor: HB_ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  archiveAction: {
    width: 104,
    borderRadius: 16,
    backgroundColor: withAlpha('#FFB877', 0.28),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  actionTextDark: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_SURFACES.lowest,
    fontSize: 10,
    lineHeight: 12,
  },
  actionTextLight: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT,
    fontSize: 10,
    lineHeight: 12,
  },
  fabWrap: {
    position: 'absolute',
    right: 20,
    bottom: 30,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HB_ACCENT,
    shadowColor: HB_ACCENT,
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
});
