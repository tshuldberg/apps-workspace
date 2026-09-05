import { z } from 'zod';

// -- Measurement type enum ---------------------------------------------------
export const MeasurementTypeSchema = z.enum([
  'blood_pressure',
  'blood_sugar',
  'weight',
  'temperature',
  'heart_rate',
  'custom',
]);
export type MeasurementType = z.infer<typeof MeasurementTypeSchema>;

// -- Full record -------------------------------------------------------------
export const HealthMeasurementSchema = z.object({
  id: z.string(),
  type: MeasurementTypeSchema,
  value: z.string(),
  unit: z.string(),
  notes: z.string().nullable(),
  measuredAt: z.string(),
  createdAt: z.string(),
});

// -- Create input ------------------------------------------------------------
export const CreateMeasurementInputSchema = z.object({
  type: MeasurementTypeSchema,
  value: z.string().min(1),
  unit: z.string().min(1),
  notes: z.string().optional(),
  measuredAt: z.string().optional(),
});

// -- Update input ------------------------------------------------------------
export const UpdateMeasurementInputSchema = z.object({
  value: z.string().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  measuredAt: z.string().optional(),
});

// -- Trend data point --------------------------------------------------------
export const MeasurementTrendPointSchema = z.object({
  date: z.string(),
  value: z.string(),
});

export const MedMarkerSchema = z.object({
  medName: z.string(),
  event: z.enum(['started', 'stopped']),
  date: z.string(),
});

// -- Inferred types ----------------------------------------------------------
export type HealthMeasurement = z.infer<typeof HealthMeasurementSchema>;
export type CreateMeasurementInput = z.infer<typeof CreateMeasurementInputSchema>;
export type UpdateMeasurementInput = z.infer<typeof UpdateMeasurementInputSchema>;
export type MeasurementTrendPoint = z.infer<typeof MeasurementTrendPointSchema>;
export type MedMarker = z.infer<typeof MedMarkerSchema>;
