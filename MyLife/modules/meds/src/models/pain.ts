import { z } from 'zod';

export const BODY_ZONES = [
  'head_front', 'head_back', 'head_left', 'head_right', 'head_top',
  'neck', 'throat',
  'shoulder_left', 'shoulder_right',
  'upper_arm_left', 'upper_arm_right',
  'elbow_left', 'elbow_right',
  'forearm_left', 'forearm_right',
  'wrist_left', 'wrist_right',
  'hand_left', 'hand_right',
  'chest_left', 'chest_right', 'chest_center',
  'upper_back', 'mid_back', 'lower_back',
  'abdomen_upper', 'abdomen_lower',
  'hip_left', 'hip_right',
  'thigh_left', 'thigh_right',
  'knee_left', 'knee_right',
  'shin_left', 'shin_right',
  'ankle_left', 'ankle_right',
  'foot_left', 'foot_right',
] as const;

export const BodyZoneSchema = z.enum(BODY_ZONES);
export type BodyZone = z.infer<typeof BodyZoneSchema>;

export const PainTypeSchema = z.enum([
  'sharp', 'dull', 'burning', 'throbbing', 'aching',
  'stabbing', 'cramping', 'tingling', 'shooting', 'pressure',
]);
export type PainType = z.infer<typeof PainTypeSchema>;

export const PainEntrySchema = z.object({
  id: z.string(),
  bodyZone: BodyZoneSchema,
  severity: z.number().int().min(1).max(10),
  painType: PainTypeSchema.nullable(),
  durationMinutes: z.number().int().nullable(),
  radiation: z.string().nullable(),
  notes: z.string().nullable(),
  startedAt: z.string(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PainEntry = z.infer<typeof PainEntrySchema>;

export const CreatePainEntryInputSchema = z.object({
  bodyZone: BodyZoneSchema,
  severity: z.number().int().min(1).max(10),
  painType: PainTypeSchema.optional(),
  durationMinutes: z.number().int().optional(),
  radiation: z.string().optional(),
  notes: z.string().optional(),
  startedAt: z.string().optional(),
});
export type CreatePainEntryInput = z.infer<typeof CreatePainEntryInputSchema>;

export const BODY_ZONE_LABELS: Record<BodyZone, string> = {
  head_front: 'Head (Front)', head_back: 'Head (Back)', head_left: 'Head (Left)',
  head_right: 'Head (Right)', head_top: 'Head (Top)', neck: 'Neck', throat: 'Throat',
  shoulder_left: 'Left Shoulder', shoulder_right: 'Right Shoulder',
  upper_arm_left: 'Left Upper Arm', upper_arm_right: 'Right Upper Arm',
  elbow_left: 'Left Elbow', elbow_right: 'Right Elbow',
  forearm_left: 'Left Forearm', forearm_right: 'Right Forearm',
  wrist_left: 'Left Wrist', wrist_right: 'Right Wrist',
  hand_left: 'Left Hand', hand_right: 'Right Hand',
  chest_left: 'Left Chest', chest_right: 'Right Chest', chest_center: 'Center Chest',
  upper_back: 'Upper Back', mid_back: 'Mid Back', lower_back: 'Lower Back',
  abdomen_upper: 'Upper Abdomen', abdomen_lower: 'Lower Abdomen',
  hip_left: 'Left Hip', hip_right: 'Right Hip',
  thigh_left: 'Left Thigh', thigh_right: 'Right Thigh',
  knee_left: 'Left Knee', knee_right: 'Right Knee',
  shin_left: 'Left Shin', shin_right: 'Right Shin',
  ankle_left: 'Left Ankle', ankle_right: 'Right Ankle',
  foot_left: 'Left Foot', foot_right: 'Right Foot',
};

export interface PainHeatmapEntry {
  zone: BodyZone;
  intensity: number;
  count: number;
}
