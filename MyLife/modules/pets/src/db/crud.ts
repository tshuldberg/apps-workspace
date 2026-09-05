import type { DatabaseAdapter } from '@mylife/db';
import {
  CreateEmergencyContactInputSchema,
  CreateExerciseLogInputSchema,
  CreateFeedingScheduleInputSchema,
  CreateFeedingLogInputSchema,
  CreateFoodTransitionInputSchema,
  CreateGroomingRecordInputSchema,
  CreateMedicationInputSchema,
  CreatePetExpenseInputSchema,
  CreatePetInputSchema,
  CreatePetPhotoInputSchema,
  CreateTrainingLogInputSchema,
  CreateVaccinationInputSchema,
  CreateVetVisitInputSchema,
  CreateWeightEntryInputSchema,
  PetListFilterSchema,
  PetTimelineItemSchema,
  RecordMedicationLogInputSchema,
  UpdateFeedingScheduleInputSchema,
  UpdatePetInputSchema,
  UpsertDietaryInfoInputSchema,
  type CreateEmergencyContactInput,
  type CreateExerciseLogInput,
  type CreateFeedingScheduleInput,
  type CreateFeedingLogInput,
  type CreateFoodTransitionInput,
  type CreateGroomingRecordInput,
  type CreateMedicationInput,
  type CreatePetExpenseInput,
  type CreatePetInput,
  type CreatePetPhotoInput,
  type CreateTrainingLogInput,
  type CreateVaccinationInput,
  type CreateVetVisitInput,
  type CreateWeightEntryInput,
  type DietaryInfo,
  type EmergencyContact,
  type ExerciseLog,
  type FeedingLog,
  type FeedingSchedule,
  type FoodTransition,
  type GroomingRecord,
  type Medication,
  type MedicationLog,
  type Pet,
  type PetDashboard,
  type PetExportBundle,
  type PetExpense,
  type PetListFilter,
  type PetPhoto,
  type PetSitterCard,
  type PetTimelineItem,
  type GroomingReminder,
  type TrainingLog,
  type UpsertDietaryInfoInput,
  type UpdateFeedingScheduleInput,
  type Vaccination,
  type VaccinationReminder,
  type VetVisit,
  type WeightEntry,
  type ExerciseGoal,
  type InsurancePolicy,
  type InsuranceClaim,
  type ExpenseBudget,
  type GroomingInterval,
  type TrainingCommand,
  type DismissedAlert,
  type SetExerciseGoalInput,
  type CreateInsurancePolicyInput,
  type CreateInsuranceClaimInput,
  type SetExpenseBudgetInput,
  type SetGroomingIntervalInput,
  type AddTrainingCommandInput,
  SetExerciseGoalInputSchema,
  CreateInsurancePolicyInputSchema,
  CreateInsuranceClaimInputSchema,
  SetExpenseBudgetInputSchema,
  SetGroomingIntervalInputSchema,
  AddTrainingCommandInputSchema,
  ClaimStatusSchema,
  CommandStatusSchema,
} from '../types';
import {
  calculateNextGroomingDate,
} from '../engine/grooming-intervals';
import {
  collectVaccinationReminders,
  computeNextMedicationDueAt,
  getReminderStatus,
} from '../engine/reminders';
import { getBreedHealthAlerts } from '../engine/alerts';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToPet(row: Record<string, unknown>): Pet {
  return {
    id: row.id as string,
    name: row.name as string,
    species: row.species as Pet['species'],
    breed: (row.breed as string) ?? null,
    birthDate: (row.birth_date as string) ?? null,
    adoptionDate: (row.adoption_date as string) ?? null,
    sex: row.sex as Pet['sex'],
    isSterilized: Number(row.is_sterilized ?? 0) === 1,
    microchipId: (row.microchip_id as string) ?? null,
    currentWeightGrams: (row.current_weight_grams as number) ?? null,
    imageUri: (row.image_uri as string) ?? null,
    notes: (row.notes as string) ?? null,
    isArchived: Number(row.is_archived ?? 0) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToVetVisit(row: Record<string, unknown>): VetVisit {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    visitDate: row.visit_date as string,
    visitType: row.visit_type as VetVisit['visitType'],
    reason: row.reason as string,
    clinicName: (row.clinic_name as string) ?? null,
    veterinarian: (row.veterinarian as string) ?? null,
    diagnosis: (row.diagnosis as string) ?? null,
    treatment: (row.treatment as string) ?? null,
    weightGrams: (row.weight_grams as number) ?? null,
    costCents: (row.cost_cents as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToVaccination(row: Record<string, unknown>): Vaccination {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    name: row.name as string,
    dateGiven: row.date_given as string,
    nextDueDate: (row.next_due_date as string) ?? null,
    veterinarian: (row.veterinarian as string) ?? null,
    lotNumber: (row.lot_number as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToMedication(row: Record<string, unknown>): Medication {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    name: row.name as string,
    dosage: (row.dosage as string) ?? null,
    frequency: row.frequency as Medication['frequency'],
    intervalDays: (row.interval_days as number) ?? null,
    startsOn: row.starts_on as string,
    endsOn: (row.ends_on as string) ?? null,
    nextDueAt: (row.next_due_at as string) ?? null,
    lastGivenAt: (row.last_given_at as string) ?? null,
    prescribedBy: (row.prescribed_by as string) ?? null,
    notes: (row.notes as string) ?? null,
    isActive: Number(row.is_active ?? 0) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToMedicationLog(row: Record<string, unknown>): MedicationLog {
  return {
    id: row.id as string,
    medicationId: row.medication_id as string,
    status: row.status as MedicationLog['status'],
    loggedAt: row.logged_at as string,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToWeightEntry(row: Record<string, unknown>): WeightEntry {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    weightGrams: row.weight_grams as number,
    bodyConditionScore: (row.body_condition_score as number) ?? null,
    loggedAt: row.logged_at as string,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToFeedingSchedule(row: Record<string, unknown>): FeedingSchedule {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    label: row.label as string,
    foodName: (row.food_name as string) ?? null,
    amount: (row.amount as string) ?? null,
    feedAt: row.feed_at as string,
    portionSize: (row.portion_size as number) ?? null,
    portionUnit: (row.portion_unit as FeedingSchedule['portionUnit']) ?? null,
    portionUnitCustom: (row.portion_unit_custom as string) ?? null,
    mealLabel: (row.meal_label as FeedingSchedule['mealLabel']) ?? null,
    reminderEnabled: Number(row.reminder_enabled ?? 1) === 1,
    sortOrder: (row.sort_order as number) ?? 0,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToPetExpense(row: Record<string, unknown>): PetExpense {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    category: row.category as PetExpense['category'],
    label: row.label as string,
    amountCents: row.amount_cents as number,
    spentOn: row.spent_on as string,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToEmergencyContact(row: Record<string, unknown>): EmergencyContact {
  return {
    id: row.id as string,
    petId: (row.pet_id as string) ?? null,
    label: row.label as string,
    clinicName: row.clinic_name as string,
    phone: row.phone as string,
    address: (row.address as string) ?? null,
    hours: (row.hours as string) ?? null,
    notes: (row.notes as string) ?? null,
    isPrimary: Number(row.is_primary ?? 0) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToExerciseLog(row: Record<string, unknown>): ExerciseLog {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    activityType: row.activity_type as ExerciseLog['activityType'],
    durationMinutes: row.duration_minutes as number,
    distanceKm: typeof row.distance_km === 'number' ? row.distance_km : row.distance_km === null ? null : Number(row.distance_km),
    loggedAt: row.logged_at as string,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToGroomingRecord(row: Record<string, unknown>): GroomingRecord {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    groomingType: row.grooming_type as GroomingRecord['groomingType'],
    groomedAt: row.groomed_at as string,
    nextDueDate: (row.next_due_date as string) ?? null,
    provider: (row.provider as string) ?? null,
    costCents: (row.cost_cents as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToTrainingLog(row: Record<string, unknown>): TrainingLog {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    commandName: row.command_name as string,
    location: row.location as TrainingLog['location'],
    durationMinutes: (row.duration_minutes as number) ?? null,
    successRating: (row.success_rating as number) ?? null,
    loggedAt: row.logged_at as string,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToPetPhoto(row: Record<string, unknown>): PetPhoto {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    imageUri: row.image_uri as string,
    caption: (row.caption as string) ?? null,
    milestoneTag: (row.milestone_tag as string) ?? null,
    takenAt: (row.taken_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function createTimelineDate(value: string): string {
  return value.length === 10 ? `${value}T12:00:00.000Z` : value;
}

export function createPet(db: DatabaseAdapter, id: string, rawInput: CreatePetInput): Pet {
  const input = CreatePetInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO pt_pets (
      id, name, species, breed, birth_date, adoption_date, sex, is_sterilized, microchip_id,
      current_weight_grams, image_uri, notes, is_archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.species,
      input.breed,
      input.birthDate,
      input.adoptionDate,
      input.sex,
      input.isSterilized ? 1 : 0,
      input.microchipId,
      input.currentWeightGrams,
      input.imageUri,
      input.notes,
      input.isArchived ? 1 : 0,
      now,
      now,
    ],
  );

  return getPetById(db, id)!;
}

export function getPetById(db: DatabaseAdapter, id: string): Pet | null {
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_pets WHERE id = ?`, [id]);
  return rows[0] ? rowToPet(rows[0]) : null;
}

export function listPets(db: DatabaseAdapter, rawFilter?: PetListFilter): Pet[] {
  const filter = PetListFilterSchema.parse(rawFilter ?? {});
  const rows = filter.includeArchived
    ? db.query<Record<string, unknown>>(`SELECT * FROM pt_pets ORDER BY is_archived ASC, name ASC`)
    : db.query<Record<string, unknown>>(
      `SELECT * FROM pt_pets WHERE is_archived = 0 ORDER BY name ASC`,
    );

  return rows.map(rowToPet);
}

export function updatePet(db: DatabaseAdapter, id: string, rawInput: Partial<CreatePetInput>): Pet | null {
  const updates = UpdatePetInputSchema.parse(rawInput);
  const fields: string[] = [];
  const params: unknown[] = [];

  const mappings: Array<[keyof typeof updates, string, unknown]> = [
    ['name', 'name', updates.name],
    ['species', 'species', updates.species],
    ['breed', 'breed', updates.breed],
    ['birthDate', 'birth_date', updates.birthDate],
    ['adoptionDate', 'adoption_date', updates.adoptionDate],
    ['sex', 'sex', updates.sex],
    ['isSterilized', 'is_sterilized', updates.isSterilized === undefined ? undefined : updates.isSterilized ? 1 : 0],
    ['microchipId', 'microchip_id', updates.microchipId],
    ['currentWeightGrams', 'current_weight_grams', updates.currentWeightGrams],
    ['imageUri', 'image_uri', updates.imageUri],
    ['notes', 'notes', updates.notes],
    ['isArchived', 'is_archived', updates.isArchived === undefined ? undefined : updates.isArchived ? 1 : 0],
  ];

  for (const [key, column, value] of mappings) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(value);
    }
  }

  if (fields.length === 0) {
    return getPetById(db, id);
  }

  params.push(nowIso(), id);
  db.execute(`UPDATE pt_pets SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`, params);
  return getPetById(db, id);
}

export function deletePet(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM pt_pets WHERE id = ?`, [id]);
}

export function createVetVisit(db: DatabaseAdapter, id: string, rawInput: CreateVetVisitInput): VetVisit {
  const input = CreateVetVisitInputSchema.parse(rawInput);
  const now = nowIso();

  db.transaction(() => {
    db.execute(
      `INSERT INTO pt_vet_visits (
        id, pet_id, visit_date, visit_type, reason, clinic_name, veterinarian, diagnosis, treatment,
        weight_grams, cost_cents, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.petId,
        input.visitDate,
        input.visitType,
        input.reason,
        input.clinicName,
        input.veterinarian,
        input.diagnosis,
        input.treatment,
        input.weightGrams,
        input.costCents,
        input.notes,
        now,
      ],
    );

    if (input.costCents !== null) {
      db.execute(
        `INSERT INTO pt_expenses (id, pet_id, category, label, amount_cents, spent_on, notes, created_at)
         VALUES (?, ?, 'vet', ?, ?, ?, ?, ?)`,
        [
          createId('pt_expense'),
          input.petId,
          `Vet visit: ${input.reason}`,
          input.costCents,
          input.visitDate,
          input.notes,
          now,
        ],
      );
    }
  });

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_vet_visits WHERE id = ?`, [id])
    .map(rowToVetVisit)[0];
}

export function listVetVisitsForPet(db: DatabaseAdapter, petId: string, limit = 200): VetVisit[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_vet_visits WHERE pet_id = ? ORDER BY visit_date DESC, created_at DESC LIMIT ?`,
      [petId, limit],
    )
    .map(rowToVetVisit);
}

export function createVaccination(db: DatabaseAdapter, id: string, rawInput: CreateVaccinationInput): Vaccination {
  const input = CreateVaccinationInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO pt_vaccinations (
      id, pet_id, name, date_given, next_due_date, veterinarian, lot_number, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.petId,
      input.name,
      input.dateGiven,
      input.nextDueDate,
      input.veterinarian,
      input.lotNumber,
      input.notes,
      now,
    ],
  );

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_vaccinations WHERE id = ?`, [id])
    .map(rowToVaccination)[0];
}

export function listVaccinationsForPet(db: DatabaseAdapter, petId: string, limit = 200): Vaccination[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_vaccinations WHERE pet_id = ? ORDER BY COALESCE(next_due_date, date_given) ASC LIMIT ?`,
      [petId, limit],
    )
    .map(rowToVaccination);
}

export function listDueVaccinationReminders(
  db: DatabaseAdapter,
  referenceDate = new Date().toISOString().slice(0, 10),
  warningWindowDays = 30,
): VaccinationReminder[] {
  const pets = listPets(db, { includeArchived: true }).map((pet) => ({ id: pet.id, name: pet.name }));
  const vaccinations = db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_vaccinations
       WHERE next_due_date IS NOT NULL
         AND date(next_due_date) <= date(?, '+' || ? || ' days')`,
      [referenceDate, warningWindowDays],
    )
    .map(rowToVaccination);

  return collectVaccinationReminders(pets, vaccinations, referenceDate, warningWindowDays);
}

export function createMedication(db: DatabaseAdapter, id: string, rawInput: CreateMedicationInput): Medication {
  const input = CreateMedicationInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO pt_medications (
      id, pet_id, name, dosage, frequency, interval_days, starts_on, ends_on, next_due_at,
      last_given_at, prescribed_by, notes, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.petId,
      input.name,
      input.dosage,
      input.frequency,
      input.intervalDays,
      input.startsOn,
      input.endsOn,
      input.nextDueAt,
      input.lastGivenAt,
      input.prescribedBy,
      input.notes,
      input.isActive ? 1 : 0,
      now,
      now,
    ],
  );

  return getMedicationById(db, id)!;
}

export function getMedicationById(db: DatabaseAdapter, id: string): Medication | null {
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_medications WHERE id = ?`, [id]);
  return rows[0] ? rowToMedication(rows[0]) : null;
}

export function listMedicationsForPet(
  db: DatabaseAdapter,
  petId: string,
  includeInactive = false,
  limit = 200,
): Medication[] {
  const sql = includeInactive
    ? `SELECT * FROM pt_medications WHERE pet_id = ? ORDER BY is_active DESC, name ASC LIMIT ?`
    : `SELECT * FROM pt_medications WHERE pet_id = ? AND is_active = 1 ORDER BY next_due_at ASC, name ASC LIMIT ?`;

  return db.query<Record<string, unknown>>(sql, [petId, limit]).map(rowToMedication);
}

export function listDueMedications(
  db: DatabaseAdapter,
  referenceIso = new Date().toISOString(),
  warningWindowHours = 24,
): Medication[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_medications
       WHERE is_active = 1
         AND next_due_at IS NOT NULL
         AND datetime(next_due_at) <= datetime(?, '+' || ? || ' hours')
       ORDER BY next_due_at ASC`,
      [referenceIso, warningWindowHours],
    )
    .map(rowToMedication);
}

export function recordMedicationLog(
  db: DatabaseAdapter,
  rawInput: { medicationId: string; status?: MedicationLog['status']; loggedAt?: string; notes?: string | null },
): MedicationLog {
  const input = RecordMedicationLogInputSchema.parse(rawInput);
  const now = input.loggedAt ?? nowIso();
  const id = createId('pt_medlog');
  const medication = getMedicationById(db, input.medicationId);

  if (!medication) {
    throw new Error(`Medication not found: ${input.medicationId}`);
  }

  db.transaction(() => {
    db.execute(
      `INSERT INTO pt_medication_logs (id, medication_id, status, logged_at, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.medicationId, input.status, now, input.notes, now],
    );

    const nextDueAt = input.status === 'given'
      ? computeNextMedicationDueAt(medication.frequency, now, medication.intervalDays)
      : medication.nextDueAt;

    db.execute(
      `UPDATE pt_medications
       SET last_given_at = ?, next_due_at = ?, updated_at = ?
       WHERE id = ?`,
      [input.status === 'given' ? now : medication.lastGivenAt, nextDueAt, nowIso(), medication.id],
    );
  });

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_medication_logs WHERE id = ?`, [id])
    .map(rowToMedicationLog)[0];
}

export function listMedicationLogs(db: DatabaseAdapter, medicationId: string, limit = 200): MedicationLog[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_medication_logs WHERE medication_id = ? ORDER BY logged_at DESC LIMIT ?`,
      [medicationId, limit],
    )
    .map(rowToMedicationLog);
}

export function createWeightEntry(db: DatabaseAdapter, id: string, rawInput: CreateWeightEntryInput): WeightEntry {
  const input = CreateWeightEntryInputSchema.parse(rawInput);
  const loggedAt = input.loggedAt ?? nowIso();
  const createdAt = nowIso();

  db.transaction(() => {
    db.execute(
      `INSERT INTO pt_weight_entries (
        id, pet_id, weight_grams, body_condition_score, logged_at, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.petId, input.weightGrams, input.bodyConditionScore, loggedAt, input.notes, createdAt],
    );

    db.execute(
      `UPDATE pt_pets SET current_weight_grams = ?, updated_at = ? WHERE id = ?`,
      [input.weightGrams, createdAt, input.petId],
    );
  });

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_weight_entries WHERE id = ?`, [id])
    .map(rowToWeightEntry)[0];
}

export function listWeightEntriesForPet(db: DatabaseAdapter, petId: string, limit = 200): WeightEntry[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_weight_entries WHERE pet_id = ? ORDER BY logged_at DESC LIMIT ?`,
      [petId, limit],
    )
    .map(rowToWeightEntry);
}

export function createFeedingSchedule(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateFeedingScheduleInput,
): FeedingSchedule {
  const input = CreateFeedingScheduleInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO pt_feeding_schedules (
      id, pet_id, label, food_name, amount, feed_at,
      portion_size, portion_unit, portion_unit_custom, meal_label, reminder_enabled, sort_order,
      notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.petId, input.label, input.foodName, input.amount, input.feedAt,
      input.portionSize, input.portionUnit, input.portionUnitCustom, input.mealLabel,
      input.reminderEnabled ? 1 : 0, input.sortOrder,
      input.notes, now, now,
    ],
  );

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_feeding_schedules WHERE id = ?`, [id])
    .map(rowToFeedingSchedule)[0];
}

export function listFeedingSchedulesForPet(db: DatabaseAdapter, petId: string, limit = 200): FeedingSchedule[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_feeding_schedules WHERE pet_id = ? ORDER BY feed_at ASC LIMIT ?`,
      [petId, limit],
    )
    .map(rowToFeedingSchedule);
}

export function createPetExpense(db: DatabaseAdapter, id: string, rawInput: CreatePetExpenseInput): PetExpense {
  const input = CreatePetExpenseInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO pt_expenses (id, pet_id, category, label, amount_cents, spent_on, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.petId, input.category, input.label, input.amountCents, input.spentOn, input.notes, now],
  );

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_expenses WHERE id = ?`, [id])
    .map(rowToPetExpense)[0];
}

export function listExpensesForPet(db: DatabaseAdapter, petId: string, limit = 200): PetExpense[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_expenses WHERE pet_id = ? ORDER BY spent_on DESC, created_at DESC LIMIT ?`,
      [petId, limit],
    )
    .map(rowToPetExpense);
}

export function createEmergencyContact(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateEmergencyContactInput,
): EmergencyContact {
  const input = CreateEmergencyContactInputSchema.parse(rawInput);
  const now = nowIso();

  db.transaction(() => {
    if (input.isPrimary) {
      db.execute(
        `UPDATE pt_emergency_contacts SET is_primary = 0, updated_at = ? WHERE COALESCE(pet_id, '') = COALESCE(?, '')`,
        [now, input.petId],
      );
    }

    db.execute(
      `INSERT INTO pt_emergency_contacts (
        id, pet_id, label, clinic_name, phone, address, hours, notes, is_primary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.petId,
        input.label,
        input.clinicName,
        input.phone,
        input.address,
        input.hours,
        input.notes,
        input.isPrimary ? 1 : 0,
        now,
        now,
      ],
    );
  });

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_emergency_contacts WHERE id = ?`, [id])
    .map(rowToEmergencyContact)[0];
}

export function listEmergencyContacts(
  db: DatabaseAdapter,
  petId?: string | null,
): EmergencyContact[] {
  const rows = petId === undefined
    ? db.query<Record<string, unknown>>(
      `SELECT * FROM pt_emergency_contacts
       ORDER BY is_primary DESC, clinic_name ASC`,
    )
    : db.query<Record<string, unknown>>(
      `SELECT * FROM pt_emergency_contacts
       WHERE pet_id = ? OR pet_id IS NULL
       ORDER BY CASE WHEN pet_id = ? THEN 0 ELSE 1 END ASC, is_primary DESC, clinic_name ASC`,
      [petId, petId],
    );

  return rows.map(rowToEmergencyContact);
}

export function createExerciseLog(db: DatabaseAdapter, id: string, rawInput: CreateExerciseLogInput): ExerciseLog {
  const input = CreateExerciseLogInputSchema.parse(rawInput);
  const loggedAt = input.loggedAt ?? nowIso();
  const createdAt = nowIso();

  db.execute(
    `INSERT INTO pt_exercise_logs (
      id, pet_id, activity_type, duration_minutes, distance_km, logged_at, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.petId,
      input.activityType,
      input.durationMinutes,
      input.distanceKm,
      loggedAt,
      input.notes,
      createdAt,
    ],
  );

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_exercise_logs WHERE id = ?`, [id])
    .map(rowToExerciseLog)[0];
}

export function listExerciseLogsForPet(db: DatabaseAdapter, petId: string, limit = 200): ExerciseLog[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_exercise_logs WHERE pet_id = ? ORDER BY logged_at DESC LIMIT ?`,
      [petId, limit],
    )
    .map(rowToExerciseLog);
}

export function createGroomingRecord(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateGroomingRecordInput,
): GroomingRecord {
  const input = CreateGroomingRecordInputSchema.parse(rawInput);
  const groomedAt = input.groomedAt ?? new Date().toISOString().slice(0, 10);
  const createdAt = nowIso();

  db.transaction(() => {
    db.execute(
      `INSERT INTO pt_grooming_records (
        id, pet_id, grooming_type, groomed_at, next_due_date, provider, cost_cents, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.petId,
        input.groomingType,
        groomedAt,
        input.nextDueDate,
        input.provider,
        input.costCents,
        input.notes,
        createdAt,
      ],
    );

    if (input.costCents !== null) {
      db.execute(
        `INSERT INTO pt_expenses (id, pet_id, category, label, amount_cents, spent_on, notes, created_at)
         VALUES (?, ?, 'grooming', ?, ?, ?, ?, ?)`,
        [
          createId('pt_expense'),
          input.petId,
          `Grooming: ${input.groomingType.replaceAll('_', ' ')}`,
          input.costCents,
          groomedAt.slice(0, 10),
          input.notes,
          createdAt,
        ],
      );
    }
  });

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_grooming_records WHERE id = ?`, [id])
    .map(rowToGroomingRecord)[0];
}

export function listGroomingRecordsForPet(db: DatabaseAdapter, petId: string, limit = 200): GroomingRecord[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_grooming_records WHERE pet_id = ? ORDER BY groomed_at DESC LIMIT ?`,
      [petId, limit],
    )
    .map(rowToGroomingRecord);
}

export function listDueGroomingReminders(
  db: DatabaseAdapter,
  referenceDate = new Date().toISOString().slice(0, 10),
  warningWindowDays = 14,
): GroomingReminder[] {
  const pets = new Map(listPets(db, { includeArchived: true }).map((pet) => [pet.id, pet.name]));

  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_grooming_records
       WHERE next_due_date IS NOT NULL
         AND date(next_due_date) <= date(?, '+' || ? || ' days')
       ORDER BY next_due_date ASC`,
      [referenceDate, warningWindowDays],
    )
    .map(rowToGroomingRecord)
    .map((record) => {
      const reminder = getReminderStatus(record.nextDueDate!, referenceDate, warningWindowDays);
      return {
        petId: record.petId,
        petName: pets.get(record.petId) ?? 'Unknown Pet',
        groomingRecordId: record.id,
        groomingType: record.groomingType,
        nextDueDate: record.nextDueDate!,
        status: reminder.status,
        daysUntilDue: reminder.daysUntilDue,
      };
    });
}

export function createTrainingLog(db: DatabaseAdapter, id: string, rawInput: CreateTrainingLogInput): TrainingLog {
  const input = CreateTrainingLogInputSchema.parse(rawInput);
  const loggedAt = input.loggedAt ?? nowIso();
  const createdAt = nowIso();

  db.execute(
    `INSERT INTO pt_training_logs (
      id, pet_id, command_name, location, duration_minutes, success_rating, logged_at, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.petId,
      input.commandName,
      input.location,
      input.durationMinutes,
      input.successRating,
      loggedAt,
      input.notes,
      createdAt,
    ],
  );

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_training_logs WHERE id = ?`, [id])
    .map(rowToTrainingLog)[0];
}

export function listTrainingLogsForPet(db: DatabaseAdapter, petId: string, limit = 200): TrainingLog[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_training_logs WHERE pet_id = ? ORDER BY logged_at DESC LIMIT ?`,
      [petId, limit],
    )
    .map(rowToTrainingLog);
}

export function createPetPhoto(db: DatabaseAdapter, id: string, rawInput: CreatePetPhotoInput): PetPhoto {
  const input = CreatePetPhotoInputSchema.parse(rawInput);
  const createdAt = nowIso();

  db.transaction(() => {
    db.execute(
      `INSERT INTO pt_pet_photos (id, pet_id, image_uri, caption, milestone_tag, taken_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.petId, input.imageUri, input.caption, input.milestoneTag, input.takenAt, createdAt],
    );

    const pet = getPetById(db, input.petId);
    if (pet && !pet.imageUri) {
      db.execute(`UPDATE pt_pets SET image_uri = ?, updated_at = ? WHERE id = ?`, [input.imageUri, createdAt, input.petId]);
    }
  });

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_pet_photos WHERE id = ?`, [id])
    .map(rowToPetPhoto)[0];
}

export function listPetPhotosForPet(db: DatabaseAdapter, petId: string, limit = 200): PetPhoto[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_pet_photos
       WHERE pet_id = ?
       ORDER BY COALESCE(taken_at, created_at) DESC
       LIMIT ?`,
      [petId, limit],
    )
    .map(rowToPetPhoto);
}

export function getPetHealthTimeline(
  db: DatabaseAdapter,
  petId: string,
  limit = 50,
): PetTimelineItem[] {
  const subLimit = limit * 2;
  const medicationLogs = db
    .query<Record<string, unknown>>(
      `SELECT ml.id, m.pet_id, ml.logged_at, ml.status, m.name
       FROM pt_medication_logs ml
       INNER JOIN pt_medications m ON m.id = ml.medication_id
       WHERE m.pet_id = ?
       ORDER BY ml.logged_at DESC
       LIMIT ?`,
      [petId, subLimit],
    )
    .map((row) => ({
      id: row.id as string,
      petId: row.pet_id as string,
      occurredAt: row.logged_at as string,
      kind: 'medication' as const,
      title: `Medication ${row.status === 'given' ? 'given' : 'skipped'} · ${row.name as string}`,
      detail: null,
    }));

  const items = [
    ...listVetVisitsForPet(db, petId, subLimit).map((visit) => ({
      id: visit.id,
      petId: visit.petId,
      occurredAt: createTimelineDate(visit.visitDate),
      kind: 'vet_visit' as const,
      title: `Vet visit · ${visit.reason}`,
      detail: visit.diagnosis ?? visit.clinicName,
    })),
    ...listVaccinationsForPet(db, petId, subLimit).map((vaccination) => ({
      id: vaccination.id,
      petId: vaccination.petId,
      occurredAt: createTimelineDate(vaccination.dateGiven),
      kind: 'vaccination' as const,
      title: `Vaccination · ${vaccination.name}`,
      detail: vaccination.nextDueDate ? `Next due ${vaccination.nextDueDate}` : null,
    })),
    ...medicationLogs,
    ...listWeightEntriesForPet(db, petId, subLimit).map((entry) => ({
      id: entry.id,
      petId: entry.petId,
      occurredAt: entry.loggedAt,
      kind: 'weight' as const,
      title: `Weight logged · ${(entry.weightGrams / 1000).toFixed(1)} kg`,
      detail: entry.notes,
    })),
    ...listExerciseLogsForPet(db, petId, subLimit).map((log) => ({
      id: log.id,
      petId: log.petId,
      occurredAt: log.loggedAt,
      kind: 'exercise' as const,
      title: `${log.activityType.replaceAll('_', ' ')} · ${log.durationMinutes} min`,
      detail: log.distanceKm !== null ? `${log.distanceKm.toFixed(1)} km` : log.notes,
    })),
    ...listGroomingRecordsForPet(db, petId, subLimit).map((record) => ({
      id: record.id,
      petId: record.petId,
      occurredAt: createTimelineDate(record.groomedAt),
      kind: 'grooming' as const,
      title: `Grooming · ${record.groomingType.replaceAll('_', ' ')}`,
      detail: record.nextDueDate ? `Next due ${record.nextDueDate}` : record.provider,
    })),
    ...listTrainingLogsForPet(db, petId, subLimit).map((log) => ({
      id: log.id,
      petId: log.petId,
      occurredAt: log.loggedAt,
      kind: 'training' as const,
      title: `Training · ${log.commandName}`,
      detail: log.successRating !== null ? `Success ${log.successRating}/5` : log.notes,
    })),
    ...listPetPhotosForPet(db, petId, subLimit).map((photo) => ({
      id: photo.id,
      petId: photo.petId,
      occurredAt: photo.takenAt ?? photo.createdAt,
      kind: 'photo' as const,
      title: 'Photo added',
      detail: photo.caption ?? photo.milestoneTag,
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit)
    .map((item) => PetTimelineItemSchema.parse(item));

  return items;
}

export function buildPetSitterCard(db: DatabaseAdapter, petId: string): PetSitterCard | null {
  const pet = getPetById(db, petId);
  if (!pet) {
    return null;
  }

  return {
    pet,
    activeMedications: listMedicationsForPet(db, petId, false),
    feedingSchedules: listFeedingSchedulesForPet(db, petId),
    emergencyContacts: listEmergencyContacts(db, petId),
    breedAlerts: getBreedHealthAlerts(pet.species, pet.breed),
  };
}

export function exportPetData(db: DatabaseAdapter, petId?: string): PetExportBundle {
  const pets = petId
    ? (() => {
      const pet = getPetById(db, petId);
      return pet ? [pet] : [];
    })()
    : listPets(db, { includeArchived: true });

  const petIds = new Set(pets.map((pet) => pet.id));
  const medicationIds = new Set<string>();

  const vetVisits = pets.flatMap((pet) => listVetVisitsForPet(db, pet.id));
  const vaccinations = pets.flatMap((pet) => listVaccinationsForPet(db, pet.id));
  const medications = pets.flatMap((pet) => listMedicationsForPet(db, pet.id, true));
  medications.forEach((medication) => medicationIds.add(medication.id));
  const medicationLogs = Array.from(medicationIds).flatMap((medicationId) => listMedicationLogs(db, medicationId));
  const weightEntries = pets.flatMap((pet) => listWeightEntriesForPet(db, pet.id));
  const feedingSchedules = pets.flatMap((pet) => listFeedingSchedulesForPet(db, pet.id));
  const expenses = pets.flatMap((pet) => listExpensesForPet(db, pet.id));
  const exerciseLogs = pets.flatMap((pet) => listExerciseLogsForPet(db, pet.id));
  const groomingRecords = pets.flatMap((pet) => listGroomingRecordsForPet(db, pet.id));
  const trainingLogs = pets.flatMap((pet) => listTrainingLogsForPet(db, pet.id));
  const photos = pets.flatMap((pet) => listPetPhotosForPet(db, pet.id));
  const timeline = pets.flatMap((pet) => getPetHealthTimeline(db, pet.id, 200));
  const emergencyContacts = listEmergencyContacts(db).filter(
    (contact) => contact.petId === null || (contact.petId !== null && petIds.has(contact.petId)),
  );

  return {
    pets,
    vetVisits,
    vaccinations,
    medications,
    medicationLogs,
    weightEntries,
    feedingSchedules,
    expenses,
    emergencyContacts,
    exerciseLogs,
    groomingRecords,
    trainingLogs,
    photos,
    timeline,
  };
}

// ── Feeding Log CRUD ─────────────────────────────────────────────────

function rowToFeedingLog(row: Record<string, unknown>): FeedingLog {
  return {
    id: row.id as string,
    scheduleId: row.schedule_id as string,
    petId: row.pet_id as string,
    fedAt: row.fed_at as string,
    date: row.date as string,
    note: (row.note as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createFeedingLog(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateFeedingLogInput,
): FeedingLog {
  const input = CreateFeedingLogInputSchema.parse(rawInput);
  const fedAt = input.fedAt ?? nowIso();

  // Prevent duplicate log for same schedule+date
  const existing = db.query<Record<string, unknown>>(
    `SELECT id FROM pt_feeding_logs WHERE schedule_id = ? AND date = ? LIMIT 1`,
    [input.scheduleId, input.date],
  );
  if (existing.length > 0) {
    throw new Error('A feeding log already exists for this schedule on this date');
  }

  db.execute(
    `INSERT INTO pt_feeding_logs (id, schedule_id, pet_id, fed_at, date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.scheduleId, input.petId, fedAt, input.date, input.note, nowIso()],
  );

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_feeding_logs WHERE id = ?`, [id])
    .map(rowToFeedingLog)[0];
}

export function listFeedingLogsForDate(
  db: DatabaseAdapter,
  petId: string,
  date: string,
): FeedingLog[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM pt_feeding_logs WHERE pet_id = ? AND date = ? ORDER BY fed_at ASC`,
      [petId, date],
    )
    .map(rowToFeedingLog);
}

export function deleteFeedingLog(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM pt_feeding_logs WHERE id = ?`, [id]);
}

// ── Dietary Info CRUD ────────────────────────────────────────────────

function safeParseJsonArray(value: unknown): string[] {
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToDietaryInfo(row: Record<string, unknown>): DietaryInfo {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    allergies: safeParseJsonArray(row.allergies),
    restrictions: safeParseJsonArray(row.restrictions),
    specialInstructions: (row.special_instructions as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function upsertDietaryInfo(
  db: DatabaseAdapter,
  id: string,
  rawInput: UpsertDietaryInfoInput,
): DietaryInfo {
  const input = UpsertDietaryInfoInputSchema.parse(rawInput);
  const now = nowIso();

  const existing = db.query<Record<string, unknown>>(
    `SELECT id FROM pt_dietary_info WHERE pet_id = ? LIMIT 1`,
    [input.petId],
  );

  if (existing.length > 0) {
    db.execute(
      `UPDATE pt_dietary_info SET allergies = ?, restrictions = ?, special_instructions = ?, updated_at = ? WHERE pet_id = ?`,
      [JSON.stringify(input.allergies), JSON.stringify(input.restrictions), input.specialInstructions, now, input.petId],
    );
    return db
      .query<Record<string, unknown>>(`SELECT * FROM pt_dietary_info WHERE pet_id = ?`, [input.petId])
      .map(rowToDietaryInfo)[0];
  }

  db.execute(
    `INSERT INTO pt_dietary_info (id, pet_id, allergies, restrictions, special_instructions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.petId, JSON.stringify(input.allergies), JSON.stringify(input.restrictions), input.specialInstructions, now, now],
  );

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_dietary_info WHERE id = ?`, [id])
    .map(rowToDietaryInfo)[0];
}

export function getDietaryInfo(db: DatabaseAdapter, petId: string): DietaryInfo | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM pt_dietary_info WHERE pet_id = ?`,
    [petId],
  );
  return rows[0] ? rowToDietaryInfo(rows[0]) : null;
}

// ── Food Transition CRUD ─────────────────────────────────────────────

function rowToFoodTransition(row: Record<string, unknown>): FoodTransition {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    previousFood: row.previous_food as string,
    newFood: row.new_food as string,
    startDate: row.start_date as string,
    durationDays: row.duration_days as number,
    status: row.status as FoodTransition['status'],
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createFoodTransition(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateFoodTransitionInput,
): FoodTransition {
  const input = CreateFoodTransitionInputSchema.parse(rawInput);
  const now = nowIso();

  if (input.previousFood === input.newFood) {
    throw new Error('Previous and new food must be different');
  }

  db.transaction(() => {
    // Auto-cancel any existing active transition for this pet
    db.execute(
      `UPDATE pt_food_transitions SET status = 'cancelled', updated_at = ? WHERE pet_id = ? AND status = 'active'`,
      [now, input.petId],
    );

    db.execute(
      `INSERT INTO pt_food_transitions (id, pet_id, previous_food, new_food, start_date, duration_days, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [id, input.petId, input.previousFood, input.newFood, input.startDate, input.durationDays, input.notes, now, now],
    );
  });

  return db
    .query<Record<string, unknown>>(`SELECT * FROM pt_food_transitions WHERE id = ?`, [id])
    .map(rowToFoodTransition)[0];
}

export function getActiveTransition(db: DatabaseAdapter, petId: string): FoodTransition | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM pt_food_transitions WHERE pet_id = ? AND status = 'active' LIMIT 1`,
    [petId],
  );
  return rows[0] ? rowToFoodTransition(rows[0]) : null;
}

export function completeTransition(db: DatabaseAdapter, id: string): FoodTransition | null {
  db.execute(
    `UPDATE pt_food_transitions SET status = 'completed', updated_at = ? WHERE id = ?`,
    [nowIso(), id],
  );
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM pt_food_transitions WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToFoodTransition(rows[0]) : null;
}

// ── Update / Delete Feeding Schedule ─────────────────────────────────

export function updateFeedingSchedule(
  db: DatabaseAdapter,
  id: string,
  rawInput: UpdateFeedingScheduleInput,
): FeedingSchedule | null {
  const updates = UpdateFeedingScheduleInputSchema.parse(rawInput);
  const fields: string[] = [];
  const params: unknown[] = [];

  const mappings: Array<[string, string, unknown]> = [
    ['label', 'label', updates.label],
    ['foodName', 'food_name', updates.foodName],
    ['amount', 'amount', updates.amount],
    ['feedAt', 'feed_at', updates.feedAt],
    ['portionSize', 'portion_size', updates.portionSize],
    ['portionUnit', 'portion_unit', updates.portionUnit],
    ['portionUnitCustom', 'portion_unit_custom', updates.portionUnitCustom],
    ['mealLabel', 'meal_label', updates.mealLabel],
    ['reminderEnabled', 'reminder_enabled', updates.reminderEnabled === undefined ? undefined : updates.reminderEnabled ? 1 : 0],
    ['sortOrder', 'sort_order', updates.sortOrder],
    ['notes', 'notes', updates.notes],
  ];

  for (const [key, column, value] of mappings) {
    if ((updates as Record<string, unknown>)[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(value);
    }
  }

  if (fields.length === 0) {
    const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_feeding_schedules WHERE id = ?`, [id]);
    return rows[0] ? rowToFeedingSchedule(rows[0]) : null;
  }

  params.push(nowIso(), id);
  db.execute(`UPDATE pt_feeding_schedules SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`, params);

  const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_feeding_schedules WHERE id = ?`, [id]);
  return rows[0] ? rowToFeedingSchedule(rows[0]) : null;
}

export function deleteFeedingSchedule(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM pt_feeding_schedules WHERE id = ?`, [id]);
}

// ── Exercise Goal CRUD ───────────────────────────────────────────────

function rowToExerciseGoal(row: Record<string, unknown>): ExerciseGoal {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    dailyGoalMinutes: row.daily_goal_minutes as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function setExerciseGoal(db: DatabaseAdapter, id: string, rawInput: SetExerciseGoalInput): ExerciseGoal {
  const input = SetExerciseGoalInputSchema.parse(rawInput);
  const now = nowIso();
  const existing = db.query<Record<string, unknown>>(
    `SELECT id FROM pt_exercise_goals WHERE pet_id = ? LIMIT 1`,
    [input.petId],
  );
  if (existing.length > 0) {
    db.execute(
      `UPDATE pt_exercise_goals SET daily_goal_minutes = ?, updated_at = ? WHERE pet_id = ?`,
      [input.dailyGoalMinutes, now, input.petId],
    );
  } else {
    db.execute(
      `INSERT INTO pt_exercise_goals (id, pet_id, daily_goal_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, input.petId, input.dailyGoalMinutes, now, now],
    );
  }
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_exercise_goals WHERE pet_id = ?`, [input.petId]);
  return rowToExerciseGoal(rows[0]);
}

export function getExerciseGoal(db: DatabaseAdapter, petId: string): ExerciseGoal | null {
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_exercise_goals WHERE pet_id = ?`, [petId]);
  return rows[0] ? rowToExerciseGoal(rows[0]) : null;
}

export function deleteExerciseGoal(db: DatabaseAdapter, petId: string): void {
  db.execute(`DELETE FROM pt_exercise_goals WHERE pet_id = ?`, [petId]);
}

// ── Emergency Contact Enhancements ───────────────────────────────────

export function updateEmergencyContact(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{ label: string; clinicName: string; phone: string; address: string | null; hours: string | null; notes: string | null; isPrimary: boolean }>,
): EmergencyContact | null {
  const fields: string[] = [];
  const params: unknown[] = [];
  const now = nowIso();

  if (updates.isPrimary) {
    const existing = db.query<Record<string, unknown>>(`SELECT pet_id FROM pt_emergency_contacts WHERE id = ?`, [id]);
    if (existing[0]) {
      db.execute(
        `UPDATE pt_emergency_contacts SET is_primary = 0, updated_at = ? WHERE COALESCE(pet_id, '') = COALESCE(?, '')`,
        [now, existing[0].pet_id],
      );
    }
  }

  const mappings: Array<[string, string, unknown]> = [
    ['label', 'label', updates.label],
    ['clinicName', 'clinic_name', updates.clinicName],
    ['phone', 'phone', updates.phone],
    ['address', 'address', updates.address],
    ['hours', 'hours', updates.hours],
    ['notes', 'notes', updates.notes],
    ['isPrimary', 'is_primary', updates.isPrimary === undefined ? undefined : updates.isPrimary ? 1 : 0],
  ];

  for (const [key, column, value] of mappings) {
    if ((updates as Record<string, unknown>)[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(value);
    }
  }

  if (fields.length === 0) {
    const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_emergency_contacts WHERE id = ?`, [id]);
    return rows[0] ? rowToEmergencyContact(rows[0]) : null;
  }

  params.push(now, id);
  db.execute(`UPDATE pt_emergency_contacts SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`, params);
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_emergency_contacts WHERE id = ?`, [id]);
  return rows[0] ? rowToEmergencyContact(rows[0]) : null;
}

export function deleteEmergencyContact(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM pt_emergency_contacts WHERE id = ?`, [id]);
}

export function getPrimaryEmergencyContact(db: DatabaseAdapter, petId?: string): EmergencyContact | null {
  const rows = petId
    ? db.query<Record<string, unknown>>(
      `SELECT * FROM pt_emergency_contacts WHERE (pet_id = ? OR pet_id IS NULL) AND is_primary = 1 ORDER BY CASE WHEN pet_id = ? THEN 0 ELSE 1 END LIMIT 1`,
      [petId, petId],
    )
    : db.query<Record<string, unknown>>(`SELECT * FROM pt_emergency_contacts WHERE is_primary = 1 LIMIT 1`);
  return rows[0] ? rowToEmergencyContact(rows[0]) : null;
}

// ── Insurance CRUD ───────────────────────────────────────────────────

function rowToInsurancePolicy(row: Record<string, unknown>): InsurancePolicy {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    provider: row.provider as string,
    policyNumber: (row.policy_number as string) ?? null,
    coverageType: row.coverage_type as InsurancePolicy['coverageType'],
    monthlyPremiumCents: (row.monthly_premium_cents as number) ?? null,
    deductibleCents: (row.deductible_cents as number) ?? null,
    annualLimitCents: (row.annual_limit_cents as number) ?? null,
    startDate: row.start_date as string,
    endDate: (row.end_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToInsuranceClaim(row: Record<string, unknown>): InsuranceClaim {
  return {
    id: row.id as string,
    policyId: row.policy_id as string,
    claimDate: row.claim_date as string,
    amountCents: row.amount_cents as number,
    description: row.description as string,
    status: row.status as InsuranceClaim['status'],
    reimbursementCents: (row.reimbursement_cents as number) ?? null,
    resolvedDate: (row.resolved_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createInsurancePolicy(db: DatabaseAdapter, id: string, rawInput: CreateInsurancePolicyInput): InsurancePolicy {
  const input = CreateInsurancePolicyInputSchema.parse(rawInput);
  const now = nowIso();
  db.execute(
    `INSERT INTO pt_insurance_policies (id, pet_id, provider, policy_number, coverage_type, monthly_premium_cents, deductible_cents, annual_limit_cents, start_date, end_date, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.petId, input.provider, input.policyNumber, input.coverageType, input.monthlyPremiumCents, input.deductibleCents, input.annualLimitCents, input.startDate, input.endDate, input.notes, now, now],
  );
  return db.query<Record<string, unknown>>(`SELECT * FROM pt_insurance_policies WHERE id = ?`, [id]).map(rowToInsurancePolicy)[0];
}

export function getInsurancePoliciesForPet(db: DatabaseAdapter, petId: string): InsurancePolicy[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM pt_insurance_policies WHERE pet_id = ? ORDER BY start_date DESC`,
    [petId],
  ).map(rowToInsurancePolicy);
}

export function deleteInsurancePolicy(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM pt_insurance_policies WHERE id = ?`, [id]);
}

export function createInsuranceClaim(db: DatabaseAdapter, id: string, rawInput: CreateInsuranceClaimInput): InsuranceClaim {
  const input = CreateInsuranceClaimInputSchema.parse(rawInput);
  const now = nowIso();
  db.execute(
    `INSERT INTO pt_insurance_claims (id, policy_id, claim_date, amount_cents, description, status, reimbursement_cents, resolved_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.policyId, input.claimDate, input.amountCents, input.description, input.status, input.reimbursementCents, input.resolvedDate, input.notes, now],
  );
  return db.query<Record<string, unknown>>(`SELECT * FROM pt_insurance_claims WHERE id = ?`, [id]).map(rowToInsuranceClaim)[0];
}

export function listClaimsForPolicy(db: DatabaseAdapter, policyId: string): InsuranceClaim[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM pt_insurance_claims WHERE policy_id = ? ORDER BY claim_date DESC`,
    [policyId],
  ).map(rowToInsuranceClaim);
}

export function updateClaimStatus(db: DatabaseAdapter, id: string, status: InsuranceClaim['status'], reimbursementCents?: number | null, resolvedDate?: string | null): InsuranceClaim | null {
  ClaimStatusSchema.parse(status);
  db.execute(
    `UPDATE pt_insurance_claims SET status = ?, reimbursement_cents = COALESCE(?, reimbursement_cents), resolved_date = COALESCE(?, resolved_date) WHERE id = ?`,
    [status, reimbursementCents ?? null, resolvedDate ?? null, id],
  );
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_insurance_claims WHERE id = ?`, [id]);
  return rows[0] ? rowToInsuranceClaim(rows[0]) : null;
}

// ── Expense Budget CRUD ──────────────────────────────────────────────

function rowToExpenseBudget(row: Record<string, unknown>): ExpenseBudget {
  return {
    id: row.id as string,
    petId: (row.pet_id as string) ?? null,
    category: row.category as ExpenseBudget['category'],
    monthlyBudgetCents: row.monthly_budget_cents as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function setExpenseBudget(db: DatabaseAdapter, id: string, rawInput: SetExpenseBudgetInput): ExpenseBudget {
  const input = SetExpenseBudgetInputSchema.parse(rawInput);
  const now = nowIso();
  const existing = db.query<Record<string, unknown>>(
    `SELECT id FROM pt_expense_budgets WHERE COALESCE(pet_id, '') = COALESCE(?, '') AND category = ? LIMIT 1`,
    [input.petId, input.category],
  );
  if (existing.length > 0) {
    db.execute(
      `UPDATE pt_expense_budgets SET monthly_budget_cents = ?, updated_at = ? WHERE COALESCE(pet_id, '') = COALESCE(?, '') AND category = ?`,
      [input.monthlyBudgetCents, now, input.petId, input.category],
    );
  } else {
    db.execute(
      `INSERT INTO pt_expense_budgets (id, pet_id, category, monthly_budget_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.petId, input.category, input.monthlyBudgetCents, now, now],
    );
  }
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM pt_expense_budgets WHERE COALESCE(pet_id, '') = COALESCE(?, '') AND category = ?`,
    [input.petId, input.category],
  );
  return rowToExpenseBudget(rows[0]);
}

export function getExpenseBudgets(db: DatabaseAdapter, petId?: string | null): ExpenseBudget[] {
  const rows = petId === undefined
    ? db.query<Record<string, unknown>>(`SELECT * FROM pt_expense_budgets ORDER BY category`)
    : db.query<Record<string, unknown>>(
      `SELECT * FROM pt_expense_budgets WHERE pet_id = ? OR pet_id IS NULL ORDER BY category`,
      [petId],
    );
  return rows.map(rowToExpenseBudget);
}

// ── Grooming Interval CRUD ───────────────────────────────────────────

function rowToGroomingInterval(row: Record<string, unknown>): GroomingInterval {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    groomingType: row.grooming_type as GroomingInterval['groomingType'],
    intervalDays: row.interval_days as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function setGroomingInterval(db: DatabaseAdapter, id: string, rawInput: SetGroomingIntervalInput): GroomingInterval {
  const input = SetGroomingIntervalInputSchema.parse(rawInput);
  const now = nowIso();
  const existing = db.query<Record<string, unknown>>(
    `SELECT id FROM pt_grooming_intervals WHERE pet_id = ? AND grooming_type = ? LIMIT 1`,
    [input.petId, input.groomingType],
  );
  if (existing.length > 0) {
    db.execute(
      `UPDATE pt_grooming_intervals SET interval_days = ?, updated_at = ? WHERE pet_id = ? AND grooming_type = ?`,
      [input.intervalDays, now, input.petId, input.groomingType],
    );
  } else {
    db.execute(
      `INSERT INTO pt_grooming_intervals (id, pet_id, grooming_type, interval_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.petId, input.groomingType, input.intervalDays, now, now],
    );
  }
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM pt_grooming_intervals WHERE pet_id = ? AND grooming_type = ?`,
    [input.petId, input.groomingType],
  );
  return rowToGroomingInterval(rows[0]);
}

export function getGroomingIntervals(db: DatabaseAdapter, petId: string): GroomingInterval[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM pt_grooming_intervals WHERE pet_id = ? ORDER BY grooming_type`,
    [petId],
  ).map(rowToGroomingInterval);
}

