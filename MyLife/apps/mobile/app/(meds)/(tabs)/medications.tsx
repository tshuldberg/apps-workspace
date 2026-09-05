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
import { Swipeable } from 'react-native-gesture-handler';
import {
  decrementPillCount,
  deleteMedication,
  getDaysRemaining,
  getInteractionsForMedication,
  getMedications,
  logDose,
  type Medication,
} from '@mylife/meds';
import {
  GlassCard,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  MaterialSymbol,
  SectionHeader,
  withAlpha,
} from '@mylife/meds/ui';
import {
  EmptyGlassState,
  FilterChip,
  MetricBadge,
  ScreenTitleBlock,
  SearchField,
  SectionStack,
  getPartOfDayLabel,
} from '../../../components/meds/phase1';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

type StatusFilter = 'all' | 'active' | 'as_needed' | 'paused' | 'archived';
type GroupMode = 'time' | 'condition' | 'alphabetical';

type MedicationRow = {
  daysRemaining: number | null;
  interactions: ReturnType<typeof getInteractionsForMedication>;
  medication: Medication;
};

function getMedicationStatus(medication: Medication): Exclude<StatusFilter, 'all'> {
  if (medication.endDate && medication.endDate <= new Date().toISOString()) {
    return 'archived';
  }
  if (!medication.isActive) {
    return 'paused';
  }
  if (medication.frequency === 'as_needed') {
    return 'as_needed';
  }
  return 'active';
}

function getMedicationScheduleLabel(medication: Medication) {
  if (medication.timeSlots.length > 0) {
    return medication.timeSlots.join(' · ');
  }
  return medication.frequency.replace(/_/g, ' ');
}

function getGroupLabel(medication: Medication, mode: GroupMode) {
  if (mode === 'alphabetical') {
    return medication.name.charAt(0).toUpperCase();
  }
  if (mode === 'condition') {
    return medication.notes?.split(/[.;]/)[0]?.trim()
      || medication.instructions?.split(/[.;]/)[0]?.trim()
      || medication.prescriber?.trim()
      || 'Unassigned';
  }
  const firstTime = medication.timeSlots[0];
  if (!firstTime) {
    return medication.frequency === 'as_needed' ? 'As Needed' : 'Unscheduled';
  }
  return getPartOfDayLabel(`2026-01-01T${firstTime}:00.000Z`);
}

function buildGroups(items: MedicationRow[], mode: GroupMode) {
  const grouped = new Map<string, MedicationRow[]>();
  for (const item of items) {
    const label = getGroupLabel(item.medication, mode);
    const list = grouped.get(label) ?? [];
    list.push(item);
    grouped.set(label, list);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([title, rows]) => ({
      title,
      rows: [...rows].sort((left, right) =>
        left.medication.name.localeCompare(right.medication.name),
      ),
    }));
}

function MedicationRowCard({
  item,
  onDelete,
  onOpen,
  onTake,
}: {
  item: MedicationRow;
  onDelete: () => void;
  onOpen: () => void;
  onTake: () => void;
}) {
  const status = getMedicationStatus(item.medication);
  const interactionWarning = item.interactions[0];

  return (
    <Swipeable
      renderLeftActions={() => (
        <View style={styles.leftActionWrap}>
          <Pressable onPress={onTake} style={styles.takeAction}>
            <MaterialSymbol color={MD_SURFACES.lowest} filled name="check_circle" size={16} />
            <Text style={styles.actionTextDark}>Take</Text>
          </Pressable>
        </View>
      )}
      renderRightActions={() => (
        <View style={styles.rightActionWrap}>
          <Pressable onPress={onDelete} style={styles.deleteAction}>
            <MaterialSymbol color={MD_TEXT} name="delete" size={16} />
            <Text style={styles.actionTextLight}>Delete</Text>
          </Pressable>
        </View>
      )}
    >
      <Pressable onPress={onOpen}>
        <GlassCard padding={16} style={styles.medCard}>
          <View style={styles.medIcon}>
            <MaterialSymbol color={MD_ACCENT_LIGHT} filled name="medication" size={20} />
          </View>
          <View style={styles.medCopy}>
            <View style={styles.medHeadingRow}>
              <Text style={styles.medName}>{item.medication.name}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: withAlpha(
                      status === 'archived' ? MD_TEXT_TERTIARY : MD_ACCENT_LIGHT,
                      0.16,
                    ),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: status === 'archived' ? MD_TEXT_TERTIARY : MD_ACCENT_LIGHT },
                  ]}
                >
                  {status.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
            <Text style={styles.medMeta}>
              {item.medication.dosage ?? 'Dose pending'} · {getMedicationScheduleLabel(item.medication)}
            </Text>
            <View style={styles.medMetaRow}>
              {item.daysRemaining != null && item.daysRemaining !== Number.POSITIVE_INFINITY ? (
                <Text style={styles.medChip}>
                  {item.daysRemaining}d left
                </Text>
              ) : null}
              {interactionWarning ? (
                <Text style={[styles.medChip, { color: '#FFB4AB' }]}>
                  {interactionWarning.severity.toUpperCase()} interaction
                </Text>
              ) : null}
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </Swipeable>
  );
}

