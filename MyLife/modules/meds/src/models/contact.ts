import { z } from 'zod';

export const ContactTypeSchema = z.enum([
  'doctor',
  'pharmacy',
  'clinic',
  'lab',
  'therapist',
  'specialist',
  'emergency',
  'insurance',
  'other',
]);
export type ContactType = z.infer<typeof ContactTypeSchema>;

export const ContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ContactTypeSchema,
  specialty: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const CreateContactInputSchema = z.object({
  name: z.string().min(1),
  type: ContactTypeSchema.default('doctor'),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateContactInput = z.infer<typeof CreateContactInputSchema>;