export function updateGroomingRecord(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{ groomedAt: string; nextDueDate: string | null; provider: string | null; costCents: number | null; notes: string | null }>,
): GroomingRecord | null {
  const fields: string[] = [];
  const params: unknown[] = [];
  const mappings: Array<[string, string, unknown]> = [
    ['groomedAt', 'groomed_at', updates.groomedAt],
    ['nextDueDate', 'next_due_date', updates.nextDueDate],
    ['provider', 'provider', updates.provider],
    ['costCents', 'cost_cents', updates.costCents],
    ['notes', 'notes', updates.notes],
  ];
  for (const [key, column, value] of mappings) {
    if ((updates as Record<string, unknown>)[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(value);
    }
  }
  if (fields.length === 0) {
    const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_grooming_records WHERE id = ?`, [id]);
    return rows[0] ? rowToGroomingRecord(rows[0]) : null;
  }
  params.push(id);
  db.execute(`UPDATE pt_grooming_records SET ${fields.join(', ')} WHERE id = ?`, params);
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_grooming_records WHERE id = ?`, [id]);
  return rows[0] ? rowToGroomingRecord(rows[0]) : null;
}

export function deleteGroomingRecord(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM pt_grooming_records WHERE id = ?`, [id]);
}

/**
 * Create grooming record with auto-scheduling: if an interval exists for this type,
 * automatically set next_due_date.
 */
export function createGroomingRecordWithInterval(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateGroomingRecordInput,
): GroomingRecord {
  const input = CreateGroomingRecordInputSchema.parse(rawInput);
  const groomedAt = input.groomedAt ?? new Date().toISOString().slice(0, 10);

  // Check for interval to auto-schedule next due date
  let nextDueDate = input.nextDueDate;
  if (!nextDueDate) {
    const intervals = db.query<Record<string, unknown>>(
      `SELECT interval_days FROM pt_grooming_intervals WHERE pet_id = ? AND grooming_type = ? LIMIT 1`,
      [input.petId, input.groomingType],
    );
    if (intervals.length > 0) {
      nextDueDate = calculateNextGroomingDate(groomedAt, intervals[0].interval_days as number);
    }
  }

  return createGroomingRecord(db, id, { ...input, groomedAt, nextDueDate });
}

// ── Training Command CRUD ────────────────────────────────────────────

function rowToTrainingCommand(row: Record<string, unknown>): TrainingCommand {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    commandName: row.command_name as string,
    status: row.status as TrainingCommand['status'],
    masteredAt: (row.mastered_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function addTrainingCommand(db: DatabaseAdapter, id: string, rawInput: AddTrainingCommandInput): TrainingCommand {
  const input = AddTrainingCommandInputSchema.parse(rawInput);
  const now = nowIso();
  const existing = db.query<Record<string, unknown>>(
    `SELECT id FROM pt_training_commands WHERE pet_id = ? AND command_name = ? LIMIT 1`,
    [input.petId, input.commandName],
  );
  if (existing.length > 0) {
    return rowToTrainingCommand(
      db.query<Record<string, unknown>>(`SELECT * FROM pt_training_commands WHERE id = ?`, [existing[0].id as string])[0],
    );
  }
  db.execute(
    `INSERT INTO pt_training_commands (id, pet_id, command_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.petId, input.commandName, input.status, now, now],
  );
  return db.query<Record<string, unknown>>(`SELECT * FROM pt_training_commands WHERE id = ?`, [id]).map(rowToTrainingCommand)[0];
}

