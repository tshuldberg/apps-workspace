import type {
  Medication,
  MedicationFrequency,
  ReminderStatus,
  Vaccination,
  VaccinationReminder,
} from '../types';

function startOfDay(value: string | Date): Date {
  const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : new Date(value);
  return date;
}

function differenceInDays(targetDate: string, referenceDate: string): number {
  const target = startOfDay(targetDate);
  const reference = startOfDay(referenceDate);
  return Math.round((target.getTime() - reference.getTime()) / (24 * 60 * 60 * 1000));
}

export function getReminderStatus(
  dueDate: string,
  referenceDate: string,
  warningWindowDays = 30,
): { status: ReminderStatus; daysUntilDue: number } {
  const daysUntilDue = differenceInDays(dueDate, referenceDate);

  if (daysUntilDue < 0) {
    return { status: 'overdue', daysUntilDue };
  }
  if (daysUntilDue <= warningWindowDays) {
    return { status: 'due_soon', daysUntilDue };
  }
  return { status: 'current', daysUntilDue };
}

export function computeNextMedicationDueAt(
  frequency: MedicationFrequency,
  loggedAt: string,
  intervalDays: number | null,
): string | null {
  const base = new Date(loggedAt);

  switch (frequency) {
    case 'daily':
      base.setUTCDate(base.getUTCDate() + 1);
      return base.toISOString();
    case 'twice_daily':
      base.setUTCHours(base.getUTCHours() + 12);
      return base.toISOString();
    case 'weekly':
      base.setUTCDate(base.getUTCDate() + 7);
      return base.toISOString();
    case 'monthly':
      base.setUTCDate(base.getUTCDate() + 30);
      return base.toISOString();
    case 'every_n_days':
      base.setUTCDate(base.getUTCDate() + Math.max(1, intervalDays ?? 1));
      return base.toISOString();
    case 'as_needed':
    default:
      return null;
  }
}

export interface MedicationReminder {
  medicationId: string;
  petId: string;
  petName: string;
  medicationName: string;
  nextDueAt: string;
  daysUntilDue: number;
  status: ReminderStatus;
}

export function collectVaccinationReminders(
  pets: Array<{ id: string; name: string }>,
  vaccinations: Vaccination[],
  referenceDate: string,
  warningWindowDays = 30,
): VaccinationReminder[] {
  const petMap = new Map(pets.map((pet) => [pet.id, pet.name]));

  return vaccinations
    .filter((vaccination) => vaccination.nextDueDate)
    .map((vaccination) => {
      const result = getReminderStatus(vaccination.nextDueDate!, referenceDate, warningWindowDays);
      return {
        petId: vaccination.petId,
        petName: petMap.get(vaccination.petId) ?? 'Unknown Pet',
        vaccinationId: vaccination.id,
        vaccineName: vaccination.name,
        nextDueDate: vaccination.nextDueDate!,
        status: result.status,
        daysUntilDue: result.daysUntilDue,
      };
    })
    .filter((reminder) => reminder.status !== 'current')
    .sort((left, right) => left.daysUntilDue - right.daysUntilDue);
}

export function collectMedicationReminders(
  pets: Array<{ id: string; name: string }>,
  medications: Medication[],
  referenceIso: string,
  warningWindowDays = 1,
): MedicationReminder[] {
  const petMap = new Map(pets.map((pet) => [pet.id, pet.name]));

  return medications
    .filter((medication) => medication.isActive && medication.nextDueAt)
    .map((medication) => {
      const result = getReminderStatus(medication.nextDueAt!, referenceIso, warningWindowDays);
      return {
        medicationId: medication.id,
        petId: medication.petId,
        petName: petMap.get(medication.petId) ?? 'Unknown Pet',
        medicationName: medication.name,
        nextDueAt: medication.nextDueAt!,
        daysUntilDue: result.daysUntilDue,
        status: result.status,
      };
    })
    .filter((reminder) => reminder.status !== 'current')
    .sort((left, right) => left.daysUntilDue - right.daysUntilDue);
}
