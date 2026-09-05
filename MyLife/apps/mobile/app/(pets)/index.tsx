import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createPetPhoto,
  getBreedHealthAlerts,
  getPetDashboard,
  listDueGroomingReminders,
  listDueMedications,
  listDueVaccinationReminders,
  listExpensesForPet,
  listPetPhotosForPet,
  listPets,
} from '@mylife/pets';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  EmptyPanel,
  Field,
  MetricTile,
  PETS_ACCENT,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
  formatCurrencyCents,
  formatDateLabel,
  formatPetAge,
  getPetSpeciesMeta,
  styles,
} from './_ui';

type UpcomingItem = {
  id: string;
  petName: string;
  title: string;
  detail: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
};

export default function PetsHomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [tick, setTick] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const monthKey = today.slice(0, 7);
  const pets = useMemo(() => listPets(db, { includeArchived: true }), [db, tick]);
  const activePets = pets.filter((pet) => !pet.isArchived);
  const selectedPet =
    activePets.find((pet) => pet.id === selectedPetId) ?? activePets[0] ?? null;
  const selectedDashboard = useMemo(
    () => (selectedPet ? getPetDashboard(db, selectedPet.id) : null),
    [db, selectedPet, tick],
  );
  const monthlySpend = useMemo(
    () =>
      activePets.reduce((sum, pet) => {
        return (
          sum +
          listExpensesForPet(db, pet.id).reduce((expenseSum, item) => {
            return item.spentOn.startsWith(monthKey)
              ? expenseSum + item.amountCents
              : expenseSum;
          }, 0)
        );
      }, 0),
    [activePets, db, monthKey, tick],
  );
  const dueVaccines = useMemo(
    () => listDueVaccinationReminders(db, today, 30),
    [db, tick, today],
  );
  const dueMeds = useMemo(() => listDueMedications(db, now, 48), [db, tick, now]);
  const dueGrooming = useMemo(
    () => listDueGroomingReminders(db, today, 14),
    [db, tick, today],
  );
  const photos = useMemo(
    () => (selectedPet ? listPetPhotosForPet(db, selectedPet.id, 4) : []),
    [db, selectedPet, tick],
  );
  const breedAlerts = useMemo(
    () => (selectedPet ? getBreedHealthAlerts(selectedPet.species, selectedPet.breed) : []),
    [selectedPet],
  );

  const upcomingItems: UpcomingItem[] = [
    ...dueVaccines.slice(0, 3).map((item) => ({
      id: item.vaccinationId,
      petName: item.petName,
      title: item.vaccineName,
      detail: `Vaccine due ${formatDateLabel(item.nextDueDate)}`,
      tone:
        item.status === 'overdue'
          ? 'danger'
          : item.status === 'due_soon'
            ? 'warning'
            : 'success',
    }) satisfies UpcomingItem),
    ...dueMeds.slice(0, 3).map((item) => ({
      id: item.id,
      petName: activePets.find((pet) => pet.id === item.petId)?.name ?? 'Pet',
      title: item.name,
      detail: `Medication due ${formatDateLabel(item.nextDueAt)}`,
      tone: item.nextDueAt && item.nextDueAt < now ? 'danger' : 'warning',
    }) satisfies UpcomingItem),
    ...dueGrooming.slice(0, 2).map((item) => ({
      id: item.groomingRecordId,
      petName: item.petName,
      title: item.groomingType.replaceAll('_', ' '),
      detail: `Grooming due ${formatDateLabel(item.nextDueDate)}`,
      tone:
        item.status === 'overdue'
          ? 'danger'
          : item.status === 'due_soon'
            ? 'warning'
            : 'success',
    }) satisfies UpcomingItem),
  ].slice(0, 6);

  if (activePets.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyPanel
          icon="🐾"
          title="Create your first pet profile"
          body="Add a pet to unlock health tracking, medications, visits, expenses, and lost-pet tools."
        />
        <PrimaryButton label="Add Pet" onPress={() => router.push('/(pets)/pet/add')} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleRow}>
            <Text variant="caption" color={PETS_ACCENT}>
              MyPets Home
            </Text>
            <Text variant="heading">Every pet’s care status in one place</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Scan upcoming reminders, jump into key care flows, and keep photo notes close to the household overview.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>🐾</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xs }}
        >
          {activePets.map((pet) => {
            const active = pet.id === selectedPet?.id;
            const dashboard = getPetDashboard(db, pet.id);
            if (!dashboard) {
              return null;
            }
            return (
              <Pressable
                key={pet.id}
                onPress={() => setSelectedPetId(pet.id)}
                style={[
                  styles.glassItem,
                  {
                    width: 232,
                    borderColor: active ? PETS_ACCENT : colors.glassBorder,
                  },
                ]}
              >
                <Text variant="body">
                  {getPetSpeciesMeta(pet.species).icon} {pet.name}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {pet.breed ?? 'Breed not set'} · {formatPetAge(pet.birthDate)}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {dashboard.dueVaccinations} vaccines · {dashboard.dueMedications} meds
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  Next feeding {dashboard.nextFeedingAt ?? 'not scheduled'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.metricRow}>
          <MetricTile icon="🐾" label="Pets" value={String(activePets.length)} />
          <MetricTile icon="🔔" label="Upcoming" value={String(upcomingItems.length)} />
          <MetricTile
            icon="💸"
            label="This Month"
            value={formatCurrencyCents(monthlySpend)}
          />
        </View>

        <View style={styles.actionRow}>
          <PrimaryButton label="Add Pet" onPress={() => router.push('/(pets)/pet/add')} />
          <SecondaryButton
            label="Log Vet Visit"
            onPress={() => router.push('/(pets)/vet-history')}
          />
          <SecondaryButton
            label="Add Medication"
            onPress={() => router.push('/(pets)/medications')}
          />
        </View>
      </View>

      {selectedPet && selectedDashboard ? (
        <SectionCard
          title={`${selectedPet.name} snapshot`}
          subtitle={`${formatPetAge(selectedPet.birthDate)} · ${selectedPet.breed ?? 'Breed not set'}`}
          action={
            <SecondaryButton
              label="Open Profile"
              onPress={() => router.push(`/(pets)/pet/${selectedPet.id}`)}
            />
          }
        >
          <View style={styles.metricRow}>
            <MetricTile
              icon="💉"
              label="Vaccines Due"
              value={String(selectedDashboard.dueVaccinations)}
            />
            <MetricTile
              icon="💊"
              label="Medications Due"
              value={String(selectedDashboard.dueMedications)}
            />
            <MetricTile
              icon="⚖️"
              label="Latest Weight"
              value={selectedDashboard.latestWeightGrams ? `${(selectedDashboard.latestWeightGrams / 453.592).toFixed(1)} lb` : '--'}
            />
          </View>
          <View style={styles.stackedList}>
            <View style={styles.glassItem}>
              <Text variant="body">Recent care context</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Last vet visit {selectedDashboard.lastVetVisitDate ?? 'not logged'} · next grooming {selectedDashboard.nextGroomingDueDate ?? 'not set'}
              </Text>
            </View>
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Next due items" subtitle="Upcoming vaccines, medication doses, and grooming windows.">
        {upcomingItems.length === 0 ? (
          <EmptyPanel
            icon="✅"
            title="Nothing urgent"
            body="The current household record does not show any near-term care reminders."
          />
        ) : (
          <View style={styles.stackedList}>
            {upcomingItems.map((item) => (
              <View key={item.id} style={styles.glassItem}>
                <Text variant="body">{item.petName}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {item.title}
                </Text>
                <Text
                  variant="caption"
                  color={
                    item.tone === 'danger'
                      ? colors.danger
                      : item.tone === 'warning'
                        ? colors.warning
                        : colors.success
                  }
                >
                  {item.detail}
                </Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {selectedPet ? (
        <SectionCard
          title="Moments and alerts"
          subtitle="Keep photo notes and breed-specific reminders attached to the selected pet."
        >
          <Field
            value={photoUri}
            onChangeText={setPhotoUri}
            placeholder="Local photo URI"
          />
          <Field
            value={photoCaption}
            onChangeText={setPhotoCaption}
            placeholder="Caption or milestone"
          />
          <PrimaryButton
            label="Save Photo Note"
            onPress={() => {
              if (!selectedPet || !photoUri.trim()) {
                return;
              }

              createPetPhoto(db, uuid(), {
                petId: selectedPet.id,
                imageUri: photoUri.trim(),
                caption: photoCaption.trim() || null,
              });
              setPhotoUri('');
              setPhotoCaption('');
              setTick((value) => value + 1);
            }}
          />
          {photos.length > 0 ? (
            <View style={styles.stackedList}>
              {photos.map((photo) => (
                <View key={photo.id} style={styles.glassItem}>
                  <Text variant="body">{photo.caption ?? 'Photo note'}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {photo.imageUri}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {breedAlerts.length > 0 ? (
            <View style={styles.stackedList}>
              {breedAlerts.slice(0, 3).map((alert) => (
                <View key={alert.id} style={styles.glassItem}>
                  <Text variant="body">{alert.condition}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {alert.severity} · {alert.description}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}