export function updateCommandStatus(db: DatabaseAdapter, petId: string, commandName: string, status: TrainingCommand['status']): TrainingCommand | null {
  CommandStatusSchema.parse(status);
  const now = nowIso();
  const masteredAt = status === 'mastered' ? now : null;
  db.execute(
    `UPDATE pt_training_commands SET status = ?, mastered_at = COALESCE(?, mastered_at), updated_at = ? WHERE pet_id = ? AND command_name = ?`,
    [status, masteredAt, now, petId, commandName],
  );
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM pt_training_commands WHERE pet_id = ? AND command_name = ?`,
    [petId, commandName],
  );
  return rows[0] ? rowToTrainingCommand(rows[0]) : null;
}

export function listTrainingCommands(db: DatabaseAdapter, petId: string): TrainingCommand[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM pt_training_commands WHERE pet_id = ? ORDER BY status ASC, command_name ASC`,
    [petId],
  ).map(rowToTrainingCommand);
}

// ── Dismissed Alert CRUD ─────────────────────────────────────────────

function rowToDismissedAlert(row: Record<string, unknown>): DismissedAlert {
  return {
    id: row.id as string,
    petId: row.pet_id as string,
    alertId: row.alert_id as string,
    dismissedAt: row.dismissed_at as string,
    createdAt: row.created_at as string,
  };
}

