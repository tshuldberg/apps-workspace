import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getPetDashboard, listPets, updatePet } from '@mylife/pets';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  EmptyPanel,
  PETS_ACCENT,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
  formatPetAge,
  getPetSpeciesMeta,
  styles,
} from './_ui';

export default function PetsListScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const pets = useMemo(() => listPets(db, { includeArchived: true }), [db, tick]);
  const activePets = pets.filter((pet) => !pet.isArchived);
  const selectedPet =
    pets.find((pet) => pet.id === selectedPetId) ?? activePets[0] ?? pets[0] ?? null;
  const dashboard = useMemo(
    () => (selectedPet ? getPetDashboard(db, selectedPet.id) : null),
    [db, selectedPet, tick],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleRow}>
            <Text variant="caption" color={PETS_ACCENT}>
              My Pets
            </Text>
            <Text variant="heading">Profiles for every animal in the household</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Keep the roster tidy, open detail views fast, and archive old profiles without losing the record history.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>🐶</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <PrimaryButton label="Add Pet" onPress={() => router.push('/(pets)/pet/add')} />
          <SecondaryButton
            label="Emergency"
            onPress={() => router.push('/(pets)/emergency')}
          />
          <SecondaryButton
            label="Lost Poster"
            onPress={() => router.push('/(pets)/poster')}
          />
        </View>
      </View>

      <SectionCard
        title="Pet roster"
        subtitle={`${activePets.length} active pet${activePets.length === 1 ? '' : 's'} on file`}
      >
        {pets.length === 0 ? (
          <EmptyPanel
            icon="🐾"
            title="No pets saved yet"
            body="Use Add Pet to create the first household profile."
          />
        ) : (
          <View style={styles.stackedList}>
            {pets.map((pet) => {
              const active = pet.id === selectedPet?.id;
              return (
                <Pressable
                  key={pet.id}
                  onPress={() => setSelectedPetId(pet.id)}
                  style={[
                    styles.glassItem,
                    {
                      borderColor: active ? PETS_ACCENT : colors.glassBorder,
                    },
                  ]}
                >
                  <Text variant="body">
                    {getPetSpeciesMeta(pet.species).icon} {pet.name}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {getPetSpeciesMeta(pet.species).label}
                    {pet.breed ? ` · ${pet.breed}` : ''}
                    {` · ${formatPetAge(pet.birthDate)}`}
                    {pet.isArchived ? ' · archived' : ''}
                  </Text>
                  <View style={styles.actionRow}>
                    <SecondaryButton
                      label="Open"
                      onPress={() => router.push(`/(pets)/pet/${pet.id}`)}
                    />
                    <SecondaryButton
                      label={pet.isArchived ? 'Restore' : 'Archive'}
                      onPress={() => {
                        Alert.alert(
                          pet.isArchived ? 'Restore profile?' : 'Archive profile?',
                          pet.isArchived
                            ? 'This pet will return to the active roster.'
                            : 'The profile will stay in storage but leave the active roster.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: pet.isArchived ? 'Restore' : 'Archive',
                              onPress: () => {
                                updatePet(db, pet.id, { isArchived: !pet.isArchived });
                                setTick((value) => value + 1);
                              },
                            },
                          ],
                        );
                      }}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </SectionCard>

      {selectedPet && dashboard ? (
        <SectionCard
          title={`${selectedPet.name} detail preview`}
          subtitle="A quick summary before opening the full profile."
        >
          <View style={styles.metricRow}>
            <View style={styles.metricTile}>
              <Text style={styles.metricIcon}>💉</Text>
              <Text style={styles.metricValue}>{String(dashboard.dueVaccinations)}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Vaccines due
              </Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricIcon}>💊</Text>
              <Text style={styles.metricValue}>{String(dashboard.dueMedications)}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Medications due
              </Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricIcon}>💸</Text>
              <Text style={styles.metricValue}>${(dashboard.totalExpensesCents / 100).toFixed(0)}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Total spend
              </Text>
            </View>
          </View>
          <PrimaryButton
            label="Open Full Profile"
            onPress={() => router.push(`/(pets)/pet/${selectedPet.id}`)}
          />
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}
