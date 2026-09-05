import { z } from 'zod';

// ── Zodiac ────────────────────────────────────────────────────────────

export const ZodiacSignSchema = z.enum([
  'aries', 'taurus', 'gemini', 'cancer',
  'leo', 'virgo', 'libra', 'scorpio',
  'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);
export type ZodiacSign = z.infer<typeof ZodiacSignSchema>;

export const ZodiacElementSchema = z.enum(['fire', 'earth', 'air', 'water']);
export type ZodiacElement = z.infer<typeof ZodiacElementSchema>;

// ── Moon Phase ────────────────────────────────────────────────────────

export const MoonPhaseSchema = z.enum([
  'new_moon',
  'waxing_crescent',
  'first_quarter',
  'waxing_gibbous',
  'full_moon',
  'waning_gibbous',
  'last_quarter',
  'waning_crescent',
]);
export type MoonPhase = z.infer<typeof MoonPhaseSchema>;

// ── Aspect ────────────────────────────────────────────────────────────

export const AspectSchema = z.enum([
  'conjunction',
  'sextile',
  'square',
  'trine',
  'opposition',
]);
export type Aspect = z.infer<typeof AspectSchema>;

// ── Tarot ─────────────────────────────────────────────────────────────

export const TarotSuitSchema = z.enum(['Wands', 'Cups', 'Swords', 'Pentacles']);
export type TarotSuit = z.infer<typeof TarotSuitSchema>;

export const TarotArcanaSchema = z.enum(['major', 'minor']);
export type TarotArcana = z.infer<typeof TarotArcanaSchema>;

export const TarotSpreadTypeSchema = z.enum([
  'daily_card',
  'one_card',
  'three_card',
  'celtic_cross',
  'relationship',
  'horseshoe',
]);
export type TarotSpreadType = z.infer<typeof TarotSpreadTypeSchema>;

export const TarotCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  number: z.number(),
  suit: TarotSuitSchema.nullable(),
  arcana: TarotArcanaSchema,
  keywords: z.array(z.string()),
  uprightMeaning: z.string(),
  reversedMeaning: z.string(),
  loveMeaning: z.string(),
  careerMeaning: z.string(),
  spiritualMeaning: z.string(),
  prompt: z.string(),
  element: z.string().nullable().optional(),
  timing: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});
export type TarotCard = z.infer<typeof TarotCardSchema>;

export const TarotSpreadPositionSchema = z.object({
  label: z.string(),
  meaning: z.string(),
});
export type TarotSpreadPosition = z.infer<typeof TarotSpreadPositionSchema>;

export const TarotSpreadDefinitionSchema = z.object({
  type: TarotSpreadTypeSchema,
  name: z.string(),
  shortLabel: z.string(),
  description: z.string(),
  questionPrompt: z.string(),
  cardCount: z.number().int().positive(),
  positions: z.array(TarotSpreadPositionSchema),
  icon: z.string(),
});
export type TarotSpreadDefinition = z.infer<typeof TarotSpreadDefinitionSchema>;

// ── Birth Profile ─────────────────────────────────────────────────────

export const BirthProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  birthDate: z.string(),
  birthTime: z.string().nullable(),
  birthLat: z.number().nullable(),
  birthLng: z.number().nullable(),
  birthPlace: z.string().nullable(),
  sunSign: ZodiacSignSchema.nullable(),
  moonSign: ZodiacSignSchema.nullable(),
  risingSign: ZodiacSignSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BirthProfile = z.infer<typeof BirthProfileSchema>;

export const CreateBirthProfileInputSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string(),
  birthTime: z.string().nullable().optional(),
  birthLat: z.number().nullable().optional(),
  birthLng: z.number().nullable().optional(),
  birthPlace: z.string().nullable().optional(),
  sunSign: ZodiacSignSchema.nullable().optional(),
  moonSign: ZodiacSignSchema.nullable().optional(),
  risingSign: ZodiacSignSchema.nullable().optional(),
});
export type CreateBirthProfileInput = z.infer<typeof CreateBirthProfileInputSchema>;

