import { z } from 'zod';

export const CaregiverRelationshipSchema = z.enum([
  'spouse', 'parent', 'child', 'sibling', 'friend', 'doctor', 'nurse', 'other',
]);
export type CaregiverRelationship = z.infer<typeof CaregiverRelationshipSchema>;

export const AlertMethodSchema = z.enum(['sms', 'email', 'both']);
export type AlertMethod = z.infer<typeof AlertMethodSchema>;

export const AlertTypeSchema = z.enum(['missed_dose', 'low_adherence', 'low_supply', 'custom']);
export type AlertType = z.infer<typeof AlertTypeSchema>;

export const AlertStatusSchema = z.enum(['pending', 'sent', 'failed']);
export type AlertStatus = z.infer<typeof AlertStatusSchema>;

export const CaregiverSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  relationship: CaregiverRelationshipSchema.nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Caregiver = z.infer<typeof CaregiverSchema>;

export const CreateCaregiverInputSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  relationship: CaregiverRelationshipSchema.optional(),
}).refine((d) => d.phone || d.email, { message: 'Phone or email required' });
export type CreateCaregiverInput = z.infer<typeof CreateCaregiverInputSchema>;

export const CaregiverAlertConfigSchema = z.object({
  id: z.string(),
  caregiverId: z.string(),
  medicationId: z.string().nullable(),
  alertAllMeds: z.boolean(),
  delayMinutes: z.number().int().min(0),
  alertMethod: AlertMethodSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type CaregiverAlertConfig = z.infer<typeof CaregiverAlertConfigSchema>;

export const CaregiverAlertSchema = z.object({
  id: z.string(),
  caregiverId: z.string(),
  medicationId: z.string().nullable(),
  alertType: AlertTypeSchema,
  message: z.string(),
  sentAt: z.string(),
  deliveryMethod: AlertMethodSchema,
  status: AlertStatusSchema,
  createdAt: z.string(),
});
export type CaregiverAlert = z.infer<typeof CaregiverAlertSchema>;
