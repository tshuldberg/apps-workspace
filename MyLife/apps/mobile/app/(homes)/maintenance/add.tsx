import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  getProperties, getSchedule, createSchedule, updateSchedule,
  getDefaultSchedules,
  type TaskType, type Season,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const TASK_TYPES: TaskType[] = [
  'hvac_filter', 'hvac_service', 'gutter_cleaning', 'roof_inspection',
  'smoke_detector', 'water_heater_flush', 'dryer_vent', 'pest_control',
  'exterior_paint', 'lawn_mower_service', 'window_cleaning',
  'plumbing_inspection', 'appliance_service', 'chimney_sweep', 'custom',
];
const SEASONS: (Season | 'none')[] = ['none', 'spring', 'summer', 'fall', 'winter'];

function taskLabel(t: TaskType): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AddScheduleScreen() {
  const { id, propertyId: paramPropId } = useLocalSearchParams<{ id?: string; propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const isEdit = !!id;

  const properties = useMemo(() => getProperties(db), [db]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(paramPropId ?? properties[0]?.id ?? '');
  const [taskType, setTaskType] = useState<TaskType>('hvac_filter');
  const [customName, setCustomName] = useState('');
  const [interval, setInterval] = useState('3');
  const [season, setSeason] = useState<Season | 'none'>('none');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id) {
      const existing = getSchedule(db, id);
      if (existing) {
        setSelectedPropertyId(existing.propertyId);
        setTaskType(existing.taskType);
        setCustomName(existing.taskTypeCustom ?? '');
        setInterval(String(existing.intervalMonths));
        setSeason(existing.seasonPreference ?? 'none');
        setNotes(existing.notes ?? '');
      }
    }
  }, [id, db]);

  const handleSave = () => {
    if (!selectedPropertyId) {
      Alert.alert('Required', 'Select a property.');
      return;
    }
    if (taskType === 'custom' && !customName.trim()) {
      Alert.alert('Required', 'Enter a custom task name.');
      return;
    }

    const months = Math.max(1, Math.min(120, Number(interval) || 3));
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + months);

    const data = {
      propertyId: selectedPropertyId,
      taskType,
      taskTypeCustom: taskType === 'custom' ? customName.trim() : undefined,
      intervalMonths: months,
      seasonPreference: season === 'none' ? null : season,
      nextDueDate: nextDue.toISOString().slice(0, 10),
      notes: notes.trim() || undefined,
    };

    if (isEdit && id) {
      updateSchedule(db, id, data);
    } else {
      createSchedule(db, uuid(), data);
    }
    router.back();
  };

  const handleUseDefaults = () => {
    if (!selectedPropertyId) return;
    const prop = properties.find((p) => p.id === selectedPropertyId);
    if (!prop) return;
    const presets = getDefaultSchedules(prop.propertyType, prop.ownershipType);
    for (const preset of presets) {
      const nextDue = new Date();
      nextDue.setMonth(nextDue.getMonth() + preset.intervalMonths);
      createSchedule(db, uuid(), {
        propertyId: selectedPropertyId,
        taskType: preset.taskType,
        intervalMonths: preset.intervalMonths,
        seasonPreference: preset.seasonPreference,
        nextDueDate: nextDue.toISOString().slice(0, 10),
      });
    }
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{isEdit ? 'Edit Task' : 'Add Task'}</Text>

      <Text variant="label" color={colors.textSecondary}>Property *</Text>
      <View style={styles.chipRow}>
        {properties.map((p) => (
          <Pressable key={p.id}
            style={[styles.chip, selectedPropertyId === p.id && styles.chipActive]}
            onPress={() => setSelectedPropertyId(p.id)}>
            <Text variant="label" color={selectedPropertyId === p.id ? colors.background : colors.textSecondary}>
              {p.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Task Type *</Text>
      <View style={styles.chipRow}>
        {TASK_TYPES.map((t) => (
          <Pressable key={t}
            style={[styles.chip, taskType === t && styles.chipActive]}
            onPress={() => setTaskType(t)}>
            <Text variant="label" color={taskType === t ? colors.background : colors.textSecondary} style={{ fontSize: 11 }}>
              {taskLabel(t)}
            </Text>
          </Pressable>
        ))}
      </View>

      {taskType === 'custom' && (
        <>
          <Text variant="label" color={colors.textSecondary}>Custom Task Name *</Text>
          <TextInput style={styles.input} value={customName} onChangeText={setCustomName}
            placeholder="e.g. Pool cleaning" placeholderTextColor={colors.textTertiary} />
        </>
      )}

      <Text variant="label" color={colors.textSecondary}>Interval (months, 1-120)</Text>
      <TextInput style={styles.input} value={interval} onChangeText={setInterval}
        keyboardType="numeric" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Season Preference</Text>
      <View style={styles.chipRow}>
        {SEASONS.map((s) => (
          <Pressable key={s}
            style={[styles.chip, season === s && styles.chipActive]}
            onPress={() => setSeason(s)}>
            <Text variant="label" color={season === s ? colors.background : colors.textSecondary}>
              {s === 'none' ? 'Any' : s}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Notes</Text>
      <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes}
        multiline numberOfLines={3} placeholderTextColor={colors.textTertiary} />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text variant="label" color={colors.background}>{isEdit ? 'Save Changes' : 'Add Task'}</Text>
      </Pressable>

      {!isEdit && (
        <Pressable style={styles.defaultsButton} onPress={handleUseDefaults}>
          <Text variant="label" color={ACCENT}>Use Recommended Defaults</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    backgroundColor: colors.glassStrong, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  chipActive: { backgroundColor: ACCENT },
  saveButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md,
  },
  defaultsButton: {
    borderWidth: 1, borderColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
