import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  createVaccination,
  getReminderStatus,
  listDueVaccinationReminders,
  listPets,
  listVaccinationsForPet,
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
  StatusPill,
  formatDateLabel,
  styles,
} from './_ui';

const COMMON_VACCINES = ['Rabies', 'DHPP', 'Bordetella', 'Leptospirosis', 'FVRCP'];

export default function VaccinationsScreen() {
  const db = useDatabase();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dateGiven, setDateGiven] = useState(new Date().toISOString().slice(0, 10));
  const [nextDueDate, setNextDueDate] = useState('');
  const [veterinarian, setVeterinarian] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [tick, setTick] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const pets = useMemo(() => listPets(db), [db, tick]);
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null;
  const vaccinations = useMemo(
    () => (selectedPet ? listVaccinationsForPet(db, selectedPet.id) : []),
    [db, selectedPet, tick],
  );
  const dueReminders = useMemo(
    () =>
      listDueVaccinationReminders(db, today, 60).filter(
        (reminder) => reminder.petId === selectedPet?.id,
      ),
    [db, selectedPet, tick, today],
  );
  const overdueCount = dueReminders.filter((item) => item.status === 'overdue').length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleRow}>
            <Text variant="caption" color={PETS_ACCENT}>
              Vaccinations
            </Text>
            <Text variant="heading">Schedule, due dates, and clinic notes in one view</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Keep the latest vaccine dates easy to scan and add a new dose without leaving the health flow.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>💉</Text>
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

      <SectionCard title="Coverage snapshot" subtitle="Current records and near-term alerts.">
        <View style={styles.metricRow}>
          <View style={styles.metricTile}>
            <Text style={styles.metricIcon}>📚</Text>
            <Text style={styles.metricValue}>{String(vaccinations.length)}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Records
            </Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricIcon}>⏳</Text>
            <Text style={styles.metricValue}>{String(dueReminders.length)}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Due in 60 days
            </Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricIcon}>🚨</Text>
            <Text style={styles.metricValue}>{String(overdueCount)}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Overdue
            </Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Records" subtitle="Newest doses first, with the next due date if set.">
        {vaccinations.length === 0 ? (
          <EmptyPanel
            icon="💉"
            title="No vaccinations saved"
            body="Use the form below to add the first dose and due date."
          />
        ) : (
          <View style={styles.stackedList}>
            {vaccinations.map((item) => {
              const status = item.nextDueDate
                ? getReminderStatus(item.nextDueDate, today, 30).status
                : null;
              return (
                <View key={item.id} style={styles.glassItem}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionCopy}>
                      <Text variant="body">{item.name}</Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        Given {formatDateLabel(item.dateGiven)}
                        {item.veterinarian ? ` · ${item.veterinarian}` : ''}
                      </Text>
                    </View>
                    {status ? (
                      <StatusPill
                        label={status.replace('_', ' ')}
                        tone={
                          status === 'overdue'
                            ? 'danger'
                            : status === 'due_soon'
                              ? 'warning'
                              : 'success'
                        }
                      />
                    ) : null}
                  </View>
                  <Text variant="caption" color={colors.textSecondary}>
                    Next due {formatDateLabel(item.nextDueDate)}
                    {item.lotNumber ? ` · Lot ${item.lotNumber}` : ''}
                  </Text>
                  {item.notes ? (
                    <Text variant="caption" color={colors.textSecondary}>
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard title="Add vaccination" subtitle="Use a common preset or type a custom vaccine name.">
        <View style={styles.selectorRow}>
          {COMMON_VACCINES.map((item) => (
            <SecondaryButton key={item} label={item} onPress={() => setName(item)} />
          ))}
        </View>
        <Field value={name} onChangeText={setName} placeholder="Vaccine name" />
        <Field
          value={dateGiven}
          onChangeText={setDateGiven}
          placeholder="Date given YYYY-MM-DD"
        />
        <Field
          value={nextDueDate}
          onChangeText={setNextDueDate}
          placeholder="Next due date YYYY-MM-DD"
        />
        <Field
          value={veterinarian}
          onChangeText={setVeterinarian}
          placeholder="Vet clinic or veterinarian"
        />
        <Field value={lotNumber} onChangeText={setLotNumber} placeholder="Lot or batch number" />
        <Field value={notes} onChangeText={setNotes} placeholder="Notes" multiline />
        <PrimaryButton
          label="Save Vaccination"
          onPress={() => {
            if (!selectedPet || !name.trim() || !dateGiven.trim()) {
              return;
            }

            createVaccination(db, uuid(), {
              petId: selectedPet.id,
              name: name.trim(),
              dateGiven: dateGiven.trim(),
              nextDueDate: nextDueDate.trim() || null,
              veterinarian: veterinarian.trim() || null,
              lotNumber: lotNumber.trim() || null,
              notes: notes.trim() || null,
            });
            setName('');
            setNextDueDate('');
            setVeterinarian('');
            setLotNumber('');
            setNotes('');
            setTick((value) => value + 1);
          }}
        />
      </SectionCard>
    </ScrollView>
  );
}
