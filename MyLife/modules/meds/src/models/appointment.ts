import { z } from 'zod';

export const AppointmentTypeSchema = z.enum([
  'checkup',
  'follow_up',
  'lab',
  'specialist',
  'therapy',
  'screening',
  'procedure',
  'vaccination',
  'dental',
  'eye_exam',
  'other',
]);
export type AppointmentType = z.infer<typeof AppointmentTypeSchema>;

export const AppointmentStatusSchema = z.enum([
  'scheduled',
  'completed',
  'cancelled',
  'missed',
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

export const AppointmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  appointmentType: AppointmentTypeSchema,
  providerContactId: z.string().nullable(),
  providerName: z.string().nullable(),
  specialty: z.string().nullable(),
  scheduledAt: z.string(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  reminderEnabled: z.boolean(),
  reminderMinutesBefore: z.number().int().min(0),
  status: AppointmentStatusSchema,
  linkedMedicationIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const CreateAppointmentInputSchema = z.object({
  title: z.string().min(1),
  appointmentType: AppointmentTypeSchema.default('checkup'),
  providerContactId: z.string().optional(),
  providerName: z.string().optional(),
  specialty: z.string().optional(),
  scheduledAt: z.string().min(1),
  location: z.string().optional(),
  notes: z.string().optional(),
  reminderEnabled: z.boolean().default(true),
  reminderMinutesBefore: z.number().int().min(0).default(120),
  status: AppointmentStatusSchema.default('scheduled'),
  linkedMedicationIds: z.array(z.string()).default([]),
});
export type CreateAppointmentInput = z.input<typeof CreateAppointmentInputSchema>;
