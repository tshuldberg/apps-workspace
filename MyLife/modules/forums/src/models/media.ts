import { z } from 'zod';

// ── Media Attachments ───────────────────────────────────────────────

export const MediaTypeSchema = z.enum(['image', 'video', 'gif']);
export type MediaType = z.infer<typeof MediaTypeSchema>;

export const MediaTargetTypeSchema = z.enum(['thread', 'reply', 'dm']);
export type MediaTargetType = z.infer<typeof MediaTargetTypeSchema>;

export const MediaAttachmentSchema = z.object({
  id: z.string().uuid(),
  targetType: MediaTargetTypeSchema,
  targetId: z.string().uuid(),
  uploaderId: z.string().uuid(),
  mediaType: MediaTypeSchema,
  storagePath: z.string(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  altText: z.string().max(300).default(''),
  position: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
});
export type MediaAttachment = z.infer<typeof MediaAttachmentSchema>;

export const UploadMediaInputSchema = z.object({
  targetType: MediaTargetTypeSchema,
  targetId: z.string().uuid(),
  mediaType: MediaTypeSchema,
  storagePath: z.string(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  altText: z.string().max(300).optional(),
  position: z.number().int().nonnegative().optional(),
});
export type UploadMediaInput = z.infer<typeof UploadMediaInputSchema>;

// ── Link Previews ───────────────────────────────────────────────────

export const LinkPreviewSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  siteName: z.string().nullable(),
  fetchedAt: z.string().datetime(),
});
export type LinkPreview = z.infer<typeof LinkPreviewSchema>;

// ── Validation helpers ──────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_THREAD_MEDIA = 10;
export const MAX_REPLY_MEDIA = 1;

export function validateMediaFile(
  mimeType: string,
  fileSize: number,
  mediaType: MediaType,
): { valid: boolean; error?: string } {
  const isImage = mediaType === 'image' || mediaType === 'gif';
  const allowed = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;

  if (!allowed.includes(mimeType)) {
    return { valid: false, error: `Unsupported file type: ${mimeType}` };
  }
  if (fileSize > maxSize) {
    const limitMB = maxSize / (1024 * 1024);
    return { valid: false, error: `File too large. Max ${limitMB}MB for ${mediaType}` };
  }
  return { valid: true };
}

export const URL_REGEX = /https?:\/\/[^\s<>)"']+/g;

export function extractUrls(text: string): string[] {
  return [...text.matchAll(URL_REGEX)].map((m) => m[0]);
}
