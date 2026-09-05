import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
  createBodyMeasurement,
  deleteBodyMeasurement,
  getBodyMeasurements,
  type BodyMeasurementRow,
} from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { getWorkoutPhaseOneSettings } from '../../lib/workouts/settings';
import { WorkoutHero, WorkoutPrimaryButton, WorkoutSecondaryButton } from './(tabs)/_screen-kit';

const MEASUREMENT_TYPES = [
  { key: 'weight', label: 'Weight' },
  { key: 'body_fat', label: 'Body Fat' },
  { key: 'chest', label: 'Chest' },
  { key: 'arms', label: 'Arms' },
  { key: 'waist', label: 'Waist' },
  { key: 'legs', label: 'Legs' },
  { key: 'hips', label: 'Hips' },
  { key: 'neck', label: 'Neck' },
] as const;

function formatDisplayDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getMeasurementUnit(
  type: string,
  settings: ReturnType<typeof getWorkoutPhaseOneSettings>,
): string {
  if (type === 'weight') return settings.bodyWeightUnit;
  if (type === 'body_fat') return '%';
  return settings.bodyWeightUnit === 'kg' ? 'cm' : 'in';
}

function buildChartPoints(entries: BodyMeasurementRow[]): string {
  if (!entries.length) return '';

  const width = 320;
  const height = 170;
  const values = entries.map((entry) => entry.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return entries
    .map((entry, index) => {
      const x = entries.length === 1 ? width / 2 : (index / (entries.length - 1)) * width;
      const y = height - ((entry.value - min) / range) * 130 - 20;
      return `${x},${y}`;
    })
    .join(' ');
}

export default function MeasurementsScreen() {
  const db = useDatabase();
  const settings = useMemo(() => getWorkoutPhaseOneSettings(db), [db]);
  const [selectedType, setSelectedType] = useState<string>('weight');
  const [entries, setEntries] = useState<BodyMeasurementRow[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [draftDate, setDraftDate] = useState(new Date().toISOString().slice(0, 10));

  const loadEntries = useCallback(() => {
    setEntries(getBodyMeasurements(db, { type: selectedType, limit: 120 }));
  }, [db, selectedType]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const activeLabel = MEASUREMENT_TYPES.find((type) => type.key === selectedType)?.label ?? selectedType;
  const unit = getMeasurementUnit(selectedType, settings);
  const chartEntries = [...entries].reverse();
  const chartPoints = buildChartPoints(chartEntries);
  const latest = entries[0] ?? null;
  const first = entries[entries.length - 1] ?? null;
  const delta = latest && first ? latest.value - first.value : 0;

  const handleSave = () => {
    const value = Number(draftValue);
    if (!Number.isFinite(value)) {
      Alert.alert('Invalid number', 'Use a numeric value before saving.');
      return;
    }

    try {
      createBodyMeasurement(db, uuid(), {
        type: selectedType,
        value,
        unit,
        measuredAt: new Date(`${draftDate}T12:00:00`).toISOString(),
      });
      setDraftValue('');
      setShowComposer(false);
      loadEntries();
    } catch (error) {
      Alert.alert(
        'Could not save measurement',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const handleDelete = (entry: BodyMeasurementRow) => {
    Alert.alert('Delete measurement', 'Remove this entry from your body metrics timeline?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteBodyMeasurement(db, entry.id);
          loadEntries();
        },
      },
    ]);
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <WorkoutHero
          eyebrow="Tracking Surface"
          title="Body Metrics"
          subtitle="Log measurements, watch long-term deltas, and keep your body data local to the device."
          accent={WK_ACCENT_LIGHT}
          action={
            <WorkoutSecondaryButton
              label="Log New"
              icon="add_circle"
              onPress={() => setShowComposer(true)}
            />
          }
        />

        <View style={styles.chipRow}>
          {MEASUREMENT_TYPES.map((type) => (
            <Chip
              key={type.key}
              label={type.label}
              selected={selectedType === type.key}
              onPress={() => setSelectedType(type.key)}
            />
          ))}
        </View>

        <GlassPanel style={styles.heroPanel} intensity={50}>
          <Text style={styles.sectionLabel}>{activeLabel}</Text>
          <Text style={styles.metricValue}>
            {latest ? `${latest.value} ${latest.unit}` : '--'}
          </Text>
          <Text style={styles.metricMeta}>
            {entries.length > 1
              ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} ${unit} vs first log`
              : 'Waiting for more than one entry'}
          </Text>

          <Svg width="100%" height={190} viewBox="0 0 320 170">
            <Line x1={0} x2={320} y1={150} y2={150} stroke="rgba(214, 195, 181, 0.12)" strokeWidth={1} />
            <Polyline
              points={chartPoints}
              fill="none"
              stroke={selectedType === 'body_fat' ? WK_CATEGORY_COLORS.hypertrophy : WK_ACCENT_LIGHT}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {chartEntries.map((entry, index) => {
              const points = chartPoints.split(' ');
              const [x, y] = points[index]?.split(',').map(Number) ?? [0, 0];
              return (
                <Circle
                  key={entry.id}
                  cx={x}
                  cy={y}
                  r={index === chartEntries.length - 1 ? 6 : 4}
                  fill={index === chartEntries.length - 1 ? WK_ACCENT_LIGHT : '#F4EEE8'}
                />
              );
            })}
          </Svg>

          <View style={styles.axisRow}>
            {chartEntries.slice(0, 4).map((entry) => (
              <Text key={entry.id} style={styles.axisLabel}>
                {formatDisplayDate(entry.measuredAt)}
              </Text>
            ))}
          </View>
        </GlassPanel>

        <GlassPanel style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Recent Entries</Text>
            <Text style={styles.helperCopy}>{entries.length} total</Text>
          </View>

          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View>
                <Text style={styles.entryValue}>
                  {entry.value} {entry.unit}
                </Text>
                <Text style={styles.entryMeta}>{formatDisplayDate(entry.measuredAt)}</Text>
              </View>
              <Pressable onPress={() => handleDelete(entry)} style={styles.deleteButton}>
                <MaterialSymbol name="delete" size={16} color="rgba(255, 180, 171, 0.92)" />
              </Pressable>
            </View>
          ))}

          {!entries.length ? (
            <Text style={styles.emptyCopy}>
              No {activeLabel.toLowerCase()} logs yet. Start a timeline with your first entry.
            </Text>
          ) : null}
        </GlassPanel>
      </ScrollView>

      <Modal visible={showComposer} animationType="slide" transparent>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.modalTitle}>New Measurement</Text>
                <Text style={styles.modalSubtitle}>
                  Add a {activeLabel.toLowerCase()} entry for your visual timeline.
                </Text>
              </View>
              <Pressable onPress={() => setShowComposer(false)} style={styles.closeButton}>
                <MaterialSymbol name="close" size={18} color="rgba(214, 195, 181, 0.72)" />
              </Pressable>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Value ({unit})</Text>
              <TextInput
                value={draftValue}
                onChangeText={setDraftValue}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="rgba(214, 195, 181, 0.36)"
                style={styles.input}
              />
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Date</Text>
              <TextInput
                value={draftDate}
                onChangeText={setDraftDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="rgba(214, 195, 181, 0.36)"
                style={styles.input}
              />
            </View>

            <WorkoutPrimaryButton label="Save Entry" icon="check_circle" onPress={handleSave} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sectionLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  heroPanel: {
    gap: spacing.sm,
    backgroundColor: WK_SURFACES.high,
  },
  panel: {
    gap: spacing.sm,
    backgroundColor: WK_SURFACES.low,
  },
  metricValue: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 44,
    lineHeight: 48,
    color: '#FFF3E7',
  },
  metricMeta: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.7)',
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  axisLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.52)',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  helperCopy: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 18,
    backgroundColor: WK_SURFACES.mid,
  },
  entryValue: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    color: '#F4EEE8',
  },
  entryMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 180, 171, 0.08)',
  },
  emptyCopy: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: WK_SURFACES.base,
  },
  modalTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: '#FFF3E7',
  },
  modalSubtitle: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.low,
  },
  inputCard: {
    borderRadius: 22,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: WK_SURFACES.low,
  },
  inputLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  input: {
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: '#FFF3E7',
    paddingVertical: 0,
  },
});
