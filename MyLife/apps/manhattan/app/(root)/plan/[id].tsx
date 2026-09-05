import { useCallback, useState } from 'react';
import { View, ScrollView, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, Button, EmptyState } from '@mylife/ui';
import {
  addPlanMember,
  getPlanById,
  getPlanMembers,
  getPins,
  removePlanMember,
  updatePlan,
  softDeletePlan,
  type PlanRow,
  type PlanMemberRow,
  type PinRow,
} from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';
import { schedulePlanReminder, cancelPlanReminder } from '../lib/notifications';
import { deleteDeviceCalendarEvent } from '../lib/device-calendar';
import { planStringToDate } from '../lib/datetime';
import { DateTimeField } from '../components/DateTimeField';
import { EntityTags } from '../components/EntityTags';

const REMINDER_OPTIONS: Array<{ label: string; minutes: number | null }> = [
  { label: 'None', minutes: null },
  { label: '15m', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '1d', minutes: 1440 },
];

export default function PlanDetailScreen() {
  const db = useManhattanDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [members, setMembers] = useState<PlanMemberRow[]>([]);
  const [pins, setPins] = useState<PinRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [pinId, setPinId] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState('');

  const refresh = useCallback(() => {
    if (!id) return;
    const found = getPlanById(db, id);
    setPlan(found);
    setMembers(getPlanMembers(db, id));
    setPins(getPins(db));
    if (found && !loaded) {
      setTitle(found.title);
      setStartAt(found.start_at);
      setReminderMinutes(found.reminder_minutes);
      setPinId(found.pin_id);
      setLoaded(true);
    }
  }, [db, id, loaded]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const canSave = title.trim().length > 0 && planStringToDate(startAt) !== null;

  const handleSave = () => {
    if (!id || !plan || !canSave) return;
    updatePlan(db, id, {
      title: title.trim(),
      startAt: startAt.trim(),
      endAt: plan.end_at,
      eventId: plan.event_id,
      pinId,
      reminderMinutes,
      hasReservation: plan.has_reservation === 1,
      partySize: plan.party_size,
      source: plan.source,
    });
    void schedulePlanReminder({
      id,
      title: title.trim(),
      start_at: startAt.trim(),
      reminder_minutes: reminderMinutes,
    });
    router.back();
  };

  const handleAddMember = () => {
    const personRef = memberDraft.trim();
    if (!id || !personRef) return;
    addPlanMember(db, { planId: id, personRef });
    setMemberDraft('');
    refresh();
  };

  const handleRemoveMember = (memberId: string) => {
    removePlanMember(db, memberId);
    refresh();
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete plan?', 'This removes the plan from your list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const calendarEventId = plan?.calendar_event_id;
          softDeletePlan(db, id);
          if (calendarEventId) {
            void deleteDeviceCalendarEvent(calendarEventId);
          }
          void cancelPlanReminder(id);
          router.back();
        },
      },
    ]);
  };

  if (!plan) {
    return (
      <View style={styles.center}>
        <EmptyState title="Plan not found" message="This plan may have been deleted." />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="heading" style={styles.title}>Edit plan</Text>

      <Text variant="label" color="#9F8E81">Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Dinner at Lilia"
        placeholderTextColor="#52443A"
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
              <Text variant="caption" color={selected ? '#131318' : '#D6C3B5'}>{opt.label}</Text>
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
              <Text variant="caption" color={selected ? '#131318' : '#D6C3B5'}>{pin.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tagsBlock}>
        <EntityTags entityType="plan" entityId={plan.id} />
      </View>

      <Text variant="label" color="#9F8E81" style={styles.membersLabel}>Members</Text>
      {members.length === 0 ? (
        <Text variant="caption" color="#52443A">No one added yet.</Text>
      ) : (
        members.map((m) => (
          <Card key={m.id}>
            <View style={styles.memberRow}>
              <View style={styles.memberCopy}>
                <Text variant="body">{m.person_ref}</Text>
                <Text variant="caption" color="#9F8E81">{m.role}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${m.person_ref}`}
                onPress={() => handleRemoveMember(m.id)}
                hitSlop={8}
              >
                <Text variant="caption" color="#9F8E81">✕</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}
      <View style={styles.memberAddRow}>
        <TextInput
          style={styles.memberInput}
          value={memberDraft}
          onChangeText={setMemberDraft}
          placeholder="Add a person"
          placeholderTextColor="#52443A"
          autoCapitalize="words"
          onSubmitEditing={handleAddMember}
          returnKeyType="done"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add member"
          style={[styles.memberAddBtn, !memberDraft.trim() && styles.memberAddBtnDisabled]}
          onPress={handleAddMember}
          disabled={!memberDraft.trim()}
        >
          <Text variant="caption" color="#131318">Add</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Button title="Save changes" onPress={handleSave} disabled={!canSave} />
        <Button title="Delete" variant="danger" onPress={handleDelete} />
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131318' },
  content: { padding: 20, paddingTop: 64, gap: 8 },
  center: { flex: 1, justifyContent: 'center', backgroundColor: '#131318' },
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
  membersLabel: { marginTop: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberCopy: { flex: 1 },
  memberAddRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  memberInput: {
    flex: 1,
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#E4E1E9',
    fontSize: 15,
  },
  memberAddBtn: {
    backgroundColor: '#E4572E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  memberAddBtnDisabled: { opacity: 0.4 },
  tagsBlock: { marginTop: 8 },
  actions: { marginTop: 16, gap: 10 },
});
