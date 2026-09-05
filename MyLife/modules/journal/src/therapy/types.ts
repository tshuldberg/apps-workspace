import { z } from 'zod';

export const TherapyTemplateTypeSchema = z.enum([
  'pre_session',
  'post_session',
  'crisis_plan',
  'progress_checkin',
]);
export type TherapyTemplateType = z.infer<typeof TherapyTemplateTypeSchema>;

export const TherapyTopicSectionSchema = z.enum([
  'topics', 'wins', 'challenges', 'questions',
  'takeaways', 'action_items', 'followup_questions',
  'warning_signs', 'coping_strategies', 'support_contacts', 'safe_actions',
  'original_goals', 'new_goals', 'patterns', 'working', 'not_working',
]);
export type TherapyTopicSection = z.infer<typeof TherapyTopicSectionSchema>;

export const EntryTypeSchema = z.enum(['standard', 'therapy_prep']);
export type EntryType = z.infer<typeof EntryTypeSchema>;

export const TherapyTopicSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  section: TherapyTopicSectionSchema,
  content: z.string(),
  sortOrder: z.number().int(),
  isCompleted: z.boolean(),
  createdAt: z.string(),
});
export type TherapyTopic = z.infer<typeof TherapyTopicSchema>;

export interface TherapyTemplate {
  type: TherapyTemplateType;
  name: string;
  description: string;
  icon: string;
  sections: TherapyTopicSection[];
}

export interface TherapySessionInfo {
  sessionNumber: number;
  daysSinceLastSession: number | null;
  lastSessionDate: string | null;
}
