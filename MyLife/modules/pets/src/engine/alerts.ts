import type {
  BreedHealthAlert,
  BreedAlertSeverity,
  PetSpecies,
} from '../types';

interface AlertSeed {
  condition: string;
  description: string;
  screeningAge: string | null;
  screeningFrequency: string | null;
  severity: BreedAlertSeverity;
}

const BREED_ALERTS: Partial<Record<PetSpecies, Record<string, AlertSeed[]>>> = {
  dog: {
    'golden retriever': [
      {
        condition: 'Hip dysplasia',
        description: 'Monitor gait changes and discuss hip screening with your veterinarian.',
        screeningAge: '12-24 months',
        screeningFrequency: 'Annual mobility review',
        severity: 'serious',
      },
      {
        condition: 'Lymphoma',
        description: 'Watch for swollen lymph nodes, lethargy, or appetite changes.',
        screeningAge: 'Adult years',
        screeningFrequency: 'Discuss at annual wellness visits',
        severity: 'moderate',
      },
    ],
    'german shepherd': [
      {
        condition: 'Degenerative myelopathy',
        description: 'Track hind-leg weakness and talk through early neurologic screening.',
        screeningAge: '7+ years',
        screeningFrequency: 'Annual neurologic review',
        severity: 'serious',
      },
    ],
    'french bulldog': [
      {
        condition: 'Brachycephalic airway syndrome',
        description: 'Monitor breathing effort, heat tolerance, and exercise recovery.',
        screeningAge: 'Any age',
        screeningFrequency: 'Review during routine exams',
        severity: 'serious',
      },
    ],
    beagle: [
      {
        condition: 'Ear infections',
        description: 'Inspect ears often and log recurring irritation or odor.',
        screeningAge: 'Any age',
        screeningFrequency: 'Home checks weekly',
        severity: 'moderate',
      },
    ],
  },
  cat: {
    'maine coon': [
      {
        condition: 'Hypertrophic cardiomyopathy',
        description: 'Ask about heart screening, especially if exercise tolerance changes.',
        screeningAge: '1-7 years',
        screeningFrequency: 'Annual cardiac discussion',
        severity: 'serious',
      },
    ],
    siamese: [
      {
        condition: 'Dental disease',
        description: 'Track tartar buildup and bad breath to catch periodontal issues early.',
        screeningAge: 'Adult years',
        screeningFrequency: 'Dental review every 6-12 months',
        severity: 'moderate',
      },
    ],
    persian: [
      {
        condition: 'Polycystic kidney disease',
        description: 'Monitor thirst, appetite, and weight for kidney-related changes.',
        screeningAge: 'Adult years',
        screeningFrequency: 'Annual bloodwork discussion',
        severity: 'serious',
      },
    ],
  },
};

function normalizeBreedKey(breed: string | null | undefined): string | null {
  if (!breed) {
    return null;
  }

  const normalized = breed.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function getBreedHealthAlerts(
  species: PetSpecies,
  breed: string | null | undefined,
): BreedHealthAlert[] {
  const breedKey = normalizeBreedKey(breed);
  if (!breedKey) {
    return [];
  }

  const alerts = BREED_ALERTS[species]?.[breedKey] ?? [];
  return alerts.map((alert, index) => ({
    id: `${species}:${breedKey}:${index}`,
    species,
    breedKey,
    condition: alert.condition,
    description: alert.description,
    screeningAge: alert.screeningAge,
    screeningFrequency: alert.screeningFrequency,
    severity: alert.severity,
  }));
}
