import { z } from 'zod';

// ── Human Verification ──────────────────────────────────────────────

export const HumanVerificationMethodSchema = z.enum([
  'passkey',
  'fingerprint',
  'face_id',
  'phone_sms',
]);
export type HumanVerificationMethod = z.infer<typeof HumanVerificationMethodSchema>;

export const HumanVerificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  method: HumanVerificationMethodSchema,
  attestationHash: z.string().min(1),
  verifiedAt: z.string().datetime(),
});
export type HumanVerification = z.infer<typeof HumanVerificationSchema>;

// ── Community Health ────────────────────────────────────────────────

export const CommunityHealthSchema = z.object({
  communityId: z.string().uuid(),
  verifiedHumanPercent: z.number().min(0).max(100),
  avgResponseTimeMinutes: z.number().nonnegative(),
  modActionsLast30Days: z.number().int().nonnegative(),
  signalToNoiseScore: z.number().min(0).max(10),
  memberCount: z.number().int().nonnegative(),
  activePostersLast7Days: z.number().int().nonnegative(),
  computedAt: z.string().datetime(),
});
export type CommunityHealth = z.infer<typeof CommunityHealthSchema>;

// ── Community Templates ─────────────────────────────────────────────

export const CommunityTemplateSchema = z.object({
  moduleId: z.string(),
  name: z.string(),
  displayName: z.string(),
  description: z.string(),
  defaultRules: z.array(z.string()),
  defaultTags: z.array(z.string()),
  welcomePost: z.object({
    title: z.string(),
    body: z.string(),
  }),
  humansOnly: z.boolean().default(true),
});
export type CommunityTemplate = z.infer<typeof CommunityTemplateSchema>;

// ── Cross-Module Content Cards ──────────────────────────────────────

export const ContentCardTargetSchema = z.enum([
  'books',
  'recipes',
  'workouts',
  'budget',
  'surf',
  'trails',
  'stars',
  'closet',
  'garden',
]);
export type ContentCardTarget = z.infer<typeof ContentCardTargetSchema>;

export const ContentCardSchema = z.object({
  moduleId: ContentCardTargetSchema,
  itemId: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  deepLink: z.string(),
  metadata: z.record(z.string()).optional(),
});
export type ContentCard = z.infer<typeof ContentCardSchema>;
