import { z } from 'zod';

export const ThoughtRecordStatusSchema = z.enum(['draft', 'complete']);
export type ThoughtRecordStatus = z.infer<typeof ThoughtRecordStatusSchema>;

export const DistortionTypeSchema = z.enum([
  'all_or_nothing',
  'overgeneralization',
  'mental_filter',
  'disqualifying_positive',
  'mind_reading',
  'fortune_telling',
  'magnification',
  'minimization',
  'emotional_reasoning',
  'should_statements',
  'labeling',
  'personalization',
  'blame',
  'always_being_right',
  'fallacy_of_fairness',
]);
export type DistortionType = z.infer<typeof DistortionTypeSchema>;

export const ThoughtRecordSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  status: ThoughtRecordStatusSchema,
  situation: z.string().nullable(),
  situationDate: z.string().nullable(),
  automaticThought: z.string().nullable(),
  thoughtBeliefBefore: z.number().int().min(0).max(100).nullable(),
  rationalResponse: z.string().nullable(),
  evidenceFor: z.string().nullable(),
  evidenceAgainst: z.string().nullable(),
  thoughtBeliefAfter: z.number().int().min(0).max(100).nullable(),
  outcomeNote: z.string().nullable(),
  currentStep: z.number().int().min(1).max(6),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ThoughtRecord = z.infer<typeof ThoughtRecordSchema>;

export const RecordEmotionSchema = z.object({
  id: z.string(),
  thoughtRecordId: z.string(),
  emotionName: z.string(),
  intensityBefore: z.number().int().min(0).max(100),
  intensityAfter: z.number().int().min(0).max(100).nullable(),
});
export type RecordEmotion = z.infer<typeof RecordEmotionSchema>;

export const RecordDistortionSchema = z.object({
  id: z.string(),
  thoughtRecordId: z.string(),
  distortionType: DistortionTypeSchema,
});
export type RecordDistortion = z.infer<typeof RecordDistortionSchema>;

export interface EmotionalImpact {
  averageReduction: number;
  emotions: Array<{
    name: string;
    before: number;
    after: number | null;
    reduction: number | null;
  }>;
}

export interface DistortionFrequency {
  distortionType: DistortionType;
  count: number;
}

export const PREDEFINED_EMOTIONS = [
  'angry', 'anxious', 'ashamed', 'bored', 'calm',
  'confused', 'content', 'disappointed', 'disgusted', 'embarrassed',
  'excited', 'frustrated', 'grateful', 'guilty', 'happy',
  'hopeful', 'hopeless', 'jealous', 'lonely', 'loved',
  'nervous', 'overwhelmed', 'peaceful', 'proud', 'relieved',
  'sad', 'scared', 'stressed', 'surprised', 'worried',
] as const;
