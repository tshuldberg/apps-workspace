import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────

export const CyclePhaseSchema = z.enum([
  'menstrual',
  'follicular',
  'ovulation',
  'luteal',
]);
export type CyclePhase = z.infer<typeof CyclePhaseSchema>;

export const FlowLevelSchema = z.enum(['light', 'medium', 'heavy', 'spotting']);
export type FlowLevel = z.infer<typeof FlowLevelSchema>;

export const SymptomCategorySchema = z.enum(['physical', 'mood', 'other']);
export type SymptomCategory = z.infer<typeof SymptomCategorySchema>;

export const SymptomIntensitySchema = z.enum(['mild', 'moderate', 'severe']);
export type SymptomIntensity = z.infer<typeof SymptomIntensitySchema>;

// ── Core Models ───────────────────────────────────────────────────────

export const CycleSchema = z.object({
  id: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  periodEndDate: z.string().nullable(),
  lengthDays: z.number().int().nullable(),
  periodLength: z.number().int().nullable(),
  createdAt: z.string(),
});
export type Cycle = z.infer<typeof CycleSchema>;

export const CycleDaySchema = z.object({
  id: z.string(),
  date: z.string(),
  cycleId: z.string().nullable(),
  phase: CyclePhaseSchema.nullable(),
  flowLevel: FlowLevelSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type CycleDay = z.infer<typeof CycleDaySchema>;

export const SymptomSchema = z.object({
  id: z.string(),
  cycleDayId: z.string(),
  category: SymptomCategorySchema,
  symptom: z.string(),
  intensity: SymptomIntensitySchema,
  createdAt: z.string(),
});
export type Symptom = z.infer<typeof SymptomSchema>;

// ── Input Schemas ─────────────────────────────────────────────────────

export const CreateCycleInputSchema = z.object({
  startDate: z.string(),
  periodEndDate: z.string().optional(),
});
export type CreateCycleInput = z.infer<typeof CreateCycleInputSchema>;

export const CreateCycleDayInputSchema = z.object({
  date: z.string(),
  cycleId: z.string().optional(),
  phase: CyclePhaseSchema.optional(),
  flowLevel: FlowLevelSchema.optional(),
  notes: z.string().optional(),
  symptoms: z
    .array(
      z.object({
        category: SymptomCategorySchema,
        symptom: z.string(),
        intensity: SymptomIntensitySchema.default('moderate'),
      }),
    )
    .default([]),
});
export type CreateCycleDayInput = z.infer<typeof CreateCycleDayInputSchema>;
/** Input type for createCycleDay - allows omitting fields with Zod defaults. */
export type CreateCycleDayRawInput = z.input<typeof CreateCycleDayInputSchema>;

export const UpdateCycleDayInputSchema = z.object({
  phase: CyclePhaseSchema.nullable().optional(),
  flowLevel: FlowLevelSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type UpdateCycleDayInput = z.infer<typeof UpdateCycleDayInputSchema>;

// ── Analytics Types ───────────────────────────────────────────────────

export const CycleStatsSchema = z.object({
  totalCycles: z.number().int(),
  averageCycleLength: z.number().nullable(),
  averagePeriodLength: z.number().nullable(),
  shortestCycle: z.number().int().nullable(),
  longestCycle: z.number().int().nullable(),
  cycleLengthStdDev: z.number().nullable(),
});
export type CycleStats = z.infer<typeof CycleStatsSchema>;

export const CyclePredictionSchema = z.object({
  predictedStartDate: z.string(),
  predictedEndDate: z.string(),
  fertileWindowStart: z.string().nullable(),
  fertileWindowEnd: z.string().nullable(),
  confidence: z.number(),
  daysUntilNextPeriod: z.number().int(),
});
export type CyclePrediction = z.infer<typeof CyclePredictionSchema>;

// ── Temperature Types ─────────────────────────────────────────────────

export const TemperatureMethodSchema = z.enum(['oral', 'vaginal', 'skin_wearable']);
export type TemperatureMethod = z.infer<typeof TemperatureMethodSchema>;

export const TemperatureUnitSchema = z.enum(['celsius', 'fahrenheit']);
export type TemperatureUnit = z.infer<typeof TemperatureUnitSchema>;

export const TemperatureSchema = z.object({
  id: z.string(),
  date: z.string(),
  cycleDayId: z.string().nullable(),
  valueCelsius: z.number(),
  timeTaken: z.string().nullable(),
  method: TemperatureMethodSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Temperature = z.infer<typeof TemperatureSchema>;

export const CreateTemperatureInputSchema = z.object({
  date: z.string(),
  valueCelsius: z.number().min(35.0).max(42.0),
  timeTaken: z.string().optional(),
  method: TemperatureMethodSchema.default('oral'),
  notes: z.string().optional(),
});
export type CreateTemperatureInput = z.infer<typeof CreateTemperatureInputSchema>;
/** Input type for createTemperature - allows omitting fields with Zod defaults. */
export type CreateTemperatureRawInput = z.input<typeof CreateTemperatureInputSchema>;

export interface CoverlineResult {
  coverline: number;
  shiftDetected: boolean;
  shiftStartIndex: number | null;
}

// ── Pregnancy Types ──────────────────────────────────────────────────

export const PregnancyStatusSchema = z.enum(['active', 'completed', 'loss']);
export type PregnancyStatus = z.infer<typeof PregnancyStatusSchema>;

export const PregnancyStartMethodSchema = z.enum([
  'last_period',
  'conception_date',
  'due_date',
  'transfer_date',
]);
export type PregnancyStartMethod = z.infer<typeof PregnancyStartMethodSchema>;

export const PregnancyConfigSchema = z.object({
  id: z.string(),
  status: PregnancyStatusSchema,
  startMethod: PregnancyStartMethodSchema,
  lastPeriodDate: z.string().nullable(),
  conceptionDate: z.string().nullable(),
  dueDate: z.string(),
  actualEndDate: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PregnancyConfig = z.infer<typeof PregnancyConfigSchema>;

export const CreatePregnancyInputSchema = z.object({
  startMethod: PregnancyStartMethodSchema,
  lastPeriodDate: z.string().optional(),
  conceptionDate: z.string().optional(),
  dueDate: z.string().optional(),
  transferDate: z.string().optional(),
  notes: z.string().optional(),
});
export type CreatePregnancyInput = z.infer<typeof CreatePregnancyInputSchema>;

export const AppointmentSchema = z.object({
  id: z.string(),
  pregnancyId: z.string(),
  title: z.string(),
  date: z.string(),
  time: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  completed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const CreateAppointmentInputSchema = z.object({
  pregnancyId: z.string(),
  title: z.string(),
  date: z.string(),
  time: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentInputSchema>;

export const UpdateAppointmentInputSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  time: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  completed: z.boolean().optional(),
});
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentInputSchema>;

export const PregnancyWeekInfoSchema = z.object({
  week: z.number().int().min(1).max(42),
  trimester: z.number().int().min(1).max(3),
  babySize: z.string(),
  babySizeCm: z.number(),
  developmentHighlight: z.string(),
});
export type PregnancyWeekInfo = z.infer<typeof PregnancyWeekInfoSchema>;

// ── Pregnancy Symptom Constants ──────────────────────────────────────

export const PREGNANCY_PHYSICAL_SYMPTOMS = [
  'morning_sickness',
  'fatigue',
  'back_pain',
  'heartburn',
  'swelling',
  'round_ligament_pain',
  'braxton_hicks',
  'insomnia',
  'constipation',
  'frequent_urination',
] as const;

export const PREGNANCY_MOOD_SYMPTOMS = [
  'anxious',
  'excited',
  'overwhelmed',
  'nesting',
  'emotional',
  'calm',
] as const;

// ── Constants ─────────────────────────────────────────────────────────

// ── Partner Sync Types ───────────────────────────────────────────────

export const PartnerLinkStatusSchema = z.enum(['active', 'revoked']);
export type PartnerLinkStatus = z.infer<typeof PartnerLinkStatusSchema>;

export const PartnerLinkSchema = z.object({
  id: z.string(),
  linkCode: z.string(),
  partnerName: z.string().nullable(),
  status: PartnerLinkStatusSchema,
  sharePhase: z.boolean(),
  sharePredictions: z.boolean(),
  shareFertileWindow: z.boolean(),
  shareSymptoms: z.boolean(),
  shareMood: z.boolean(),
  shareTemperature: z.boolean(),
  sharePregnancy: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PartnerLink = z.infer<typeof PartnerLinkSchema>;

export const CreatePartnerLinkInputSchema = z.object({
  partnerName: z.string().optional(),
  sharePhase: z.boolean().default(true),
  sharePredictions: z.boolean().default(true),
  shareFertileWindow: z.boolean().default(false),
  shareSymptoms: z.boolean().default(false),
  shareMood: z.boolean().default(false),
  shareTemperature: z.boolean().default(false),
  sharePregnancy: z.boolean().default(true),
});
export type CreatePartnerLinkInput = z.infer<typeof CreatePartnerLinkInputSchema>;
export type CreatePartnerLinkRawInput = z.input<typeof CreatePartnerLinkInputSchema>;

export const UpdatePartnerLinkInputSchema = z.object({
  partnerName: z.string().nullable().optional(),
  sharePhase: z.boolean().optional(),
  sharePredictions: z.boolean().optional(),
  shareFertileWindow: z.boolean().optional(),
  shareSymptoms: z.boolean().optional(),
  shareMood: z.boolean().optional(),
  shareTemperature: z.boolean().optional(),
  sharePregnancy: z.boolean().optional(),
});
export type UpdatePartnerLinkInput = z.infer<typeof UpdatePartnerLinkInputSchema>;

export const SharedCycleViewSchema = z.object({
  version: z.literal(1),
  linkCode: z.string(),
  generatedAt: z.string(),
  currentPhase: CyclePhaseSchema.nullable(),
  cycleDay: z.number().int().nullable(),
  predictedNextPeriod: z.string().nullable(),
  fertileWindowStart: z.string().nullable(),
  fertileWindowEnd: z.string().nullable(),
  symptomSummary: z.string().nullable(),
  pregnancyWeek: z.number().int().nullable(),
  pregnancyDueDate: z.string().nullable(),
  partnerName: z.string().nullable(),
});
export type SharedCycleView = z.infer<typeof SharedCycleViewSchema>;

// ── Constants ─────────────────────────────────────────────────────────

export const PHYSICAL_SYMPTOMS = [
  'cramps',
  'headache',
  'bloating',
  'breast_tenderness',
  'fatigue',
  'acne',
  'backache',
] as const;

export const MOOD_SYMPTOMS = [
  'happy',
  'anxious',
  'irritable',
  'sad',
  'energetic',
  'calm',
] as const;
