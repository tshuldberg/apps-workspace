import { z } from 'zod';

export const PhiloTraditionSchema = z.enum([
  'stoicism', 'buddhism', 'existentialism', 'pragmatism', 'general_wisdom',
]);
export type PhiloTradition = z.infer<typeof PhiloTraditionSchema>;

export const PhilosophyQuoteSchema = z.object({
  id: z.string(),
  dayNumber: z.number().int().min(1).max(366),
  quoteText: z.string(),
  author: z.string(),
  tradition: PhiloTraditionSchema,
  reflectionPrompt: z.string(),
  isFavorite: z.boolean(),
  timesReflected: z.number().int(),
  createdAt: z.string(),
});
export type PhilosophyQuote = z.infer<typeof PhilosophyQuoteSchema>;