export function dismissAlert(db: DatabaseAdapter, id: string, petId: string, alertId: string): DismissedAlert {
  const now = nowIso();
  const existing = db.query<Record<string, unknown>>(
    `SELECT id FROM pt_dismissed_alerts WHERE pet_id = ? AND alert_id = ? LIMIT 1`,
    [petId, alertId],
  );
  if (existing.length > 0) {
    return rowToDismissedAlert(
      db.query<Record<string, unknown>>(`SELECT * FROM pt_dismissed_alerts WHERE id = ?`, [existing[0].id as string])[0],
    );
  }
  db.execute(
    `INSERT INTO pt_dismissed_alerts (id, pet_id, alert_id, dismissed_at, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, petId, alertId, now, now],
  );
  return db.query<Record<string, unknown>>(`SELECT * FROM pt_dismissed_alerts WHERE id = ?`, [id]).map(rowToDismissedAlert)[0];
}

export function getDismissedAlerts(db: DatabaseAdapter, petId: string): DismissedAlert[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM pt_dismissed_alerts WHERE pet_id = ?`,
    [petId],
  ).map(rowToDismissedAlert);
}

export function undismissAlert(db: DatabaseAdapter, petId: string, alertId: string): void {
  db.execute(`DELETE FROM pt_dismissed_alerts WHERE pet_id = ? AND alert_id = ?`, [petId, alertId]);
}

