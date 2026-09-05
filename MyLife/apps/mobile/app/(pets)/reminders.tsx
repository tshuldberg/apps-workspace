import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  collectMedicationReminders,
  listDueGroomingReminders,
  listDueMedications,
  listDueVaccinationReminders,
  listEmergencyContacts,
  listFeedingSchedulesForPet,
  listPets,
} from '@mylife/pets';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

/**
 * Run `fn` and return its result; log + return `fallback` on throw. Guards
 * each reminder section independently so a single failing query doesn't
 * crash the entire screen.
 */
function safe<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn(`[pets/reminders] ${label} failed`, err);
    return fallback;
  }
}

export default function PetsRemindersScreen() {
  const db = useDatabase();

  const pets = useMemo(() => safe('listPets', () => listPets(db), []), [db]);
  const vaccinationReminders = useMemo(
    () =>
      safe(
        'listDueVaccinationReminders',
        () => listDueVaccinationReminders(db, new Date().toISOString().slice(0, 10), 30),
        [],
      ),
    [db],
  );
  const medicationReminders = useMemo(
    () =>
      safe(
        'collectMedicationReminders',
        () =>
          collectMedicationReminders(
            pets.map((pet) => ({ id: pet.id, name: pet.name })),
            listDueMedications(db, new Date().toISOString(), 48),
            new Date().toISOString(),
            2,
          ),
        [],
      ),
    [db, pets],
  );
  const groomingReminders = useMemo(
    () =>
      safe(
        'listDueGroomingReminders',
        () => listDueGroomingReminders(db, new Date().toISOString().slice(0, 10), 14),
        [],
      ),
    [db],
  );
  const emergencyContacts = useMemo(
    () => safe('listEmergencyContacts', () => listEmergencyContacts(db), []),
    [db],
  );
  const feedings = useMemo(
    () =>
      safe(
        'listFeedingSchedulesForPet',
        () =>
          pets.flatMap((pet) =>
            listFeedingSchedulesForPet(db, pet.id).map((schedule) => ({
              petName: pet.name,
              ...schedule,
            })),
          ),
        [],
      ),
    [db, pets],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Vaccination Reminders</Text>
        <View style={styles.list}>
          {vaccinationReminders.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>No vaccines due soon.</Text>
          ) : (
            vaccinationReminders.map((reminder) => (
              <View key={reminder.vaccinationId} style={styles.row}>
                <Text variant="body">{reminder.petName}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {reminder.vaccineName} · {reminder.status} · {reminder.nextDueDate}
                </Text>
              </View>
            ))
          )}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Medication Reminders</Text>
        <View style={styles.list}>
          {medicationReminders.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>No medication reminders yet.</Text>
          ) : (
            medicationReminders.map((reminder) => (
              <View key={reminder.medicationId} style={styles.row}>
                <Text variant="body">{reminder.petName}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {reminder.medicationName} · {reminder.status} · {reminder.nextDueAt}
                </Text>
              </View>
            ))
          )}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Grooming Due Soon</Text>
        <View style={styles.list}>
          {groomingReminders.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>No grooming reminders due soon.</Text>
          ) : (
            groomingReminders.map((reminder) => (
              <View key={reminder.groomingRecordId} style={styles.row}>
                <Text variant="body">{reminder.petName}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {reminder.groomingType.replace('_', ' ')} · {reminder.status} · {reminder.nextDueDate}
                </Text>
              </View>
            ))
          )}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Feeding Schedule</Text>
        <View style={styles.list}>
          {feedings.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>No feeding schedules set.</Text>
          ) : (
            feedings.map((feeding) => (
              <View key={feeding.id} style={styles.row}>
                <Text variant="body">{feeding.petName}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {feeding.label} · {feeding.feedAt} · {feeding.foodName ?? 'Food not set'}
                </Text>
              </View>
            ))
          )}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Emergency Contacts</Text>
        <View style={styles.list}>
          {emergencyContacts.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>No emergency contacts saved yet.</Text>
          ) : (
            emergencyContacts.map((contact) => (
              <View key={contact.id} style={styles.row}>
                <Text variant="body">{contact.label}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {contact.clinicName} · {contact.phone}
                </Text>
              </View>
            ))
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
