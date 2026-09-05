import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  buildPetSitterCard,
  createEmergencyContact,
  exportPetData,
  formatPetSitterCard,
  listDueVaccinationReminders,
  listEmergencyContacts,
  listPets,
} from '@mylife/pets';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

export default function PetsSettingsScreen() {
  const db = useDatabase();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [contactLabel, setContactLabel] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((value) => value + 1);

  const pets = useMemo(() => listPets(db, { includeArchived: true }), [db, tick]);
  const selectedPet = useMemo(
    () => pets.find((pet) => pet.id === selectedPetId) ?? pets.find((pet) => !pet.isArchived) ?? pets[0] ?? null,
    [pets, selectedPetId],
  );
  const dueVaccines = useMemo(
    () => listDueVaccinationReminders(db, new Date().toISOString().slice(0, 10), 30),
    [db, tick],
  );
  const allContactsCount = useMemo(
    () => listEmergencyContacts(db).length,
    [db, tick],
  );
  const contacts = useMemo(
    () => listEmergencyContacts(db, selectedPet?.id ?? undefined),
    [db, selectedPet, tick],
  );
  const sitterCard = useMemo(
    () => (selectedPet ? buildPetSitterCard(db, selectedPet.id) : null),
    [db, selectedPet, tick],
  );
  const exportBundle = useMemo(
    () => exportPetData(db, selectedPet?.id),
    [db, selectedPet, tick],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Module Snapshot</Text>
        <View style={styles.list}>
          <Text variant="body">Active pets: {pets.filter((pet) => !pet.isArchived).length}</Text>
          <Text variant="body">Archived pets: {pets.filter((pet) => pet.isArchived).length}</Text>
          <Text variant="body">Vaccines due in 30d: {dueVaccines.length}</Text>
          <Text variant="body">Emergency contacts: {allContactsCount}</Text>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Emergency Contacts</Text>
        {selectedPet ? (
          <View style={styles.chipRow}>
            {pets
              .filter((pet) => !pet.isArchived)
              .map((pet) => {
                const selected = pet.id === selectedPet.id;
                return (
                  <Pressable
                    key={pet.id}
                    onPress={() => setSelectedPetId(pet.id)}
                    style={[styles.chip, selected ? styles.chipActive : null]}
                  >
                    <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                      {pet.name}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        ) : null}
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={contactLabel}
            onChangeText={setContactLabel}
            placeholder="Contact label"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={clinicName}
            onChangeText={setClinicName}
            placeholder="Clinic name"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              if (!contactLabel.trim() || !clinicName.trim() || !phone.trim()) {
                return;
              }

              createEmergencyContact(db, uuid(), {
                petId: selectedPet?.id ?? null,
                label: contactLabel.trim(),
                clinicName: clinicName.trim(),
                phone: phone.trim(),
                isPrimary: contacts.length === 0,
              });
              setContactLabel('');
              setClinicName('');
              setPhone('');
              refresh();
            }}
          >
            <Text variant="label" color={colors.background}>Save Contact</Text>
          </Pressable>
        </View>
        <View style={styles.list}>
          {contacts.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>No emergency contacts saved yet.</Text>
          ) : (
            contacts.map((contact) => (
              <Text key={contact.id} variant="caption" color={colors.textSecondary}>
                {contact.label} · {contact.clinicName} · {contact.phone}
              </Text>
            ))
          )}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Pet Sitter Card</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {selectedPet && sitterCard
            ? formatPetSitterCard(sitterCard)
            : 'Select a pet to generate a sitter-ready care summary.'}
        </Text>
      </Card>

      <Card>
        <Text variant="subheading">Export Preview</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Pets: {exportBundle.pets.length} · Visits: {exportBundle.vetVisits.length} · Vaccines: {exportBundle.vaccinations.length} ·
          Exercise logs: {exportBundle.exerciseLogs.length} · Grooming: {exportBundle.groomingRecords.length} ·
          Training: {exportBundle.trainingLogs.length} · Photos: {exportBundle.photos.length}
        </Text>
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
  formGrid: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: colors.modules.pets,
    borderColor: colors.modules.pets,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    backgroundColor: colors.modules.pets,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