// ── Photo Enhancements ───────────────────────────────────────────────

export function updatePetPhoto(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{ caption: string | null; milestoneTag: string | null }>,
): PetPhoto | null {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (updates.caption !== undefined) { fields.push('caption = ?'); params.push(updates.caption); }
  if (updates.milestoneTag !== undefined) { fields.push('milestone_tag = ?'); params.push(updates.milestoneTag); }
  if (fields.length === 0) {
    const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_pet_photos WHERE id = ?`, [id]);
    return rows[0] ? rowToPetPhoto(rows[0]) : null;
  }
  params.push(id);
  db.execute(`UPDATE pt_pet_photos SET ${fields.join(', ')} WHERE id = ?`, params);
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM pt_pet_photos WHERE id = ?`, [id]);
  return rows[0] ? rowToPetPhoto(rows[0]) : null;
}

export function deletePetPhoto(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM pt_pet_photos WHERE id = ?`, [id]);
}

export function getPhotosByMilestone(db: DatabaseAdapter, petId: string, milestoneTag: string): PetPhoto[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM pt_pet_photos WHERE pet_id = ? AND milestone_tag = ? ORDER BY COALESCE(taken_at, created_at) DESC`,
    [petId, milestoneTag],
  ).map(rowToPetPhoto);
}

