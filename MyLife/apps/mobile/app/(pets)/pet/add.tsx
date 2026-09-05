import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createPet, type PetSex, type PetSpecies } from '@mylife/pets';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  Field,
  PETS_ACCENT,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
  getPetSpeciesMeta,
  styles,
} from '../_ui';

const SPECIES: PetSpecies[] = [
  'dog',
  'cat',
  'bird',
  'fish',
  'reptile',
  'rabbit',
  'small_mammal',
  'horse',
  'other',
];

const SEXES: PetSex[] = ['female', 'male', 'unknown'];

export default function AddPetScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('dog');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [colorMarkings, setColorMarkings] = useState('');
  const [microchipId, setMicrochipId] = useState('');
  const [sex, setSex] = useState<PetSex>('unknown');
  const [notes, setNotes] = useState('');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleRow}>
            <Text variant="caption" color={PETS_ACCENT}>
              Add Pet
            </Text>
            <Text variant="heading">Create a new care profile</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Capture the essentials once, then keep care records, reminders, and expenses linked to the same pet.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{getPetSpeciesMeta(species).icon}</Text>
          </View>
        </View>
      </View>

      <SectionCard title="Profile" subtitle="Name, species, and baseline details.">
        <Field value={name} onChangeText={setName} placeholder="Pet name" />
        <View style={styles.selectorRow}>
          {SPECIES.map((item) => {
            const active = item === species;
            return (
              <SecondaryButton
                key={item}
                label={`${getPetSpeciesMeta(item).icon} ${getPetSpeciesMeta(item).label}`}
                onPress={() => setSpecies(item)}
              />
            );
          })}
        </View>
        <View style={styles.stackedList}>
          <Field value={breed} onChangeText={setBreed} placeholder="Breed" />
          <Field
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="Birthday YYYY-MM-DD"
          />
        </View>
      </SectionCard>

      <SectionCard title="Attributes" subtitle="Weight, markings, and identifiers.">
        <View style={styles.actionRow}>
          <SecondaryButton
            label={weightUnit === 'lbs' ? 'Weight in lbs' : 'Switch to lbs'}
            onPress={() => setWeightUnit('lbs')}
          />
          <SecondaryButton
            label={weightUnit === 'kg' ? 'Weight in kg' : 'Switch to kg'}
            onPress={() => setWeightUnit('kg')}
          />
        </View>
        <Field
          value={weightValue}
          onChangeText={setWeightValue}
          placeholder={`Current weight (${weightUnit})`}
          keyboardType="numeric"
        />
        <Field
          value={colorMarkings}
          onChangeText={setColorMarkings}
          placeholder="Color and markings"
        />
        <Field
          value={microchipId}
          onChangeText={setMicrochipId}
          placeholder="Microchip ID"
        />
      </SectionCard>

      <SectionCard title="Notes" subtitle="Quick context for the whole household.">
        <View style={styles.selectorRow}>
          {SEXES.map((item) => (
            <SecondaryButton
              key={item}
              label={item.charAt(0).toUpperCase() + item.slice(1)}
              onPress={() => setSex(item)}
            />
          ))}
        </View>
        <Field
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes, temperament, or intake details"
          multiline
        />
      </SectionCard>

      <View style={styles.actionRow}>
        <SecondaryButton label="Cancel" onPress={() => router.back()} />
        <PrimaryButton
          label="Save Pet"
          onPress={() => {
            if (!name.trim()) {
              return;
            }

            const id = uuid();
            const numericWeight = Number(weightValue);
            const combinedNotes = [
              notes.trim(),
              colorMarkings.trim() ? `Color/markings: ${colorMarkings.trim()}` : '',
            ]
              .filter(Boolean)
              .join('\n\n');
            createPet(db, id, {
              name: name.trim(),
              species,
              breed: breed.trim() || null,
              birthDate: birthDate.trim() || null,
              currentWeightGrams:
                numericWeight > 0
                  ? Math.round(
                      weightUnit === 'kg' ? numericWeight * 1000 : numericWeight * 453.592,
                    )
                  : null,
              microchipId: microchipId.trim() || null,
              sex,
              notes: combinedNotes || null,
            });
            router.replace(`/(pets)/pet/${id}`);
          }}
        />
      </View>
    </ScrollView>
  );
}
