import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  calculateWeightTrend,
  createWeightEntry,
  listPets,
  listWeightEntriesForPet,
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
  formatWeightGrams,
  styles,
} from './_ui';

export default function WeightScreen() {
  const db = useDatabase();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [loggedAt, setLoggedAt] = useState(new Date().toISOString());
  const [notes, setNotes] = useState('');
  const [tick, setTick] = useState(0);

  const pets = useMemo(() => listPets(db), [db, tick]);
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null;
  const entries = useMemo(
    () => (selectedPet ? listWeightEntriesForPet(db, selectedPet.id) : []),
    [db, selectedPet, tick],
  );
  const trend = entries.length >= 2 ? calculateWeightTrend(entries.slice(0, 6)) : null;
  const latest = entries[0] ?? null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleRow}>
            <Text variant="caption" color={PETS_ACCENT}>
              Weight
            </Text>
            <Text variant="heading">Track trends, not just snapshots</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Keep a simple weight history with current reading, recent direction, and a lightweight visual trend.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>⚖️</Text>
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
          title={`${selectedPet.name}'s current weight`}
          subtitle="Latest logged reading with a recent direction callout."
        >
          <View style={styles.metricRow}>
            <View style={styles.metricTile}>
              <Text style={styles.metricIcon}>📈</Text>
              <Text style={styles.metricValue}>
                {latest ? formatWeightGrams(latest.weightGrams, weightUnit) : '--'}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                Latest entry
              </Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricIcon}>🧭</Text>
              <Text style={styles.metricValue}>
                {trend ? trend.direction : '--'}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                Recent direction
              </Text>
            </View>
          </View>

          {entries.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', minHeight: 120 }}>
              {entries
                .slice(0, 8)
                .reverse()
                .map((entry) => {
                  const pounds = entry.weightGrams / 453.592;
                  const height = Math.max(24, Math.min(96, pounds));
                  return (
                    <View key={entry.id} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          width: '100%',
                          height,
                          borderRadius: 14,
                          backgroundColor: 'rgba(249,115,22,0.28)',
                        }}
                      />
                      <Text variant="caption" color={colors.textSecondary}>
                        {formatDateLabel(entry.loggedAt).slice(5)}
                      </Text>
                    </View>
                  );
                })}
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {selectedPet ? (
        <SectionCard
          title="Weight history"
          subtitle="Recent entries and deltas from the previous weigh-in."
        >
          {entries.length === 0 ? (
            <EmptyPanel
              icon="📓"
              title="No weight logs yet"
              body="Use the form below to add the first reading."
            />
          ) : (
            <View style={styles.stackedList}>
              {entries.map((entry, index) => {
                const previous = entries[index + 1];
                const delta = previous
                  ? ((entry.weightGrams - previous.weightGrams) / 453.592).toFixed(1)
                  : null;
                return (
                  <View key={entry.id} style={styles.glassItem}>
                    <Text variant="body">{formatWeightGrams(entry.weightGrams, weightUnit)}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      Logged {formatDateLabel(entry.loggedAt)}
                    </Text>
                    {delta ? (
                      <Text variant="caption" color={Number(delta) >= 0 ? colors.success : colors.warning}>
                        {Number(delta) >= 0 ? '+' : ''}
                        {delta} lb from previous
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </SectionCard>
      ) : null}

      {selectedPet ? (
        <SectionCard title="Log weight" subtitle="Record a reading with the unit you prefer.">
          <View style={styles.actionRow}>
            <SecondaryButton label="Use lbs" onPress={() => setWeightUnit('lbs')} />
            <SecondaryButton label="Use kg" onPress={() => setWeightUnit('kg')} />
          </View>
          <Field
            value={weightValue}
            onChangeText={setWeightValue}
            placeholder={`Weight in ${weightUnit}`}
            keyboardType="numeric"
          />
          <Field value={loggedAt} onChangeText={setLoggedAt} placeholder="Logged at ISO timestamp" />
          <Field value={notes} onChangeText={setNotes} placeholder="Notes" multiline />
          <PrimaryButton
            label="Save Weight"
            onPress={() => {
              if (!selectedPet || !weightValue.trim()) {
                return;
              }

              const numericWeight = Number(weightValue);
              if (Number.isNaN(numericWeight) || numericWeight <= 0) {
                return;
              }

              createWeightEntry(db, uuid(), {
                petId: selectedPet.id,
                weightGrams: Math.round(
                  weightUnit === 'kg' ? numericWeight * 1000 : numericWeight * 453.592,
                ),
                loggedAt: loggedAt.trim() || new Date().toISOString(),
                notes: notes.trim() || null,
              });
              setTick((value) => value + 1);
              setWeightValue('');
              setNotes('');
            }}
          />
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}
