import { useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { listPetPhotosForPet, listPets } from '@mylife/pets';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  EmptyPanel,
  Field,
  PETS_ACCENT,
  PetSelector,
  PrimaryButton,
  SectionCard,
  formatDateLabel,
  formatPetSpecies,
  getPetSpeciesMeta,
  styles,
} from './_ui';

export default function LostPosterScreen() {
  const db = useDatabase();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [lastSeenLocation, setLastSeenLocation] = useState('');
  const [lastSeenDate, setLastSeenDate] = useState(new Date().toISOString().slice(0, 10));
  const [contactPhone, setContactPhone] = useState('');
  const [rewardAmount, setRewardAmount] = useState('');
  const [notes, setNotes] = useState('');

  const pets = useMemo(() => listPets(db), [db]);
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null;
  const photos = useMemo(
    () => (selectedPet ? listPetPhotosForPet(db, selectedPet.id, 1) : []),
    [db, selectedPet],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleRow}>
            <Text variant="caption" color={PETS_ACCENT}>
              Lost Pet Poster
            </Text>
            <Text variant="heading">Build a share-ready alert in minutes</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Pull in pet basics, last seen details, and a clear contact line so you can move fast when it matters.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>📣</Text>
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
        <SectionCard title="Poster preview" subtitle="A simple, high-signal summary for neighbors and social posts.">
          <View style={[styles.glassItem, { alignItems: 'center', paddingVertical: 24 }]}>
            <Text variant="caption" color={colors.danger}>
              LOST
            </Text>
            <Text style={{ fontSize: 54, lineHeight: 60 }}>
              {getPetSpeciesMeta(selectedPet.species).icon}
            </Text>
            <Text variant="heading">{selectedPet.name}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {formatPetSpecies(selectedPet.species)}
              {selectedPet.breed ? ` · ${selectedPet.breed}` : ''}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              Last seen {formatDateLabel(lastSeenDate)} · {lastSeenLocation || 'Set a last seen location'}
            </Text>
            <Text variant="caption" color={PETS_ACCENT}>
              {contactPhone || 'Add a contact phone'}
            </Text>
            {rewardAmount ? (
              <Text variant="caption" color={colors.warning}>
                Reward {rewardAmount}
              </Text>
            ) : null}
            {photos[0]?.caption ? (
              <Text variant="caption" color={colors.textSecondary}>
                Latest photo note: {photos[0].caption}
              </Text>
            ) : null}
          </View>
        </SectionCard>
      ) : (
        <EmptyPanel
          icon="🐾"
          title="No pet selected"
          body="Create a pet profile before building a poster."
        />
      )}

      <SectionCard title="Poster details" subtitle="Last seen context and contact information.">
        <Field value={lastSeenLocation} onChangeText={setLastSeenLocation} placeholder="Last seen location" />
        <Field value={lastSeenDate} onChangeText={setLastSeenDate} placeholder="Last seen date YYYY-MM-DD" />
        <Field value={contactPhone} onChangeText={setContactPhone} placeholder="Contact phone" />
        <Field value={rewardAmount} onChangeText={setRewardAmount} placeholder="Reward (optional)" />
        <Field value={notes} onChangeText={setNotes} placeholder="Distinguishing features" multiline />
        <PrimaryButton
          label="Share Poster Copy"
          onPress={() => {
            if (!selectedPet || !contactPhone.trim()) {
              return;
            }

            void Share.share({
              message: [
                `LOST PET: ${selectedPet.name}`,
                `${formatPetSpecies(selectedPet.species)}${selectedPet.breed ? ` · ${selectedPet.breed}` : ''}`,
                `Last seen: ${lastSeenLocation || 'Unknown location'} on ${formatDateLabel(lastSeenDate)}`,
                rewardAmount ? `Reward: ${rewardAmount}` : null,
                notes.trim() || null,
                `Contact: ${contactPhone.trim()}`,
              ]
                .filter(Boolean)
                .join('\n'),
            });
          }}
        />
      </SectionCard>
    </ScrollView>
  );
}
