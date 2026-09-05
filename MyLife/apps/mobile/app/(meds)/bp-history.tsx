import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';
import {
  classifyBP,
  deleteBPReading,
  getBPReadings,
  updateBPReading,
  validateBP,
  type BPArm,
  type BPContext,
  type BPPosition,
  type BPReading,
} from '@mylife/meds';
import { EmptyState, ErrorState } from '@mylife/ui';
import {
  BPClassification,
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_BP_STATUS,
  MD_CARD_RADIUS,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import {
  BP_CATEGORY_COLORS,
  BP_CATEGORY_LABELS,
  BP_FILTER_OPTIONS,
  BP_PERIOD_OPTIONS,
  filterBPReadingsForFilter,
  filterBPReadingsForPeriod,
  formatBPDateTime,
  getBPDistribution,
  getBPSummaryStats,
  groupBPReadingsByDay,
  type BPFilterKey,
  type BPPeriodKey,
} from '../../lib/meds/phase3';
import { useDatabase } from '../../components/DatabaseProvider';

const ARMS: Array<{ value: BPArm; label: string }> = [
  { value: 'left', label: 'Left Arm' },
  { value: 'right', label: 'Right Arm' },
];

const POSITIONS: Array<{ value: BPPosition; label: string }> = [
  { value: 'sitting', label: 'Sitting' },
  { value: 'standing', label: 'Standing' },
  { value: 'lying', label: 'Lying' },
];

const CONTEXTS: Array<{ value: BPContext; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'after_medication', label: 'After Med' },
  { value: 'after_exercise', label: 'After Exercise' },
  { value: 'routine', label: 'Routine' },
];

interface EditorDraft {
  id: string;
  measuredAt: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  arm: BPArm | null;
  position: BPPosition | null;
  context: BPContext | null;
  notes: string;
}

function toEditorDraft(reading: BPReading): EditorDraft {
  return {
    id: reading.id,
    measuredAt: reading.measuredAt,
    systolic: String(reading.systolic),
    diastolic: String(reading.diastolic),
    pulse: reading.pulse != null ? String(reading.pulse) : '',
    arm: reading.arm,
    position: reading.position,
    context: reading.context,
    notes: reading.notes ?? '',
  };
}

function ChoicePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choicePill, selected && styles.choicePillActive]}
    >
      <Text style={[styles.choicePillText, selected && styles.choicePillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryCard({
  label,
  value,
  supporting,
}: {
  label: string;
  value: string;
  supporting?: string;
}) {
  return (
    <GlassCard style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      {supporting ? <Text style={styles.summarySupporting}>{supporting}</Text> : null}
    </GlassCard>
  );
}

function DistributionDonut({ readings }: { readings: BPReading[] }) {
  const distribution = getBPDistribution(readings);
  const total = distribution.reduce((sum, slice) => sum + slice.count, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.distributionBlock}>
      <View style={styles.donutWrap}>
        <Svg height={118} viewBox="0 0 118 118" width={118}>
          <Circle
            cx={59}
            cy={59}
            fill="none"
            r={radius}
            stroke={withAlpha(MD_TEXT, 0.08)}
            strokeWidth={10}
          />
          {distribution.map((slice) => {
            if (slice.count === 0 || total === 0) {
              return null;
            }

            const dash = (slice.count / total) * circumference;
            const segment = (
              <Circle
                key={slice.category}
                cx={59}
                cy={59}
                fill="none"
                originX={59}
                originY={59}
                r={radius}
                rotation={-90}
                stroke={slice.color}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                strokeWidth={10}
              />
            );

            offset += dash;
            return segment;
          })}
        </Svg>
        <View style={styles.donutCenter}>
          <Text style={styles.donutValue}>{total}</Text>
          <Text style={styles.donutLabel}>readings</Text>
        </View>
      </View>

      <View style={styles.distributionLegend}>
        {distribution.map((slice) => (
          <View key={slice.category} style={styles.distributionRow}>
            <View style={styles.distributionRowLeft}>
              <View style={[styles.distributionDot, { backgroundColor: slice.color }]} />
              <Text style={styles.distributionLabel}>{slice.label}</Text>
            </View>
            <Text style={styles.distributionValue}>
              {slice.percentage}%{slice.count ? ` · ${slice.count}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function HistoryEditor({
  draft,
  onChange,
  onClose,
  onDelete,
  onSave,
}: {
  draft: EditorDraft;
  onChange: (draft: EditorDraft) => void;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const sys = Number.parseInt(draft.systolic, 10);
  const dia = Number.parseInt(draft.diastolic, 10);
  const hasValues = Number.isFinite(sys) && Number.isFinite(dia) && sys > 0 && dia > 0;
  const category = hasValues ? classifyBP(sys, dia) : null;

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFillObject} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>Reading Editor</Text>
              <Text style={styles.modalTitle}>Update entry</Text>
              <Text style={styles.modalSubtitle}>{formatBPDateTime(draft.measuredAt)}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <MaterialSymbol color={MD_TEXT_SECONDARY} name="close" size={20} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <GlassCard style={styles.editorCard}>
              <View style={styles.editorReadingRow}>
                <View style={styles.editorReadingBlock}>
                  <Text style={styles.editorReadingLabel}>Systolic</Text>
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={(value) => onChange({ ...draft, systolic: value })}
                    placeholder="120"
                    placeholderTextColor={withAlpha(MD_TEXT, 0.2)}
                    selectionColor={MD_ACCENT}
                    style={styles.editorReadingInput}
                    value={draft.systolic}
                  />
                </View>
                <Text style={styles.editorSlash}>/</Text>
                <View style={styles.editorReadingBlock}>
                  <Text style={styles.editorReadingLabel}>Diastolic</Text>
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={(value) => onChange({ ...draft, diastolic: value })}
                    placeholder="80"
                    placeholderTextColor={withAlpha(MD_TEXT, 0.2)}
                    selectionColor={MD_ACCENT}
                    style={styles.editorReadingInput}
                    value={draft.diastolic}
                  />
                </View>
              </View>

              {category ? (
                <View style={styles.editorClassification}>
                  <BPClassification diastolic={dia} systolic={sys} />
                  <Text style={[styles.editorClassificationText, { color: BP_CATEGORY_COLORS[category] }]}>
                    {BP_CATEGORY_LABELS[category]}
                  </Text>
                </View>
              ) : null}
            </GlassCard>

            <GlassCard style={styles.editorCard}>
              <Text style={styles.modalSectionLabel}>Pulse</Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={3}
                onChangeText={(value) => onChange({ ...draft, pulse: value })}
                placeholder="72"
                placeholderTextColor={withAlpha(MD_TEXT, 0.2)}
                selectionColor={MD_ACCENT}
                style={styles.editorPulseInput}
                value={draft.pulse}
              />
            </GlassCard>

            <GlassCard style={styles.editorCard}>
              <Text style={styles.modalSectionLabel}>Arm</Text>
              <View style={styles.modalPillRow}>
                {ARMS.map((option) => (
                  <ChoicePill
                    key={option.value}
                    label={option.label}
                    onPress={() => onChange({ ...draft, arm: option.value })}
                    selected={draft.arm === option.value}
                  />
                ))}
              </View>

              <Text style={[styles.modalSectionLabel, styles.modalSectionSpacing]}>Position</Text>
              <View style={styles.modalPillRow}>
                {POSITIONS.map((option) => (
                  <ChoicePill
                    key={option.value}
                    label={option.label}
                    onPress={() => onChange({ ...draft, position: option.value })}
                    selected={draft.position === option.value}
                  />
                ))}
              </View>

              <Text style={[styles.modalSectionLabel, styles.modalSectionSpacing]}>Context</Text>
              <View style={styles.modalPillRow}>
                {CONTEXTS.map((option) => (
                  <ChoicePill
                    key={option.value}
                    label={option.label}
                    onPress={() => onChange({ ...draft, context: option.value })}
                    selected={draft.context === option.value}
                  />
                ))}
              </View>
            </GlassCard>

            <GlassCard style={styles.editorCard}>
              <Text style={styles.modalSectionLabel}>Notes</Text>
              <TextInput
                multiline
                onChangeText={(value) => onChange({ ...draft, notes: value })}
                placeholder="Why was this reading different?"
                placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.8)}
                selectionColor={MD_ACCENT}
                style={styles.editorNotesInput}
                value={draft.notes}
              />
            </GlassCard>

            <View style={styles.modalActionRow}>
              <Pressable onPress={onDelete} style={styles.modalDeleteButton}>
                <Text style={styles.modalDeleteText}>Delete</Text>
              </Pressable>
              <Pressable
                disabled={!hasValues}
                onPress={onSave}
                style={[styles.modalSaveButton, !hasValues && styles.modalSaveButtonDisabled]}
              >
                <Text style={styles.modalSaveText}>Save Changes</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function BPHistoryScreen() {
  const db = useDatabase();
  const [period, setPeriod] = useState<BPPeriodKey>('30d');
  const [filter, setFilter] = useState<BPFilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editorDraft, setEditorDraft] = useState<EditorDraft | null>(null);

  const dataset = useMemo(() => {
    try {
      return {
        error: null as string | null,
        readings: getBPReadings(db),
      };
    } catch {
      return {
        error: 'Failed to load BP history.',
        readings: [] as BPReading[],
      };
    }
  }, [db, refreshKey]);

  const periodReadings = useMemo(
    () => filterBPReadingsForPeriod(dataset.readings, period),
    [dataset.readings, period],
  );

  const filteredReadings = useMemo(
    () => filterBPReadingsForFilter(periodReadings, filter),
    [filter, periodReadings],
  );

  const groups = useMemo(
    () => groupBPReadingsByDay(filteredReadings),
    [filteredReadings],
  );

  const stats = useMemo(
    () => getBPSummaryStats(periodReadings),
    [periodReadings],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const handleDelete = useCallback((readingId: string) => {
    Alert.alert('Delete reading?', 'This blood pressure entry will be removed from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteBPReading(db, readingId);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setEditorDraft(null);
            setRefreshKey((value) => value + 1);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete reading.';
            Alert.alert('Delete failed', message);
          }
        },
      },
    ]);
  }, [db]);

  const handleSaveEdit = useCallback(() => {
    if (!editorDraft) {
      return;
    }

    const sys = Number.parseInt(editorDraft.systolic, 10);
    const dia = Number.parseInt(editorDraft.diastolic, 10);
    const validation = validateBP(sys, dia);

    if (!validation.valid) {
      Alert.alert('Invalid reading', validation.error);
      return;
    }

    try {
      updateBPReading(db, editorDraft.id, {
        systolic: sys,
        diastolic: dia,
        pulse: editorDraft.pulse ? Number.parseInt(editorDraft.pulse, 10) : null,
        arm: editorDraft.arm,
        position: editorDraft.position,
        context: editorDraft.context,
        notes: editorDraft.notes.trim() || null,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditorDraft(null);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save changes.';
      Alert.alert('Save failed', message);
    }
  }, [db, editorDraft]);

  if (dataset.error) {
    return (
      <View style={styles.stateWrap}>
        <ErrorState message={dataset.error} onRetry={onRefresh} />
      </View>
    );
  }

  if (dataset.readings.length === 0) {
    return (
      <View style={styles.stateWrap}>
        <EmptyState
          accentColor={MD_ACCENT}
          icon="🩺"
          message="Log your first reading to unlock distributions, trends, and follow-up editing."
          title="No BP readings yet"
        />
      </View>
    );
  }

  const distributionReadings = periodReadings;

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={MD_ACCENT} />}
        style={styles.screen}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Clinical History</Text>
          <Text style={styles.title}>BP History</Text>
          <Text style={styles.subtitle}>
            Filter readings by range, inspect your classification mix, and edit entries in place.
          </Text>
        </View>

        <View style={styles.optionRow}>
          {BP_PERIOD_OPTIONS.map((option) => (
            <ChoicePill
              key={option.key}
              label={option.label}
              onPress={() => {
                setPeriod(option.key);
                void Haptics.selectionAsync();
              }}
              selected={period === option.key}
            />
          ))}
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Average"
            value={`${stats.average.systolic}/${stats.average.diastolic}`}
            supporting={stats.average.pulse != null ? `${stats.average.pulse} bpm` : undefined}
          />
          <SummaryCard
            label="Lowest"
            value={stats.lowest ? `${stats.lowest.systolic}/${stats.lowest.diastolic}` : '--'}
            supporting={stats.lowest ? BP_CATEGORY_LABELS[stats.lowest.category] : undefined}
          />
          <SummaryCard
            label="Highest"
            value={stats.highest ? `${stats.highest.systolic}/${stats.highest.diastolic}` : '--'}
            supporting={stats.highest ? BP_CATEGORY_LABELS[stats.highest.category] : undefined}
          />
          <SummaryCard label="Readings" value={String(stats.count)} supporting={period.toUpperCase()} />
        </View>

        <GlassCard style={styles.distributionCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardEyebrow}>Classification</Text>
              <Text style={styles.cardTitle}>Distribution</Text>
            </View>
            <MaterialSymbol color={MD_ACCENT_LIGHT} name="timeline" size={20} />
          </View>
          <DistributionDonut readings={distributionReadings} />
        </GlassCard>

        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardEyebrow}>Timeline</Text>
            <Text style={styles.cardTitle}>Readings</Text>
          </View>
        </View>

        <View style={styles.optionRow}>
          {BP_FILTER_OPTIONS.map((option) => (
            <ChoicePill
              key={option.key}
              label={option.label}
              onPress={() => {
                setFilter(option.key);
                void Haptics.selectionAsync();
              }}
              selected={filter === option.key}
            />
          ))}
        </View>

        {groups.length === 0 ? (
          <GlassCard style={styles.emptyFilterCard}>
            <Text style={styles.emptyFilterTitle}>No readings match this filter</Text>
            <Text style={styles.emptyFilterBody}>
              Try a different classification filter or widen the time period.
            </Text>
          </GlassCard>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.groupBlock}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.groupList}>
                {group.readings.map((reading) => (
                  <Swipeable
                    key={reading.id}
                    overshootRight={false}
                    renderRightActions={() => (
                      <Pressable
                        onPress={() => handleDelete(reading.id)}
                        style={styles.deleteAction}
                      >
                        <MaterialSymbol color="#001F2A" name="delete" size={18} />
                        <Text style={styles.deleteActionText}>Delete</Text>
                      </Pressable>
                    )}
                  >
                    <Pressable onPress={() => setEditorDraft(toEditorDraft(reading))}>
                      <GlassCard style={styles.readingCard}>
                        <View style={styles.readingTopRow}>
                          <View style={styles.readingValueWrap}>
                            <Text style={styles.readingValue}>{reading.systolic}</Text>
                            <Text style={styles.readingSlash}>/</Text>
                            <Text style={styles.readingValue}>{reading.diastolic}</Text>
                            <Text style={styles.readingUnit}>mmHg</Text>
                          </View>
                          <View
                            style={[
                              styles.readingBadge,
                              { backgroundColor: withAlpha(BP_CATEGORY_COLORS[reading.category], 0.16) },
                            ]}
                          >
                            <Text
                              style={[
                                styles.readingBadgeText,
                                { color: BP_CATEGORY_COLORS[reading.category] },
                              ]}
                            >
                              {BP_CATEGORY_LABELS[reading.category]}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.readingTimestamp}>{formatBPDateTime(reading.measuredAt)}</Text>

                        <View style={styles.readingMetaRow}>
                          {reading.pulse != null ? (
                            <View style={styles.metaChip}>
                              <MaterialSymbol color={MD_ACCENT_LIGHT} filled name="favorite" size={14} />
                              <Text style={styles.metaChipText}>{reading.pulse} bpm</Text>
                            </View>
                          ) : null}
                          {reading.arm ? (
                            <View style={styles.metaChip}>
                              <Text style={styles.metaChipText}>
                                {reading.arm === 'left' ? 'Left arm' : 'Right arm'}
                              </Text>
                            </View>
                          ) : null}
                          {reading.position ? (
                            <View style={styles.metaChip}>
                              <Text style={styles.metaChipText}>
                                {reading.position.charAt(0).toUpperCase() + reading.position.slice(1)}
                              </Text>
                            </View>
                          ) : null}
                          {reading.context ? (
                            <View style={styles.metaChip}>
                              <Text style={styles.metaChipText}>
                                {reading.context.replace(/_/g, ' ')}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </GlassCard>
                    </Pressable>
                  </Swipeable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {editorDraft ? (
        <HistoryEditor
          draft={editorDraft}
          onChange={setEditorDraft}
          onClose={() => setEditorDraft(null)}
          onDelete={() => handleDelete(editorDraft.id)}
          onSave={handleSaveEdit}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
    gap: 18,
  },
  stateWrap: {
    flex: 1,
    backgroundColor: MD_SURFACES.lowest,
  },
  hero: {
    gap: 8,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  title: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: MD_TEXT,
  },
  subtitle: {
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: MD_TEXT_SECONDARY,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: MD_SURFACES.mid,
  },
  choicePillActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
  },
  choicePillText: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: MD_TEXT_SECONDARY,
  },
  choicePillTextActive: {
    color: MD_ACCENT_LIGHT,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: '47%',
    backgroundColor: MD_SURFACES.low,
    minHeight: 112,
    gap: 10,
  },
  summaryLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  summaryValue: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: MD_TEXT,
    fontVariant: ['tabular-nums'],
  },
  summarySupporting: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: MD_TEXT_SECONDARY,
  },
  distributionCard: {
    backgroundColor: MD_SURFACES.low,
    gap: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  cardTitle: {
    fontFamily: MD_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: MD_TEXT,
    marginTop: 4,
  },
  distributionBlock: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  donutWrap: {
    width: 118,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  donutValue: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 30,
    color: MD_TEXT,
    fontVariant: ['tabular-nums'],
  },
  donutLabel: {
    fontFamily: MD_FONTS.medium,
    fontSize: 11,
    lineHeight: 16,
    color: MD_TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  distributionLegend: {
    flex: 1,
    gap: 10,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  distributionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distributionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  distributionLabel: {
    fontFamily: MD_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: MD_TEXT,
  },
  distributionValue: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: MD_TEXT_SECONDARY,
    fontVariant: ['tabular-nums'],
  },
  emptyFilterCard: {
    backgroundColor: MD_SURFACES.low,
    gap: 8,
  },
  emptyFilterTitle: {
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: MD_TEXT,
  },
  emptyFilterBody: {
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: MD_TEXT_SECONDARY,
  },
  groupBlock: {
    gap: 10,
  },
  groupTitle: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  groupList: {
    gap: 10,
  },
  deleteAction: {
    width: 86,
    borderRadius: MD_CARD_RADIUS,
    backgroundColor: withAlpha(MD_BP_STATUS.crisis, 0.92),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginLeft: 10,
  },
  deleteActionText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    color: '#001F2A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  readingCard: {
    backgroundColor: MD_SURFACES.low,
    gap: 10,
  },
  readingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  readingValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  readingValue: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: MD_TEXT,
    fontVariant: ['tabular-nums'],
  },
  readingSlash: {
    fontFamily: MD_FONTS.regular,
    fontSize: 28,
    lineHeight: 32,
    color: withAlpha(MD_TEXT, 0.28),
    marginHorizontal: 2,
  },
  readingUnit: {
    fontFamily: MD_FONTS.medium,
    fontSize: 10,
    lineHeight: 14,
    color: MD_TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 6,
  },
  readingBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  readingBadgeText: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  readingTimestamp: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: MD_TEXT_SECONDARY,
  },
  readingMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: withAlpha(MD_TEXT, 0.06),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaChipText: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: MD_TEXT_SECONDARY,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  modalSheet: {
    maxHeight: '92%',
    backgroundColor: MD_SURFACES.base,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 18,
  },
  modalHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: withAlpha(MD_TEXT, 0.16),
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  modalTitle: {
    fontFamily: MD_FONTS.bold,
    fontSize: 24,
    lineHeight: 28,
    color: MD_TEXT,
    marginTop: 4,
  },
  modalSubtitle: {
    fontFamily: MD_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: MD_TEXT_SECONDARY,
    marginTop: 4,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withAlpha(MD_TEXT, 0.06),
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorCard: {
    backgroundColor: MD_SURFACES.low,
    marginBottom: 12,
  },
  editorReadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  editorReadingBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  editorReadingLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  editorReadingInput: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 44,
    lineHeight: 48,
    color: MD_TEXT,
    fontVariant: ['tabular-nums'],
    minWidth: 96,
    textAlign: 'center',
    paddingVertical: 0,
  },
  editorSlash: {
    fontFamily: MD_FONTS.regular,
    fontSize: 32,
    lineHeight: 36,
    color: withAlpha(MD_TEXT, 0.24),
  },
  editorClassification: {
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  editorClassificationText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  modalSectionLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
    marginBottom: 10,
  },
  modalSectionSpacing: {
    marginTop: 18,
  },
  modalPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  editorPulseInput: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 38,
    lineHeight: 42,
    color: MD_TEXT,
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  editorNotesInput: {
    minHeight: 92,
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: MD_TEXT,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  modalDeleteButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: withAlpha(MD_BP_STATUS.crisis, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: MD_BP_STATUS.crisis,
  },
  modalSaveButton: {
    flex: 1.6,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: MD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.36,
  },
  modalSaveText: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#001F2A',
  },
});