export default function MedicationsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [groupMode, setGroupMode] = useState<GroupMode>('time');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const screenState = useMemo(() => {
    try {
      const medications = getMedications(db).map((medication) => ({
        medication,
        daysRemaining: getDaysRemaining(db, medication.id),
        interactions: getInteractionsForMedication(db, medication.id),
      }));
      return { error: null, medications };
    } catch (error) {
      console.error('MedicationsScreen load failed', error);
      return { error: 'Unable to load your medications.', medications: [] as MedicationRow[] };
    }
  }, [db, refreshKey]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return screenState.medications.filter((item) => {
      const status = getMedicationStatus(item.medication);
      const matchesStatus = statusFilter === 'all' ? true : status === statusFilter;
      const matchesQuery = normalizedQuery.length === 0
        ? true
        : `${item.medication.name} ${item.medication.dosage ?? ''} ${item.medication.notes ?? ''}`
            .toLowerCase()
            .includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [query, screenState.medications, statusFilter]);

  const groups = useMemo(() => buildGroups(filtered, groupMode), [filtered, groupMode]);

  const handleDelete = useCallback((medication: Medication) => {
    Alert.alert(
      'Delete medication',
      `Remove ${medication.name} from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMedication(db, medication.id);
            setRefreshKey((value) => value + 1);
          },
        },
      ],
    );
  }, [db]);

  const handleTakeNow = useCallback((medication: Medication) => {
    logDose(db, uuid(), {
      medicationId: medication.id,
      scheduledTime: new Date().toISOString(),
      actualTime: new Date().toISOString(),
      status: 'taken',
    });
    decrementPillCount(db, medication.id);
    setRefreshKey((value) => value + 1);
  }, [db]);

  if (screenState.error) {
    return (
      <View style={styles.screen}>
        <EmptyGlassState
          actionLabel="Retry"
          message={screenState.error}
          onPress={onRefresh}
          title="Medication list unavailable"
        />
      </View>
    );
  }

  const activeCount = screenState.medications.filter(
    (item) => getMedicationStatus(item.medication) === 'active',
  ).length;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[MD_ACCENT_LIGHT]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={MD_ACCENT_LIGHT}
          />
        }
      >
        <SectionStack>
          <ScreenTitleBlock
            subtitle="Search, group, and quick-log every medication in your regimen."
            title="Medications"
          />

          <View style={styles.metricsRow}>
            <MetricBadge label="Active" value={`${activeCount}`} />
            <MetricBadge label="Tracked" value={`${screenState.medications.length}`} />
            <MetricBadge label="Filters" tone={MD_CHROME_GOLD} value={statusFilter.replace(/_/g, ' ')} />
          </View>

          <SearchField
            onChangeText={setQuery}
            placeholder="Search prescriptions, notes, or strengths"
            value={query}
          />

          <View style={styles.chipRail}>
            {(['all', 'active', 'as_needed', 'paused', 'archived'] as StatusFilter[]).map((filter) => (
              <FilterChip
                key={filter}
                label={filter.replace(/_/g, ' ')}
                onPress={() => setStatusFilter(filter)}
                selected={statusFilter === filter}
              />
            ))}
          </View>

          <GlassCard padding={18} style={styles.groupCard}>
            <SectionHeader title="Group by" />
            <View style={styles.chipRail}>
              {(['time', 'condition', 'alphabetical'] as GroupMode[]).map((mode) => (
                <FilterChip
                  key={mode}
                  label={mode}
                  onPress={() => setGroupMode(mode)}
                  selected={groupMode === mode}
                />
              ))}
            </View>
          </GlassCard>

          {groups.length === 0 ? (
            <EmptyGlassState
              actionLabel="Add medication"
              message="No medications match the current search and filter combination."
              onPress={() => router.push('/(meds)/add-med')}
              title="Nothing in this view"
            />
          ) : (
            groups.map((group) => {
              const open = expanded[group.title] ?? true;

              return (
                <GlassCard key={group.title} padding={18} style={styles.groupCard}>
                  <Pressable
                    onPress={() => setExpanded((current) => ({
                      ...current,
                      [group.title]: !open,
                    }))}
                    style={styles.groupHeader}
                  >
                    <SectionHeader
                      action={<Text style={styles.groupCount}>{group.rows.length} meds</Text>}
                      title={group.title}
                    />
                  </Pressable>
                  {open ? (
                    <View style={styles.groupStack}>
                      {group.rows.map((item) => (
                        <MedicationRowCard
                          key={item.medication.id}
                          item={item}
                          onDelete={() => handleDelete(item.medication)}
                          onOpen={() => router.push({
                            pathname: '/(meds)/history',
                            params: { medicationId: item.medication.id },
                          })}
                          onTake={() => handleTakeNow(item.medication)}
                        />
                      ))}
                    </View>
                  ) : null}
                </GlassCard>
              );
            })
          )}
        </SectionStack>
      </ScrollView>

      <Pressable onPress={() => router.push('/(meds)/add-med')} style={styles.addFab}>
        <MaterialSymbol color={MD_SURFACES.lowest} filled name="add" size={24} />
        <Text style={styles.addFabText}>Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 160,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupCard: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  groupHeader: {
    gap: 8,
  },
  groupCount: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  groupStack: {
    gap: 10,
  },
  leftActionWrap: {
    justifyContent: 'center',
    marginBottom: 10,
    marginRight: 10,
  },
  rightActionWrap: {
    justifyContent: 'center',
    marginBottom: 10,
    marginLeft: 10,
  },
  takeAction: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: 90,
  },
  deleteAction: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: withAlpha('#FF453A', 0.9),
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: 96,
  },
  actionTextDark: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_SURFACES.lowest,
  },
  actionTextLight: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT,
  },
  medCard: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    flexDirection: 'row',
    gap: 14,
  },
  medIcon: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.14),
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  medCopy: {
    flex: 1,
    gap: 4,
  },
  medHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  medName: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    flex: 1,
    fontFamily: MD_FONTS.bold,
  },
  medMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  medMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  medChip: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_CHROME_GOLD,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  addFab: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 999,
    bottom: 110,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: 'absolute',
    right: 20,
    shadowColor: MD_ACCENT_LIGHT,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  addFabText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_SURFACES.lowest,
  },
});
