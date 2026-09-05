import { z } from 'zod';

export const BoardOrientationSchema = z.enum(['portrait', 'landscape']);
export type BoardOrientation = z.infer<typeof BoardOrientationSchema>;

export const VisionBoardItemTypeSchema = z.enum(['image', 'text', 'quote', 'goal']);
export type VisionBoardItemType = z.infer<typeof VisionBoardItemTypeSchema>;

export const VisionBoardSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  title: z.string(),
  orientation: BoardOrientationSchema,
  backgroundColor: z.string(),
  isDailyVision: z.boolean(),
  itemCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VisionBoard = z.infer<typeof VisionBoardSchema>;

export const VisionBoardItemSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  itemType: VisionBoardItemTypeSchema,
  content: z.string().nullable(),
  imagePath: z.string().nullable(),
  positionX: z.number().min(0).max(1),
  positionY: z.number().min(0).max(1),
  width: z.number().min(0.05).max(1),
  height: z.number().min(0.05).max(1),
  rotationDeg: z.number().min(-180).max(180),
  zIndex: z.number().int(),
  backgroundColor: z.string().nullable(),
  fontSize: z.number().int().nullable(),
  goalTargetDate: z.string().nullable(),
  goalProgress: z.number().int().min(0).max(100).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VisionBoardItem = z.infer<typeof VisionBoardItemSchema>;

export const MAX_BOARDS = 10;
export const MAX_ITEMS_PER_BOARD = 50;
