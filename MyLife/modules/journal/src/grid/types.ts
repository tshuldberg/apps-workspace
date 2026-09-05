import { z } from 'zod';

export const GridCellSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  cellRow: z.number().int().min(0).max(3),
  cellCol: z.number().int().min(0).max(3),
  prompt: z.string(),
  content: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GridCell = z.infer<typeof GridCellSchema>;

export const GridConfigCellSchema = z.object({
  row: z.number().int().min(0).max(3),
  col: z.number().int().min(0).max(3),
  prompt: z.string(),
});

export const GridConfigSchema = z.object({
  rows: z.number().int().min(1).max(4),
  cols: z.number().int().min(1).max(4),
  cells: z.array(GridConfigCellSchema),
});
export type GridConfig = z.infer<typeof GridConfigSchema>;

export const GridLayoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  rows: z.number().int().min(1).max(4),
  cols: z.number().int().min(1).max(4),
  isBuiltin: z.boolean(),
  gridConfig: GridConfigSchema,
  usageCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GridLayout = z.infer<typeof GridLayoutSchema>;
