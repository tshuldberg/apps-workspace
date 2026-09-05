/**
 * Shared Tags — types.
 *
 * Canonical tag vocabulary with polymorphic binding to any module entity.
 * Backed by hub_tags + hub_tag_bindings (see hub-schema.ts).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Tag
// ---------------------------------------------------------------------------

export const TagSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string().nullable(),
  createdAt: z.string(),
});

export type Tag = z.infer<typeof TagSchema>;

export const CreateTagInputSchema = z.object({
  label: z.string().min(1, 'label is required'),
  color: z.string().optional(),
});

export type CreateTagInput = z.infer<typeof CreateTagInputSchema>;

// ---------------------------------------------------------------------------
// TagBinding
// ---------------------------------------------------------------------------

export const TagBindingSchema = z.object({
  tagId: z.string(),
  moduleId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  boundAt: z.string(),
});

export type TagBinding = z.infer<typeof TagBindingSchema>;

export const BindTagInputSchema = z.object({
  tagId: z.string().min(1),
  moduleId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
});

export type BindTagInput = z.infer<typeof BindTagInputSchema>;
