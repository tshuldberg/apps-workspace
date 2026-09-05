import { z } from 'zod';

export const FODMAPRatingSchema = z.enum(['low', 'moderate', 'high']);
export type FODMAPRating = z.infer<typeof FODMAPRatingSchema>;

export const FODMAPFoodCategorySchema = z.enum([
  'fruit', 'vegetable', 'grain', 'dairy', 'protein', 'legume',
  'nut_seed', 'sweetener', 'condiment', 'beverage', 'other',
]);
export type FODMAPFoodCategory = z.infer<typeof FODMAPFoodCategorySchema>;

export const FoodMealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type FoodMealType = z.infer<typeof FoodMealTypeSchema>;

export const FODMAPFoodSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: FODMAPFoodCategorySchema,
  fodmapRating: FODMAPRatingSchema,
  fructose: z.boolean(),
  lactose: z.boolean(),
  fructan: z.boolean(),
  galactan: z.boolean(),
  polyol: z.boolean(),
  servingSize: z.string().nullable(),
  notes: z.string().nullable(),
});
export type FODMAPFood = z.infer<typeof FODMAPFoodSchema>;

export const FoodDiaryEntrySchema = z.object({
  id: z.string(),
  mealType: FoodMealTypeSchema,
  foodItems: z.string(),
  fodmapRating: z.enum(['low', 'moderate', 'high', 'unknown']),
  fodmapTypes: z.string().nullable(),
  portionSize: z.string().nullable(),
  notes: z.string().nullable(),
  eatenAt: z.string(),
  createdAt: z.string(),
});
export type FoodDiaryEntry = z.infer<typeof FoodDiaryEntrySchema>;

export const CreateFoodDiaryInputSchema = z.object({
  mealType: FoodMealTypeSchema,
  foodItems: z.string().min(1),
  fodmapRating: z.enum(['low', 'moderate', 'high', 'unknown']).optional(),
  fodmapTypes: z.string().optional(),
  portionSize: z.string().optional(),
  notes: z.string().optional(),
  eatenAt: z.string().optional(),
});
export type CreateFoodDiaryInput = z.infer<typeof CreateFoodDiaryInputSchema>;

export const StoolLogSchema = z.object({
  id: z.string(),
  bristolType: z.number().int().min(1).max(7),
  urgency: z.number().int().min(1).max(5),
  painLevel: z.number().int().min(0).max(5),
  blood: z.boolean(),
  notes: z.string().nullable(),
  loggedAt: z.string(),
  createdAt: z.string(),
});
export type StoolLog = z.infer<typeof StoolLogSchema>;

export const CreateStoolLogInputSchema = z.object({
  bristolType: z.number().int().min(1).max(7),
  urgency: z.number().int().min(1).max(5).optional(),
  painLevel: z.number().int().min(0).max(5).optional(),
  blood: z.boolean().optional(),
  notes: z.string().optional(),
  loggedAt: z.string().optional(),
});
export type CreateStoolLogInput = z.infer<typeof CreateStoolLogInputSchema>;
