import type { PetExportBundle, PetSitterCard } from '../types';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value).replaceAll('"', '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function sectionToCsv(name: string, rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return `${name}\n`;
  }

  const columns = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set()),
  );

  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','));
  return [name, columns.join(','), ...body].join('\n');
}

export function formatPetSitterCard(card: PetSitterCard): string {
  const lines = [
    `${card.pet.name} Care Card`,
    `${card.pet.species}${card.pet.breed ? ` · ${card.pet.breed}` : ''}`,
    '',
    'Feeding',
    ...(
      card.feedingSchedules.length > 0
        ? card.feedingSchedules.map((schedule) =>
          `- ${schedule.label} at ${schedule.feedAt}${schedule.foodName ? ` · ${schedule.foodName}` : ''}`,
        )
        : ['- No feeding schedule recorded']
    ),
    '',
    'Medications',
    ...(
      card.activeMedications.length > 0
        ? card.activeMedications.map((medication) =>
          `- ${medication.name}${medication.dosage ? ` (${medication.dosage})` : ''} · ${medication.frequency}`,
        )
        : ['- No active medications']
    ),
    '',
    'Emergency Contacts',
    ...(
      card.emergencyContacts.length > 0
        ? card.emergencyContacts.map((contact) =>
          `- ${contact.label}: ${contact.clinicName} · ${contact.phone}${contact.address ? ` · ${contact.address}` : ''}`,
        )
        : ['- No emergency contacts recorded']
    ),
  ];

  if (card.breedAlerts.length > 0) {
    lines.push('', 'Breed Notes');
    card.breedAlerts.forEach((alert) => {
      lines.push(`- ${alert.condition}: ${alert.description}`);
    });
  }

  return lines.join('\n');
}

export function serializePetExportBundle(bundle: PetExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function serializePetExportCsvSections(bundle: PetExportBundle): Record<string, string> {
  return {
    pets: sectionToCsv('pets', bundle.pets),
    vetVisits: sectionToCsv('vet_visits', bundle.vetVisits),
    vaccinations: sectionToCsv('vaccinations', bundle.vaccinations),
    medications: sectionToCsv('medications', bundle.medications),
    medicationLogs: sectionToCsv('medication_logs', bundle.medicationLogs),
    weightEntries: sectionToCsv('weight_entries', bundle.weightEntries),
    feedingSchedules: sectionToCsv('feeding_schedules', bundle.feedingSchedules),
    expenses: sectionToCsv('expenses', bundle.expenses),
    emergencyContacts: sectionToCsv('emergency_contacts', bundle.emergencyContacts),
    exerciseLogs: sectionToCsv('exercise_logs', bundle.exerciseLogs),
    groomingRecords: sectionToCsv('grooming_records', bundle.groomingRecords),
    trainingLogs: sectionToCsv('training_logs', bundle.trainingLogs),
    photos: sectionToCsv('pet_photos', bundle.photos),
    timeline: sectionToCsv('timeline', bundle.timeline),
  };
}
