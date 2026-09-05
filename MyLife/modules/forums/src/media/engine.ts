/**
 * Media sharing engine: file validation, URL extraction, media processing helpers.
 */

import {
  validateMediaFile,
  extractUrls,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_THREAD_MEDIA,
  MAX_REPLY_MEDIA,
  type MediaType,
} from '../models/media';

// Re-export the validation function for direct engine access
export { validateMediaFile, extractUrls };

// ── Media Processing Config ─────────────────────────────────────────

export const IMAGE_MAX_DIMENSION = 2048;
export const THUMBNAIL_SIZE = 400;
export const WEBP_QUALITY = 85;
export const VIDEO_MAX_DURATION_SEC = 60;

// ── Resize Calculation ──────────────────────────────────────────────

export function calculateResizeDimensions(
  width: number,
  height: number,
  maxDimension: number = IMAGE_MAX_DIMENSION,
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

export function calculateThumbnailDimensions(
  width: number,
  height: number,
  thumbSize: number = THUMBNAIL_SIZE,
): { width: number; height: number } {
  const ratio = Math.min(thumbSize / width, thumbSize / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

// ── Storage Path Builder ────────────────────────────────────────────

export function buildStoragePath(userId: string, fileId: string, extension: string): string {
  return `forum-media/${userId}/${fileId}.${extension}`;
}

export function buildAvatarPath(userId: string, fileId: string): string {
  return `forum-avatars/${userId}/${fileId}.webp`;
}

export function buildBannerPath(userId: string, fileId: string): string {
  return `forum-banners/${userId}/${fileId}.webp`;
}

// ── File Type Detection ─────────────────────────────────────────────

export function detectMediaType(mimeType: string): MediaType | null {
  if (mimeType === 'image/gif') return 'gif';
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video';
  return null;
}

export function isImageMimeType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType);
}

export function isVideoMimeType(mimeType: string): boolean {
  return ALLOWED_VIDEO_TYPES.includes(mimeType);
}

// ── Validation Aggregates ───────────────────────────────────────────

export function validateAttachmentCount(
  currentCount: number,
  targetType: 'thread' | 'reply',
): { valid: boolean; error?: string } {
  const max = targetType === 'thread' ? MAX_THREAD_MEDIA : MAX_REPLY_MEDIA;
  if (currentCount >= max) {
    return { valid: false, error: `Maximum ${max} attachments per ${targetType}` };
  }
  return { valid: true };
}

export { MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, MAX_THREAD_MEDIA, MAX_REPLY_MEDIA };
