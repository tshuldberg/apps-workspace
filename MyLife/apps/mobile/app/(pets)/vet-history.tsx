import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  createVetVisit,
  listPets,
  listVetVisitsForPet,
  type VetVisitType,
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
  formatCurrencyCents,
  formatDateLabel,
  styles,
} from './_ui';

const VISIT_TYPES: VetVisitType[] = [
  'wellness',
  'sick',
  'emergency',
  'dental',
  'surgery',
  'other',
];

export default function VetVisitsScreen() {
  const db = useDatabase();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [visitType, setVisitType] = useState<VetVisitType>('wellness');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [veterinarian, setVeterinarian] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [tick, setTick] = useState(0);

  const pets = useMemo(() => listPets(db), [db, tick]);
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null;
  const visits = useMemo(
    () => (selectedPet ? listVetVisitsForPet(db, selectedPet.id) : []),
    [db, selectedPet, tick],
  );
  const yearlyCost = visits.reduce((sum, visit) => sum + (visit.costCents ?? 0), 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleRow}>
            <Text variant="caption" color={PETS_ACCENT}>
              Vet Visits
            </Text>
            <Text variant="heading">Every consult and follow-up in one timeline</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Capture diagnosis, treatment, cost, and who saw the pet without losing the quick-summary view.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>🩺</Text>
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

      {selectedPet ? (
        <SectionCard
          title={`${selectedPet.name}'s visit log`}
          subtitle={`${visits.length} visits · ${formatCurrencyCents(yearlyCost)} total logged`}
        >
          {visits.length === 0 ? (
            <EmptyPanel
              icon="🏥"
              title="No visits yet"
              body="Add the first appointment below to start the care timeline."
            />
          ) : (
            <View style={styles.stackedList}>
              {visits.map((visit) => (
                <View key={visit.id} style={styles.glassItem}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="body">{visit.reason}</Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {formatDateLabel(visit.visitDate)}
                        {visit.veterinarian ? ` · ${visit.veterinarian}` : ''}
                      </Text>
                      {visit.diagnosis ? (
                        <Text variant="caption" color={colors.textSecondary}>
                          Diagnosis: {visit.diagnosis}
                        </Text>
                      ) : null}
                      {visit.treatment ? (
                        <Text variant="caption" color={colors.textSecondary}>
                          Treatment: {visit.treatment}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <StatusPill
                        label={visit.visitType}
                        tone={visit.visitType === 'emergency' ? 'danger' : 'default'}
                      />
                      {visit.costCents ? (
                        <Text variant="caption" color={PETS_ACCENT}>
                          {formatCurrencyCents(visit.costCents)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </SectionCard>
      ) : null}

      {selectedPet ? (
        <SectionCard
          title="Add visit"
          subtitle="Reason, provider, treatment, and cost."
        >
          <View style={styles.selectorRow}>
            {VISIT_TYPES.map((item) => (
              <SecondaryButton
                key={item}
                label={item}
                onPress={() => setVisitType(item)}
              />
            ))}
          </View>
          <Field value={visitDate} onChangeText={setVisitDate} placeholder="Visit date YYYY-MM-DD" />
          <Field value={reason} onChangeText={setReason} placeholder="Reason for visit" />
          <Field value={clinicName} onChangeText={setClinicName} placeholder="Clinic name" />
          <Field value={veterinarian} onChangeText={setVeterinarian} placeholder="Veterinarian" />
          <Field value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnosis" multiline />
          <Field value={treatment} onChangeText={setTreatment} placeholder="Treatment plan" multiline />
          <Field value={cost} onChangeText={setCost} placeholder="Cost in dollars" keyboardType="numeric" />
          <Field value={notes} onChangeText={setNotes} placeholder="Notes" multiline />
          <PrimaryButton
            label="Save Visit"
            onPress={() => {
              if (!selectedPet || !reason.trim()) {
                return;
              }

              createVetVisit(db, uuid(), {
                petId: selectedPet.id,
                visitDate: visitDate.trim(),
                visitType,
                reason: reason.trim(),
                clinicName: clinicName.trim() || null,
                veterinarian: veterinarian.trim() || null,
                diagnosis: diagnosis.trim() || null,
                treatment: treatment.trim() || null,
                costCents: cost.trim() ? Math.round(Number(cost) * 100) : null,
                notes: notes.trim() || null,
              });
              setTick((value) => value + 1);
              setReason('');
              setClinicName('');
              setVeterinarian('');
              setDiagnosis('');
              setTreatment('');
              setCost('');
              setNotes('');
            }}
          />
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}