export const UpdateBirthProfileInputSchema = z.object({
  name: z.string().min(1).optional(),
  birthDate: z.string().optional(),
  birthTime: z.string().nullable().optional(),
  birthLat: z.number().nullable().optional(),
  birthLng: z.number().nullable().optional(),
  birthPlace: z.string().nullable().optional(),
  sunSign: ZodiacSignSchema.nullable().optional(),
  moonSign: ZodiacSignSchema.nullable().optional(),
  risingSign: ZodiacSignSchema.nullable().optional(),
});
export type UpdateBirthProfileInput = z.infer<typeof UpdateBirthProfileInputSchema>;

// ── Transit ───────────────────────────────────────────────────────────

export const TransitSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  date: z.string(),
  planet: z.string(),
  sign: ZodiacSignSchema,
  aspect: z.string().nullable(),
  description: z.string().nullable(),
});
export type Transit = z.infer<typeof TransitSchema>;

export const CreateTransitInputSchema = z.object({
  profileId: z.string(),
  date: z.string(),
  planet: z.string(),
  sign: ZodiacSignSchema,
  aspect: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type CreateTransitInput = z.infer<typeof CreateTransitInputSchema>;

// ── Daily Reading ─────────────────────────────────────────────────────

export const DailyReadingSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  date: z.string(),
  moonPhase: MoonPhaseSchema,
  moonSign: ZodiacSignSchema.nullable(),
  summary: z.string().nullable(),
  tarotCard: z.string().nullable(),
  tarotCardId: z.string().nullable().optional(),
  tarotIsReversed: z.boolean().optional(),
  journalPrompt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type DailyReading = z.infer<typeof DailyReadingSchema>;

export const CreateDailyReadingInputSchema = z.object({
  profileId: z.string(),
  date: z.string(),
  moonPhase: MoonPhaseSchema,
  moonSign: ZodiacSignSchema.nullable().optional(),
  summary: z.string().nullable().optional(),
  tarotCard: z.string().nullable().optional(),
  tarotCardId: z.string().nullable().optional(),
  tarotIsReversed: z.boolean().optional(),
  journalPrompt: z.string().nullable().optional(),
});
export type CreateDailyReadingInput = z.infer<typeof CreateDailyReadingInputSchema>;

export const TarotReadingCardSchema = z.object({
  cardId: z.string(),
  cardName: z.string(),
  positionLabel: z.string(),
  positionMeaning: z.string(),
  reversed: z.boolean(),
  interpretation: z.string(),
});
export type TarotReadingCard = z.infer<typeof TarotReadingCardSchema>;

export const TarotReadingSchema = z.object({
  id: z.string(),
  profileId: z.string().nullable(),
  readingDate: z.string(),
  spreadType: TarotSpreadTypeSchema,
  title: z.string(),
  question: z.string().nullable(),
  narrative: z.string().nullable(),
  notes: z.string().nullable(),
  cards: z.array(TarotReadingCardSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TarotReading = z.infer<typeof TarotReadingSchema>;

export const CreateTarotReadingInputSchema = z.object({
  profileId: z.string().nullable().optional(),
  readingDate: z.string(),
  spreadType: TarotSpreadTypeSchema,
  title: z.string().min(1),
  question: z.string().nullable().optional(),
  narrative: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  cards: z.array(TarotReadingCardSchema).min(1),
});
export type CreateTarotReadingInput = z.infer<typeof CreateTarotReadingInputSchema>;

// ── Saved Chart ───────────────────────────────────────────────────────

export const SavedChartSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  chartType: z.string(),
  title: z.string(),
  data: z.string(),
  createdAt: z.string(),
});
export type SavedChart = z.infer<typeof SavedChartSchema>;

// ── Compatibility Result ──────────────────────────────────────────────

export const CompatibilityResultSchema = z.object({
  sign1: ZodiacSignSchema,
  sign2: ZodiacSignSchema,
  score: z.number().min(0).max(100),
  element1: ZodiacElementSchema,
  element2: ZodiacElementSchema,
  description: z.string(),
});
export type CompatibilityResult = z.infer<typeof CompatibilityResultSchema>;

// ── Stats ─────────────────────────────────────────────────────────────

export const StarsStatsSchema = z.object({
  totalProfiles: z.number(),
  totalTransits: z.number(),
  totalReadings: z.number(),
  totalSavedCharts: z.number(),
  currentMoonPhase: MoonPhaseSchema.nullable(),
});
export type StarsStats = z.infer<typeof StarsStatsSchema>;