export function getPetDashboard(
  db: DatabaseAdapter,
  petId: string,
  referenceIso = new Date().toISOString(),
): PetDashboard | null {
  const pet = getPetById(db, petId);
  if (!pet) {
    return null;
  }

  const dateOnly = referenceIso.slice(0, 10);
  const dueVaccinations = db.query<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM pt_vaccinations
     WHERE pet_id = ?
       AND next_due_date IS NOT NULL
       AND date(next_due_date) <= date(?, '+30 days')`,
    [petId, dateOnly],
  )[0]?.count ?? 0;

  const dueMedications = db.query<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM pt_medications
     WHERE pet_id = ?
       AND is_active = 1
       AND next_due_at IS NOT NULL
       AND datetime(next_due_at) <= datetime(?, '+24 hours')`,
    [petId, referenceIso],
  )[0]?.count ?? 0;

  const nextFeedingAt = db.query<{ feed_at: string }>(
    `SELECT feed_at FROM pt_feeding_schedules WHERE pet_id = ? ORDER BY feed_at ASC LIMIT 1`,
    [petId],
  )[0]?.feed_at ?? null;

  const totalExpensesCents = db.query<{ total: number | null }>(
    `SELECT SUM(amount_cents) as total FROM pt_expenses WHERE pet_id = ?`,
    [petId],
  )[0]?.total ?? 0;

  const lastVetVisitDate = db.query<{ visit_date: string }>(
    `SELECT visit_date FROM pt_vet_visits WHERE pet_id = ? ORDER BY visit_date DESC LIMIT 1`,
    [petId],
  )[0]?.visit_date ?? null;

  const lastExerciseAt = db.query<{ logged_at: string }>(
    `SELECT logged_at FROM pt_exercise_logs WHERE pet_id = ? ORDER BY logged_at DESC LIMIT 1`,
    [petId],
  )[0]?.logged_at ?? null;

  const nextGroomingDueDate = db.query<{ next_due_date: string }>(
    `SELECT next_due_date
     FROM pt_grooming_records
     WHERE pet_id = ?
       AND next_due_date IS NOT NULL
       AND date(next_due_date) >= date(?)
     ORDER BY next_due_date ASC
     LIMIT 1`,
    [petId, dateOnly],
  )[0]?.next_due_date ?? null;

  const photoCount = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM pt_pet_photos WHERE pet_id = ?`,
    [petId],
  )[0]?.count ?? 0;

  return {
    petId: pet.id,
    petName: pet.name,
    dueVaccinations,
    dueMedications,
    nextFeedingAt,
    totalExpensesCents,
    lastVetVisitDate,
    latestWeightGrams: pet.currentWeightGrams,
    lastExerciseAt,
    nextGroomingDueDate,
    photoCount,
  };
}
