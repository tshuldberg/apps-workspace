import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createFeedingSchedule,
  createFeedingLog,
  listPets,
  listFeedingSchedulesForPet,
  listFeedingLogsForDate,
  getDailyFeedingStatus,
} from '@mylife/pets';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.pets;

export default function FeedingScreen() {
  const db = useDatabase();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [label, setLabel] = useState('');
  const [foodName, setFoodName] = useState('');
  const [feedAt, setFeedAt] = useState('08:00');
  const [amount, setAmount] = useState('');

  const refresh = () => setTick((v) => v + 1);
  const pets = useMemo(() => listPets(db), [db, tick]);
  const selectedPet = pets.find((p) => p.id === selectedPetId) ?? pets[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);

  const schedules = useMemo(
    () => (selectedPet ? listFeedingSchedulesForPet(db, selectedPet.id) : []),
    [db, selectedPet, tick],
  );

  const todayLogs = useMemo(
    () => (selectedPet ? listFeedingLogsForDate(db, selectedPet.id, today) : []),
    [db, selectedPet, tick, today],
  );

  const currentTime = new Date().toTimeString().slice(0, 5);
  const feedingStatus = useMemo(
    () => (selectedPet ? getDailyFeedingStatus(schedules, todayLogs, currentTime, today) : null),
    [schedules, todayLogs, selectedPet, currentTime, today],
  );

  const handleAddSchedule = () => {
    if (!selectedPet || !label.trim() || !feedAt.trim()) return;
    createFeedingSchedule(db, uuid(), {
      petId: selectedPet.id,
      label: label.trim(),
      foodName: foodName.trim() || null,
      amount: amount.trim() || null,
      feedAt: feedAt.trim(),
    });
    setLabel('');
    setFoodName('');
    setAmount('');
    refresh();
  };

  const handleMarkFed = (scheduleId: string) => {
    if (!selectedPet) return;
    createFeedingLog(db, uuid(), {
      scheduleId,
      petId: selectedPet.id,
      date: today,
    });
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Pet selector */}
      <View style={styles.chipRow}>
        {pets.map((pet) => {
          const selected = pet.id === selectedPet?.id;
          return (
            <Pressable
              key={pet.id}
              onPress={() => setSelectedPetId(pet.id)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                {pet.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Daily overview */}
      {feedingStatus && (
        <Card>
          <Text variant="subheading">Today's Feeding</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: ACCENT }]}>
                {feedingStatus.fedCount}/{feedingStatus.totalCount}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>Meals Fed</Text>
            </View>
            <View style={styles.statCard}>
              <Text
                style={[
                  styles.statValue,
                  { color: feedingStatus.allComplete ? colors.success : '#F59E0B' },
                ]}
              >
                {feedingStatus.allComplete ? 'ALL FED' : 'PENDING'}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>Status</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Feeding schedules with mark-fed action */}
      <Card>
        <Text variant="subheading">
          {selectedPet ? `${selectedPet.name}'s Schedule` : 'Feeding Schedule'}
        </Text>
        <View style={styles.list}>
          {schedules.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No feeding schedules set up yet.
            </Text>
          ) : (
            schedules.map((schedule) => {
              const isFed = todayLogs.some((log) => log.scheduleId === schedule.id);
              return (
                <Card key={schedule.id} style={styles.innerCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.mainCopy}>
                      <Text variant="body">{schedule.label}</Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {schedule.feedAt} -- {schedule.foodName ?? 'No food specified'}
                        {schedule.amount ? ` -- ${schedule.amount}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.feedButton, isFed && styles.feedButtonDone]}
                      onPress={() => !isFed && handleMarkFed(schedule.id)}
                      disabled={isFed}
                    >
                      <Text variant="label" color={colors.background}>
                        {isFed ? 'Fed' : 'Mark Fed'}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </Card>

      {/* Add schedule form */}
      {selectedPet && (
        <Card>
          <Text variant="subheading">Add Feeding Schedule</Text>
          <View style={styles.formGrid}>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Meal label (e.g. Breakfast)"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={styles.input}
              value={foodName}
              onChangeText={setFoodName}
              placeholder="Food name (optional)"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={styles.input}
              value={feedAt}
              onChangeText={setFeedAt}
              placeholder="Feed time (HH:MM)"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="Amount (e.g. 1 cup)"
              placeholderTextColor={colors.textTertiary}
            />
            <Pressable style={styles.primaryButton} onPress={handleAddSchedule}>
              <Text variant="label" color={colors.background}>Add Schedule</Text>
            </Pressable>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm,
  },
  statCard: {
    flex: 1, minWidth: 90, padding: spacing.sm, borderRadius: 12,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  innerCard: { backgroundColor: colors.surfaceElevated },
  rowBetween: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm,
  },
  mainCopy: { flex: 1, gap: 2 },
  feedButton: {
    backgroundColor: colors.success, borderRadius: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  feedButtonDone: { backgroundColor: colors.textTertiary },
  formGrid: { gap: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
