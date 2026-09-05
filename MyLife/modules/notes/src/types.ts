import { z } from 'zod';

// ── Core Entities ──────────────────────────────────────────────────────

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  folderId: z.string().nullable(),
  isPinned: z.boolean(),
  isFavorite: z.boolean(),
  wordCount: z.number().int(),
  charCount: z.number().int(),
  isDailyNote: z.boolean(),
  dailyDate: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  clippedAt: z.string().nullable(),
  clipType: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;

export const NoteFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NoteFolder = z.infer<typeof NoteFolderSchema>;

export const NoteTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: z.string(),
});
export type NoteTag = z.infer<typeof NoteTagSchema>;

export const NoteTagLinkSchema = z.object({
  noteId: z.string(),
  tagId: z.string(),
});
export type NoteTagLink = z.infer<typeof NoteTagLinkSchema>;

export const NoteLinkSchema = z.object({
  id: z.string(),
  sourceNoteId: z.string(),
  targetNoteId: z.string(),
  createdAt: z.string(),
});
export type NoteLink = z.infer<typeof NoteLinkSchema>;

export const NoteTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  body: z.string(),
  description: z.string(),
  category: z.string(),
  icon: z.string(),
  useCount: z.number().int(),
  isBuiltIn: z.boolean(),
  createdAt: z.string(),
});
export type NoteTemplate = z.infer<typeof NoteTemplateSchema>;

export const NoteSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export type NoteSetting = z.infer<typeof NoteSettingSchema>;

// ── Input Schemas ──────────────────────────────────────────────────────

export const CreateNoteInputSchema = z.object({
  title: z.string().min(0).max(255).default(''),
  body: z.string().default(''),
  folderId: z.string().nullable().default(null),
  isPinned: z.boolean().default(false),
  isFavorite: z.boolean().default(false),
  tagIds: z.array(z.string()).default([]),
});
export type CreateNoteInput = z.input<typeof CreateNoteInputSchema>;

export const UpdateNoteInputSchema = z.object({
  title: z.string().min(0).max(255).optional(),
  body: z.string().optional(),
  folderId: z.string().nullable().optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  tagIds: z.array(z.string()).optional(),
});
export type UpdateNoteInput = z.input<typeof UpdateNoteInputSchema>;

export const CreateFolderInputSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});
export type CreateFolderInput = z.input<typeof CreateFolderInputSchema>;

export const UpdateFolderInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateFolderInput = z.input<typeof UpdateFolderInputSchema>;

export const CreateTagInputSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().nullable().default(null),
});
export type CreateTagInput = z.input<typeof CreateTagInputSchema>;

export const CreateTemplateInputSchema = z.object({
  name: z.string().min(1).max(100),
  body: z.string().default(''),
});
export type CreateTemplateInput = z.input<typeof CreateTemplateInputSchema>;

export const NoteFilterSchema = z.object({
  folderId: z.string().nullable().optional(),
  tagId: z.string().optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  sortBy: z.enum(['updated', 'created', 'title']).default('updated'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
});
export type NoteFilter = z.input<typeof NoteFilterSchema>;

// ── Search Result ──────────────────────────────────────────────────────

export interface NoteSearchResult {
  id: string;
  title: string;
  snippet: string;
  rank: number;
}

// ── Graph Types ────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  title: string;
  linkCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface NoteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Stats ──────────────────────────────────────────────────────────────

export interface NotesStats {
  totalNotes: number;
  totalFolders: number;
  totalTags: number;
  totalWords: number;
  pinnedCount: number;
  favoriteCount: number;
}

// ── Attachments ───────────────────────────────────────────────────────

export const AttachmentTypeEnum = z.enum(['image', 'pdf', 'file']);
export type AttachmentType = z.infer<typeof AttachmentTypeEnum>;

export const NoteAttachmentSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  fileName: z.string(),
  filePath: z.string(),
  fileSizeBytes: z.number().int(),
  mimeType: z.string(),
  attachmentType: AttachmentTypeEnum,
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  thumbnailPath: z.string().nullable(),
  sortOrder: z.number().int(),
  ocrText: z.string().nullable(),
  ocrStatus: z.string().nullable(),
  ocrLanguage: z.string().nullable(),
  createdAt: z.string(),
});
export type NoteAttachment = z.infer<typeof NoteAttachmentSchema>;

export const CreateAttachmentInputSchema = z.object({
  noteId: z.string(),
  fileName: z.string(),
  filePath: z.string(),
  fileSizeBytes: z.number().int().default(0),
  mimeType: z.string(),
  attachmentType: AttachmentTypeEnum.default('image'),
  width: z.number().int().nullable().default(null),
  height: z.number().int().nullable().default(null),
  thumbnailPath: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});
export type CreateAttachmentInput = z.input<typeof CreateAttachmentInputSchema>;

// ── AI History ────────────────────────────────────────────────────────

export const AiActionEnum = z.enum([
  'summarize', 'expand', 'rewrite', 'fix_grammar', 'simplify',
  'translate', 'tone_change', 'continue', 'brainstorm', 'custom',
]);
export type AiAction = z.infer<typeof AiActionEnum>;

export const AiProviderEnum = z.enum(['local', 'cloud']);
export type AiProvider = z.infer<typeof AiProviderEnum>;

export const AiHistorySchema = z.object({
  id: z.string(),
  noteId: z.string(),
  action: AiActionEnum,
  inputText: z.string(),
  outputText: z.string(),
  provider: AiProviderEnum,
  accepted: z.boolean(),
  createdAt: z.string(),
});
export type AiHistoryEntry = z.infer<typeof AiHistorySchema>;

// ── Relational Databases ──────────────────────────────────────────────

export const DbViewEnum = z.enum(['table', 'board', 'list']);
export type DbView = z.infer<typeof DbViewEnum>;

export const DbColumnTypeEnum = z.enum([
  'text', 'number', 'select', 'multi_select', 'date',
  'checkbox', 'url', 'email', 'phone', 'relation',
]);
export type DbColumnType = z.infer<typeof DbColumnTypeEnum>;

export const NoteDatabaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  folderId: z.string().nullable(),
  defaultView: DbViewEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NoteDatabase = z.infer<typeof NoteDatabaseSchema>;

export const NoteDbColumnSchema = z.object({
  id: z.string(),
  databaseId: z.string(),
  name: z.string(),
  columnType: DbColumnTypeEnum,
  optionsJson: z.string(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  createdAt: z.string(),
});
export type NoteDbColumn = z.infer<typeof NoteDbColumnSchema>;

export const NoteDbRowSchema = z.object({
  id: z.string(),
  databaseId: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NoteDbRow = z.infer<typeof NoteDbRowSchema>;

export const NoteDbCellSchema = z.object({
  id: z.string(),
  rowId: z.string(),
  columnId: z.string(),
  valueText: z.string().nullable(),
  valueNumber: z.number().nullable(),
  valueJson: z.string().nullable(),
});
export type NoteDbCell = z.infer<typeof NoteDbCellSchema>;

// ── Plugins ───────────────────────────────────────────────────────────

export const NotePluginSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  isEnabled: z.boolean(),
  isBuiltIn: z.boolean(),
  manifestJson: z.string(),
  installedAt: z.string(),
  updatedAt: z.string(),
});
export type NotePlugin = z.infer<typeof NotePluginSchema>;

export const NotePluginSettingSchema = z.object({
  pluginId: z.string(),
  key: z.string(),
  value: z.string(),
});
export type NotePluginSetting = z.infer<typeof NotePluginSettingSchema>;
