/**
 * Shared Attachments — types.
 *
 * Unified photo/doc/voice store with polymorphic binding to any module entity.
 * Backed by hub_attachments + hub_attachment_links (see hub-schema.ts).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Attachment
// ---------------------------------------------------------------------------

export const AttachmentSchema = z.object({
  id: z.string(),
  uri: z.string(),
  mime: z.string(),
  sha256: z.string().nullable(),
  bytes: z.number().nullable(),
  thumbUri: z.string().nullable(),
  caption: z.string().nullable(),
  takenAt: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

export const CreateAttachmentInputSchema = z.object({
  uri: z.string().min(1, 'uri is required'),
  mime: z.string().min(1, 'mime is required'),
  sha256: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
  thumbUri: z.string().optional(),
  caption: z.string().optional(),
  takenAt: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type CreateAttachmentInput = z.infer<typeof CreateAttachmentInputSchema>;

// ---------------------------------------------------------------------------
// AttachmentLink
// ---------------------------------------------------------------------------

export const AttachmentLinkSchema = z.object({
  attachmentId: z.string(),
  moduleId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  role: z.string().nullable(),
  linkedAt: z.string(),
});

export type AttachmentLink = z.infer<typeof AttachmentLinkSchema>;

export const LinkAttachmentInputSchema = z.object({
  attachmentId: z.string().min(1),
  moduleId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  role: z.string().optional(),
});

export type LinkAttachmentInput = z.infer<typeof LinkAttachmentInputSchema>;
