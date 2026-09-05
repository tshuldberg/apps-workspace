import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  getActivePregnancy,
  getAppointmentsByPregnancy,
  createAppointment,
  PREGNANCY_PHYSICAL_SYMPTOMS,
  PREGNANCY_MOOD_SYMPTOMS,
} from '@mylife/cycle';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.cycle;

export default function PregnancyLogScreen() {
  const db = useDatabase();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [aptTitle, setAptTitle] = useState('');
  const [aptDate, setAptDate] = useState('');
  const [aptTime, setAptTime] = useState('');
  const [aptLocation, setAptLocation] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const pregnancy = useMemo(() => {
    try { return getActivePregnancy(db); } catch { return null; }
  }, [db]);

  const appointments = useMemo(() => {
    if (!pregnancy) return [];
    try { return getAppointmentsByPregnancy(db, pregnancy.id); } catch { return []; }
  }, [db, pregnancy, tick]);

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleAddAppointment = () => {
    if (!pregnancy || !aptTitle.trim() || !aptDate.trim()) {
      Alert.alert('Required', 'Enter title and date.');
      return;
    }
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      createAppointment(db, id, {
        pregnancyId: pregnancy.id,
        title: aptTitle.trim(),
        date: aptDate.trim(),
        time: aptTime.trim() || undefined,
        location: aptLocation.trim() || undefined,
      });
      setAptTitle(''); setAptDate(''); setAptTime(''); setAptLocation('');
      refresh();
    } catch {
      Alert.alert('Error', "Couldn't add appointment.");
    }
  };

  if (!pregnancy) {
    return (
      <View style={styles.emptyScreen}>
        <Text variant="subheading" color={colors.textSecondary}>
          No active pregnancy
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Pregnancy Log</Text>

      {/* Symptoms */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>PHYSICAL SYMPTOMS</Text>
        <View style={styles.chipRow}>
          {PREGNANCY_PHYSICAL_SYMPTOMS.map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, selectedSymptoms.includes(s) && { backgroundColor: ACCENT }]}
              onPress={() => toggleSymptom(s)}
            >
              <Text variant="caption" color={selectedSymptoms.includes(s) ? colors.background : colors.textSecondary}>
                {s.replace(/_/g, ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="label" color={colors.textTertiary}>MOOD</Text>
        <View style={styles.chipRow}>
          {PREGNANCY_MOOD_SYMPTOMS.map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, selectedSymptoms.includes(s) && { backgroundColor: ACCENT }]}
              onPress={() => toggleSymptom(s)}
            >
              <Text variant="caption" color={selectedSymptoms.includes(s) ? colors.background : colors.textSecondary}>
                {s.replace(/_/g, ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {selectedSymptoms.length > 0 && (
        <Text variant="caption" color={colors.textSecondary}>
          Selected: {selectedSymptoms.map((s) => s.replace(/_/g, ' ')).join(', ')}
        </Text>
      )}

      {/* Add appointment */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>ADD APPOINTMENT</Text>
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={aptTitle}
            onChangeText={setAptTitle}
            placeholder="Title (e.g. Ultrasound)"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.formRow}>
            <TextInput
              style={styles.input}
              value={aptDate}
              onChangeText={setAptDate}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={styles.input}
              value={aptTime}
              onChangeText={setAptTime}
              placeholder="Time"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <TextInput
            style={styles.input}
            value={aptLocation}
            onChangeText={setAptLocation}
            placeholder="Location (optional)"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable style={styles.saveButton} onPress={handleAddAppointment}>
            <Text variant="label" color={colors.background}>Add Appointment</Text>
          </Pressable>
        </View>
      </Card>

      {/* Appointment history */}
      {appointments.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>APPOINTMENTS</Text>
          {appointments.map((apt) => (
            <View key={apt.id} style={styles.aptRow}>
              <View style={styles.aptInfo}>
                <Text variant="body">{apt.title}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {apt.date}{apt.time ? ` at ${apt.time}` : ''}
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: apt.completed ? colors.success : colors.textTertiary }]} />
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyScreen: {
    flex: 1, backgroundColor: colors.background, justifyContent: 'center',
    alignItems: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  formGrid: { marginTop: spacing.sm, gap: spacing.sm },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 44,
  },
  saveButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  aptRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  aptInfo: { flex: 1, gap: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
