import { useState } from 'react';
import { View, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button } from '@mylife/ui';
import { createPlan, getPins, type PinRow } from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';
import { schedulePlanReminder } from '../lib/notifications';
import { planStringToDate } from '../lib/datetime';
import { DateTimeField } from '../components/DateTimeField';

const REMINDER_OPTIONS: Array<{ label: string; minutes: number | null }> = [
  { label: 'None', minutes: null },
  { label: '15m', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '1d', minutes: 1440 },
];

export default function NewPlanScreen() {
  const db = useManhattanDatabase();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [pinId, setPinId] = useState<string | null>(null);
  const [pins] = useState<PinRow[]>(() => getPins(db));

  const canSave = title.trim().length > 0 && planStringToDate(startAt) !== null;

  const handleSave = () => {
    if (!canSave) return;
    const planId = createPlan(db, {
      title: title.trim(),
      startAt: startAt.trim(),
      reminderMinutes,
      pinId,
    });
    void schedulePlanReminder({
      id: planId,
      title: title.trim(),
      start_at: startAt.trim(),
      reminder_minutes: reminderMinutes,
    });
    router.back();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="heading" style={styles.title}>New plan</Text>

      <Text variant="label" color="#9F8E81">Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Dinner at Lilia"
        placeholderTextColor="#52443A"
        autoFocus
      />

      <DateTimeField label="Start" value={startAt} onChange={setStartAt} />

      <Text variant="label" color="#9F8E81">Reminder</Text>
      <View style={styles.chipRow}>
        {REMINDER_OPTIONS.map((opt) => {
          const selected = reminderMinutes === opt.minutes;
          return (
            <Pressable
              key={opt.label}
              accessibilityRole="button"
              accessibilityLabel={`Reminder ${opt.label}`}
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setReminderMinutes(opt.minutes)}
            >
              <Text variant="caption" color={selected ? '#131318' : '#D6C3B5'}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="label" color="#9F8E81">Linked spot (optional)</Text>
      <View style={styles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="No linked spot"
          accessibilityState={{ selected: pinId === null }}
          style={[styles.chip, pinId === null && styles.chipSelected]}
          onPress={() => setPinId(null)}
        >
          <Text variant="caption" color={pinId === null ? '#131318' : '#D6C3B5'}>None</Text>
        </Pressable>
        {pins.map((pin) => {
          const selected = pinId === pin.id;
          return (
            <Pressable
              key={pin.id}
              accessibilityRole="button"
              accessibilityLabel={`Link spot ${pin.name}`}
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setPinId(pin.id)}
            >
              <Text variant="caption" color={selected ? '#131318' : '#D6C3B5'}>
                {pin.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button title="Save plan" onPress={handleSave} disabled={!canSave} />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131318' },
  content: { padding: 20, paddingTop: 64, gap: 8 },
  title: { marginBottom: 8 },
  input: {
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#E4E1E9',
    fontSize: 16,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    backgroundColor: '#1F1F25',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: '#E4572E' },
  actions: { marginTop: 16, gap: 10 },
});
