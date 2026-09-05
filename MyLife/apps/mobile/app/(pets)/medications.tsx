import { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import {
  createMedication,
  listDueMedications,
  listMedicationLogs,
  listMedicationsForPet,
  listPets,
  recordMedicationLog,
  type MedicationFrequency,
} from '@mylife/pets';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  EmptyPanel,
  Field,
  PETS_ACCENT,
  PetSelector,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
  formatDateLabel,
  styles,
} from './_ui';

const FREQUENCIES: MedicationFrequency[] = [
  'daily',
  'twice_daily',
  'weekly',
  'monthly',
  'every_n_days',
  'as_needed',
];

export default function MedicationsScreen() {
  const db = useDatabase();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<MedicationFrequency>('daily');
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState('');
  const [prescribedBy, setPrescribedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [tick, setTick] = useState(0);

  const pets = useMemo(() => listPets(db), [db, tick]);
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null;
  const medications = useMemo(
    () => (selectedPet ? listMedicationsForPet(db, selectedPet.id, true) : []),
    [db, selectedPet, tick],
  );
  const dueMedications = useMemo(
    () =>
      listDueMedications(db, new Date().toISOString(), 48).filter(
        (medication) => medication.petId === selectedPet?.id,
      ),
    [db, selectedPet, tick],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleRow}>
            <Text variant="caption" color={PETS_ACCENT}>
              Medications
            </Text>
            <Text variant="heading">Daily, weekly, and as-needed meds</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Keep active prescriptions, next doses, and recent dose logs visible without opening another app.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>💊</Text>
          </View>
        </View>
        {pets.length > 0 ? (
          <PetSelector
            pets={pets}
            selectedPetId={selectedPet?.id ?? null}
            onSelect={setSelectedPetId}
          />
        ) : null}
      </View>

      <SectionCard
        title="Today's doses"
        subtitle="Medication entries due within the next 48 hours."
      >
        {dueMedications.length === 0 ? (
          <EmptyPanel
            icon="🕒"
            title="No doses due soon"
            body="Active medications are either current or have no upcoming due time set."
          />
        ) : (
          <View style={styles.stackedList}>
            {dueMedications.map((medication) => (
              <View key={medication.id} style={styles.glassItem}>
                <Text variant="body">{medication.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {medication.dosage ?? 'No dosage'} · {formatDateLabel(medication.nextDueAt)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {selectedPet ? (
        <SectionCard
          title={`${selectedPet.name}'s medications`}
          subtitle="Active and recent prescriptions with quick dose logging."
        >
          {medications.length === 0 ? (
            <EmptyPanel
              icon="📋"
              title="No medications yet"
              body="Add an active medication below when the first prescription starts."
            />
          ) : (
            <View style={styles.stackedList}>
              {medications.map((medication) => {
                const logs = listMedicationLogs(db, medication.id, 3);
                return (
                  <View key={medication.id} style={styles.glassItem}>
                    <Text variant="body">{medication.name}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {medication.frequency.replaceAll('_', ' ')}
                      {medication.dosage ? ` · ${medication.dosage}` : ''}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      Started {formatDateLabel(medication.startsOn)}
                      {medication.endsOn ? ` · ends ${formatDateLabel(medication.endsOn)}` : ''}
                    </Text>
                    {logs.length > 0 ? (
                      <Text variant="caption" color={colors.textSecondary}>
                        Last log {formatDateLabel(logs[0].loggedAt)} · {logs[0].status}
                      </Text>
                    ) : null}
                    <View style={styles.actionRow}>
                      <SecondaryButton
                        label="Mark Given"
                        onPress={() => {
                          recordMedicationLog(db, {
                            medicationId: medication.id,
                            status: 'given',
                            loggedAt: new Date().toISOString(),
                          });
                          setTick((value) => value + 1);
                        }}
                      />
                      <SecondaryButton
                        label="Skip"
                        onPress={() => {
                          recordMedicationLog(db, {
                            medicationId: medication.id,
                            status: 'skipped',
                            loggedAt: new Date().toISOString(),
                          });
                          setTick((value) => value + 1);
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </SectionCard>
      ) : null}

      {selectedPet ? (
        <SectionCard
          title="Add medication"
          subtitle="Create a schedule and start logging doses right away."
        >
          <View style={styles.selectorRow}>
            {FREQUENCIES.map((item) => (
              <SecondaryButton
                key={item}
                label={item.replaceAll('_', ' ')}
                onPress={() => setFrequency(item)}
              />
            ))}
          </View>
          <Field value={name} onChangeText={setName} placeholder="Medication name" />
          <Field value={dosage} onChangeText={setDosage} placeholder="Dosage" />
          <Field value={startsOn} onChangeText={setStartsOn} placeholder="Start date YYYY-MM-DD" />
          <Field value={endsOn} onChangeText={setEndsOn} placeholder="End date (optional)" />
          <Field value={prescribedBy} onChangeText={setPrescribedBy} placeholder="Prescribed by" />
          <Field value={notes} onChangeText={setNotes} placeholder="Instructions or notes" multiline />
          <PrimaryButton
            label="Save Medication"
            onPress={() => {
              if (!selectedPet || !name.trim()) {
                Alert.alert('Missing fields', 'Medication name is required.');
                return;
              }

              createMedication(db, uuid(), {
                petId: selectedPet.id,
                name: name.trim(),
                dosage: dosage.trim() || null,
                frequency,
                startsOn: startsOn.trim(),
                endsOn: endsOn.trim() || null,
                prescribedBy: prescribedBy.trim() || null,
                notes: notes.trim() || null,
              });
              setTick((value) => value + 1);
              setName('');
              setDosage('');
              setEndsOn('');
              setPrescribedBy('');
              setNotes('');
            }}
          />
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}
