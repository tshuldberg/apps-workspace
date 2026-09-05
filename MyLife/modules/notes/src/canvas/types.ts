import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────

export const CanvasNodeTypeEnum = z.enum(['text', 'note', 'image', 'link', 'group', 'shape']);
export type CanvasNodeType = z.infer<typeof CanvasNodeTypeEnum>;

export const CanvasShapeEnum = z.enum(['rectangle', 'rounded', 'ellipse', 'diamond', 'hexagon']);
export type CanvasShape = z.infer<typeof CanvasShapeEnum>;

export const CanvasEdgeStyleEnum = z.enum(['straight', 'curved', 'step']);
export type CanvasEdgeStyle = z.infer<typeof CanvasEdgeStyleEnum>;

// ── Canvas Entity ────────────────────────────────────────────────────

export const CanvasSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  folderId: z.string().nullable(),
  thumbnailPath: z.string().nullable(),
  canvasJson: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  isPinned: z.boolean(),
  nodeCount: z.number().int(),
  edgeCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Canvas = z.infer<typeof CanvasSchema>;

// ── Canvas Node Entity ───────────────────────────────────────────────

export const CanvasNodeSchema = z.object({
  id: z.string(),
  canvasId: z.string(),
  nodeType: CanvasNodeTypeEnum,
  label: z.string(),
  content: z.string(),
  refNoteId: z.string().nullable(),
  refAttachmentId: z.string().nullable(),
  url: z.string().nullable(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  color: z.string(),
  shape: CanvasShapeEnum,
  groupId: z.string().nullable(),
  zIndex: z.number().int(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CanvasNode = z.infer<typeof CanvasNodeSchema>;

// ── Canvas Edge Entity ───────────────────────────────────────────────

export const CanvasEdgeSchema = z.object({
  id: z.string(),
  canvasId: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  label: z.string(),
  edgeStyle: CanvasEdgeStyleEnum,
  arrowStart: z.boolean(),
  arrowEnd: z.boolean(),
  color: z.string(),
  strokeWidth: z.number(),
  createdAt: z.string(),
});
export type CanvasEdge = z.infer<typeof CanvasEdgeSchema>;

// ── Viewport ─────────────────────────────────────────────────────────

export const CanvasViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().min(0.1).max(5),
});
export type CanvasViewport = z.infer<typeof CanvasViewportSchema>;

// ── Canvas JSON blob structure ───────────────────────────────────────

export const CanvasNodeJsonSchema = z.object({
  id: z.string(),
  type: CanvasNodeTypeEnum,
  label: z.string().default(''),
  content: z.string().default(''),
  refNoteId: z.string().nullable().default(null),
  refAttachmentId: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  color: z.string().default(''),
  shape: CanvasShapeEnum.default('rectangle'),
  groupId: z.string().nullable().default(null),
  zIndex: z.number().int().default(0),
});
export type CanvasNodeJson = z.infer<typeof CanvasNodeJsonSchema>;

export const CanvasEdgeJsonSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  label: z.string().default(''),
  edgeStyle: CanvasEdgeStyleEnum.default('straight'),
  arrowStart: z.boolean().default(false),
  arrowEnd: z.boolean().default(true),
  color: z.string().default(''),
  strokeWidth: z.number().default(2),
});
export type CanvasEdgeJson = z.infer<typeof CanvasEdgeJsonSchema>;

export const CanvasGroupJsonSchema = z.object({
  id: z.string(),
  label: z.string().default(''),
  color: z.string().default(''),
  nodeIds: z.array(z.string()),
});
export type CanvasGroupJson = z.infer<typeof CanvasGroupJsonSchema>;

export const CanvasJsonSchema = z.object({
  nodes: z.array(CanvasNodeJsonSchema),
  edges: z.array(CanvasEdgeJsonSchema),
  groups: z.array(CanvasGroupJsonSchema),
  viewport: CanvasViewportSchema,
});
export type CanvasJson = z.infer<typeof CanvasJsonSchema>;

// ── Input Schemas ────────────────────────────────────────────────────

export const CreateCanvasInputSchema = z.object({
  title: z.string().min(0).max(255).default('Untitled Canvas'),
  description: z.string().default(''),
  folderId: z.string().nullable().default(null),
});
export type CreateCanvasInput = z.input<typeof CreateCanvasInputSchema>;

export const UpdateCanvasInputSchema = z.object({
  title: z.string().min(0).max(255).optional(),
  description: z.string().optional(),
  folderId: z.string().nullable().optional(),
  canvasJson: z.string().optional(),
  isPinned: z.boolean().optional(),
});
export type UpdateCanvasInput = z.input<typeof UpdateCanvasInputSchema>;

export const AddNodeInputSchema = z.object({
  nodeType: CanvasNodeTypeEnum.default('text'),
  label: z.string().default(''),
  content: z.string().default(''),
  refNoteId: z.string().nullable().default(null),
  refAttachmentId: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  x: z.number().default(0),
  y: z.number().default(0),
  w: z.number().min(80).default(200),
  h: z.number().min(40).default(100),
  color: z.string().default(''),
  shape: CanvasShapeEnum.default('rectangle'),
  groupId: z.string().nullable().default(null),
});
export type AddNodeInput = z.input<typeof AddNodeInputSchema>;

export const AddEdgeInputSchema = z.object({
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  label: z.string().default(''),
  edgeStyle: CanvasEdgeStyleEnum.default('straight'),
  arrowStart: z.boolean().default(false),
  arrowEnd: z.boolean().default(true),
  color: z.string().default(''),
  strokeWidth: z.number().default(2),
});
export type AddEdgeInput = z.input<typeof AddEdgeInputSchema>;

// ── Canvas Filter ────────────────────────────────────────────────────

export const CanvasFilterSchema = z.object({
  folderId: z.string().nullable().optional(),
  isPinned: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
export type CanvasFilter = z.input<typeof CanvasFilterSchema>;

// ── Rect for viewport culling ────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
