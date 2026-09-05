import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  listPets,
  calculatePetAgeYears,
} from '@mylife/pets';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.pets;

/**
 * Species-specific and size-adjusted age conversion.
 * Dogs: first 2 years = ~10.5 human years each, then ~4 per year (adjusted by size).
 * Cats: first year = 15, second = 9, then ~4 per year.
 * Others: simple multiplier.
 */
function petToHumanAge(ageYears: number, species: string, breed: string | null): number {
  if (ageYears <= 0) return 0;

  if (species === 'dog') {
    // Simplified size-based conversion
    const isLarge = breed?.toLowerCase().match(/retriever|shepherd|lab|dane|mastiff|bernard/) != null;
    const yearlyRate = isLarge ? 5.5 : 4.0;
    if (ageYears <= 2) return ageYears * 10.5;
    return 21 + (ageYears - 2) * yearlyRate;
  }

  if (species === 'cat') {
    if (ageYears <= 1) return ageYears * 15;
    if (ageYears <= 2) return 15 + (ageYears - 1) * 9;
    return 24 + (ageYears - 2) * 4;
  }

  // Generic for other species
  const multipliers: Record<string, number> = {
    bird: 8, rabbit: 8, fish: 5, reptile: 3, horse: 3, small_mammal: 10,
  };
  return ageYears * (multipliers[species] ?? 5);
}

function getLifeStage(ageYears: number, species: string): string {
  if (species === 'dog') {
    if (ageYears < 0.5) return 'Puppy';
    if (ageYears < 2) return 'Adolescent';
    if (ageYears < 7) return 'Adult';
    return 'Senior';
  }
  if (species === 'cat') {
    if (ageYears < 0.5) return 'Kitten';
    if (ageYears < 2) return 'Junior';
    if (ageYears < 7) return 'Prime';
    if (ageYears < 11) return 'Mature';
    return 'Senior';
  }
  if (ageYears < 1) return 'Young';
  if (ageYears < 5) return 'Adult';
  return 'Senior';
}

function getLifeExpectancy(species: string): { min: number; max: number } {
  const ranges: Record<string, { min: number; max: number }> = {
    dog: { min: 10, max: 15 },
    cat: { min: 12, max: 18 },
    bird: { min: 5, max: 40 },
    rabbit: { min: 8, max: 12 },
    fish: { min: 2, max: 10 },
    reptile: { min: 10, max: 50 },
    horse: { min: 25, max: 35 },
    small_mammal: { min: 2, max: 5 },
  };
  return ranges[species] ?? { min: 5, max: 15 };
}

function getAgeRecommendation(stage: string, species: string): string {
  if (stage === 'Puppy' || stage === 'Kitten' || stage === 'Young') {
    return 'Frequent vet checkups, vaccinations, socialization, and a nutrient-rich diet for healthy growth.';
  }
  if (stage === 'Adolescent' || stage === 'Junior') {
    return 'Spay/neuter if not done, establish exercise routine, switch to adult food when appropriate.';
  }
  if (stage === 'Adult' || stage === 'Prime') {
    return 'Annual vet checkups, maintain healthy weight, dental care, and regular exercise.';
  }
  if (stage === 'Mature') {
    return 'Consider bi-annual vet checkups, watch for weight changes, adjust diet for aging needs.';
  }
  // Senior
  return 'Bi-annual vet checkups, joint supplements, senior diet, monitor for age-related conditions.';
}

export default function AgeCalcScreen() {
  const db = useDatabase();
  const pets = useMemo(() => listPets(db), [db]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {pets.length === 0 ? (
        <Card>
          <Text variant="body" color={colors.textSecondary}>
            Add a pet with a birth date to see age calculations.
          </Text>
        </Card>
      ) : (
        pets.map((pet) => {
          const ageYears = calculatePetAgeYears(pet.birthDate);
          const humanAge = ageYears ? petToHumanAge(ageYears, pet.species, pet.breed) : null;
          const stage = ageYears ? getLifeStage(ageYears, pet.species) : null;
          const expectancy = getLifeExpectancy(pet.species);
          const lifePercent = ageYears ? Math.min(100, Math.round((ageYears / expectancy.max) * 100)) : null;
          const recommendation = stage ? getAgeRecommendation(stage, pet.species) : null;

          // Birthday countdown
          let daysUntilBirthday: number | null = null;
          if (pet.birthDate) {
            const today = new Date();
            const bday = new Date(pet.birthDate);
            const nextBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
            if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1);
            daysUntilBirthday = Math.ceil((nextBday.getTime() - today.getTime()) / 86400000);
          }

          return (
            <Card key={pet.id}>
              <Text variant="subheading">{pet.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {pet.species} {pet.breed ? `(${pet.breed})` : ''}
              </Text>

              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: ACCENT }]}>
                    {ageYears ? `${ageYears.toFixed(1)}y` : 'N/A'}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>Actual Age</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: ACCENT }]}>
                    {humanAge ? `${Math.round(humanAge)}y` : 'N/A'}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>Human Years</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: ACCENT }]}>
                    {stage ?? 'N/A'}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>Life Stage</Text>
                </View>
              </View>

              {/* Life expectancy bar */}
              {lifePercent !== null && (
                <View style={styles.barSection}>
                  <Text variant="caption" color={colors.textSecondary}>
                    Life expectancy: {expectancy.min}-{expectancy.max} years ({lifePercent}%)
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${lifePercent}%` }]} />
                  </View>
                </View>
              )}

              {/* Birthday countdown */}
              {daysUntilBirthday !== null && (
                <Text variant="caption" color={colors.textSecondary}>
                  {daysUntilBirthday === 0
                    ? 'Happy birthday today!'
                    : `Birthday in ${daysUntilBirthday} day${daysUntilBirthday !== 1 ? 's' : ''}`}
                </Text>
              )}

              {/* Age recommendation */}
              {recommendation && (
                <View style={styles.recommendationBox}>
                  <Text variant="caption" color={colors.textSecondary}>
                    {recommendation}
                  </Text>
                </View>
              )}
            </Card>
          );
        })
      )}

      {/* Multi-pet comparison */}
      {pets.length > 1 && (
        <Card>
          <Text variant="subheading">Age Comparison</Text>
          <View style={styles.list}>
            {pets.map((pet) => {
              const ageYears = calculatePetAgeYears(pet.birthDate);
              const humanAge = ageYears ? petToHumanAge(ageYears, pet.species, pet.breed) : null;
              return (
                <View key={pet.id} style={styles.compRow}>
                  <Text variant="body" style={styles.compName}>{pet.name}</Text>
                  <Text variant="body" color={colors.textSecondary}>
                    {ageYears ? `${ageYears.toFixed(1)}y` : '--'} real / {humanAge ? `${Math.round(humanAge)}y` : '--'} human
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    gap: 2, alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  barSection: { gap: spacing.xs, marginTop: spacing.sm },
  barTrack: {
    height: 8, borderRadius: 4, backgroundColor: colors.surfaceElevated,
    overflow: 'hidden' as const,
  },
  barFill: { height: 8, borderRadius: 4, backgroundColor: ACCENT },
  recommendationBox: {
    marginTop: spacing.sm, padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  compRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  compName: { flex: 1 },
});
