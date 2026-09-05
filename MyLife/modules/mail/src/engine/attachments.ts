import { BLOCKED_EXTENSIONS, MAX_ATTACHMENT_SIZE, MAX_TOTAL_ATTACHMENT_SIZE } from '../types';
import type { MailAttachment } from '../types';

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.ics': 'text/calendar',
};

/** Get MIME type from filename extension. */
export function getMimeType(filename: string): string {
  const ext = getExtension(filename);
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

/** Extract file extension (lowercase, with dot). */
export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.slice(dot).toLowerCase();
}

/** Check if a file extension is blocked. */
export function isBlockedExtension(filename: string): boolean {
  const ext = getExtension(filename);
  return (BLOCKED_EXTENSIONS as readonly string[]).includes(ext);
}

/** Validate a single file's size (max 25 MB). */
export function validateFileSize(sizeBytes: number): { valid: boolean; error?: string } {
  if (sizeBytes <= 0) return { valid: false, error: 'Empty file cannot be attached' };
  if (sizeBytes > MAX_ATTACHMENT_SIZE) {
    return { valid: false, error: 'File too large (max 25 MB)' };
  }
  return { valid: true };
}

/** Validate total size of all attachments (max 50 MB). */
export function validateTotalSize(
  existing: MailAttachment[],
  newSizeBytes: number,
): { valid: boolean; error?: string } {
  const currentTotal = existing.reduce((sum, a) => sum + a.sizeBytes, 0);
  if (currentTotal + newSizeBytes > MAX_TOTAL_ATTACHMENT_SIZE) {
    return { valid: false, error: 'Total attachment size exceeds 50 MB' };
  }
  return { valid: true };
}

/** Format bytes into human-readable string. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Check if a MIME type represents an inline-previewable image. */
export function isPreviewableImage(mimeType: string): boolean {
  return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
}

/** Check if a MIME type represents a PDF. */
export function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}
