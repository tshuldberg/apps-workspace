import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  deletePet,
  getPetById,
  getPetDashboard,
  getPrimaryEmergencyContact,
  listMedicationsForPet,
  listVaccinationsForPet,
  listVetVisitsForPet,
  listWeightEntriesForPet,
  updatePet,
} from '@mylife/pets';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  EmptyPanel,
  Field,
  PETS_ACCENT,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
  formatDateLabel,
  formatPetAge,
  formatPetSpecies,
  formatWeightGrams,
  getPetSpeciesMeta,
  styles,
} from '../_ui';

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const petId = Array.isArray(id) ? id[0] : id;
  const db = useDatabase();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const pet = useMemo(() => (petId ? getPetById(db, petId) : null), [db, petId]);
  const dashboard = useMemo(
    () => (pet ? getPetDashboard(db, pet.id) : null),
    [db, pet],
  );
  const visits = useMemo(() => (pet ? listVetVisitsForPet(db, pet.id, 3) : []), [db, pet]);
  const vaccinations = useMemo(
    () => (pet ? listVaccinationsForPet(db, pet.id, 3) : []),
    [db, pet],
  );
  const medications = useMemo(
    () => (pet ? listMedicationsForPet(db, pet.id, true, 3) : []),
    [db, pet],
  );
  const weights = useMemo(
    () => (pet ? listWeightEntriesForPet(db, pet.id, 5) : []),
    [db, pet],
  );
  const primaryContact = useMemo(
    () => (pet ? getPrimaryEmergencyContact(db, pet.id) : null),
    [db, pet],
  );
  const [name, setName] = useState(pet?.name ?? '');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [notes, setNotes] = useState(pet?.notes ?? '');

  if (!pet) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyPanel
          icon="🐾"
          title="Pet not found"
          body="The profile you opened no longer exists in the local database."
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleRow}>
            <Text variant="caption" color={PETS_ACCENT}>
              Pet Profile
            </Text>
            <Text variant="heading">{pet.name}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {formatPetSpecies(pet.species)}
              {pet.breed ? ` · ${pet.breed}` : ''}
              {` · ${formatPetAge(pet.birthDate)}`}
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{getPetSpeciesMeta(pet.species).icon}</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <PrimaryButton
            label="Edit Profile"
            onPress={() => setEditing((value) => !value)}
          />
          <SecondaryButton
            label="Add Vet Visit"
            onPress={() => router.push('/(pets)/vet-history')}
          />
          <SecondaryButton
            label="Add Vaccine"
            onPress={() => router.push('/(pets)/vaccinations')}
          />
          <SecondaryButton
            label="Log Weight"
            onPress={() => router.push('/(pets)/weight')}
          />
        </View>
      </View>

      <SectionCard title="Overview" subtitle="Identity, reminders, and care snapshot.">
        <View style={styles.stackedList}>
          <View style={styles.glassItem}>
            <Text variant="caption" color={colors.textSecondary}>
              Weight
            </Text>
            <Text variant="body">
              {dashboard ? formatWeightGrams(dashboard.latestWeightGrams) : '--'}
            </Text>
          </View>
          <View style={styles.glassItem}>
            <Text variant="caption" color={colors.textSecondary}>
              Upcoming reminders
            </Text>
            <Text variant="body">
              {dashboard ? `${dashboard.dueVaccinations} vaccines · ${dashboard.dueMedications} medications` : '--'}
            </Text>
          </View>
          <View style={styles.glassItem}>
            <Text variant="caption" color={colors.textSecondary}>
              Emergency contact
            </Text>
            <Text variant="body">
              {primaryContact ? `${primaryContact.clinicName} · ${primaryContact.phone}` : 'No primary contact'}
            </Text>
          </View>
        </View>
      </SectionCard>

      {editing ? (
        <SectionCard title="Edit profile" subtitle="Update the most important pet details.">
          <Field value={name} onChangeText={setName} placeholder="Pet name" />
          <Field value={breed} onChangeText={setBreed} placeholder="Breed" />
          <Field value={notes} onChangeText={setNotes} placeholder="Notes" multiline />
          <View style={styles.actionRow}>
            <SecondaryButton label="Cancel" onPress={() => setEditing(false)} />
            <PrimaryButton
              label="Save Changes"
              onPress={() => {
                updatePet(db, pet.id, {
                  name: name.trim() || pet.name,
                  breed: breed.trim() || null,
                  notes: notes.trim() || null,
                });
                setEditing(false);
              }}
            />
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Recent care" subtitle="Visits, vaccines, medications, and weight.">
        <View style={styles.stackedList}>
          {visits.map((visit) => (
            <View key={visit.id} style={styles.glassItem}>
              <Text variant="body">{visit.reason}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {visit.visitType} · {formatDateLabel(visit.visitDate)}
              </Text>
            </View>
          ))}
          {vaccinations.map((vaccination) => (
            <View key={vaccination.id} style={styles.glassItem}>
              <Text variant="body">{vaccination.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Next due {formatDateLabel(vaccination.nextDueDate)}
              </Text>
            </View>
          ))}
          {medications.map((medication) => (
            <View key={medication.id} style={styles.glassItem}>
              <Text variant="body">{medication.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {medication.frequency.replaceAll('_', ' ')} · {formatDateLabel(medication.nextDueAt)}
              </Text>
            </View>
          ))}
          {weights.map((entry) => (
            <View key={entry.id} style={styles.glassItem}>
              <Text variant="body">{formatWeightGrams(entry.weightGrams)}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Logged {formatDateLabel(entry.loggedAt)}
              </Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Danger zone" subtitle="Delete the full profile and linked records.">
        <PrimaryButton
          label="Delete Pet"
          onPress={() => {
            Alert.alert(
              'Delete pet?',
              'This removes the profile and linked records from the module database.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deletePet(db, pet.id);
                    router.replace('/(pets)/pets');
                  },
                },
              ],
            );
          }}
        />
      </SectionCard>
    </ScrollView>
  );
}
