export type MediaType = 'image' | 'audio';

export interface MediaFile {
  id: string;
  hash: string;
  filename: string;
  mediaType: MediaType;
  mimeType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  localPath: string;
  referenceCount: number;
  createdAt: string;
}

export interface CreateMediaInput {
  hash: string;
  filename: string;
  mediaType: MediaType;
  mimeType: string;
  fileSizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  localPath: string;
}

export const SUPPORTED_IMAGE_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
];

export const SUPPORTED_AUDIO_MIMES = [
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/x-m4a',
];

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_IMAGE_DIMENSION = 2048;

export function validateMediaFile(
  mediaType: MediaType,
  mimeType: string,
  sizeBytes: number,
): string | null {
  if (mediaType === 'image') {
    if (!SUPPORTED_IMAGE_MIMES.includes(mimeType)) {
      return 'Format not supported. Use JPEG, PNG, GIF, or WebP for images.';
    }
    if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      return 'Image exceeds 10MB limit. Choose a smaller image.';
    }
  } else if (mediaType === 'audio') {
    if (!SUPPORTED_AUDIO_MIMES.includes(mimeType)) {
      return 'Format not supported. Use MP3, M4A, WAV, or OGG for audio.';
    }
    if (sizeBytes > MAX_AUDIO_SIZE_BYTES) {
      return 'Audio file too large. Maximum 50MB.';
    }
  }
  return null;
}

export function mediaTagForImage(hash: string, ext: string): string {
  return `<img src="fl_media/${hash}.${ext}">`;
}

export function mediaTagForAudio(hash: string, ext: string): string {
  return `[sound:${hash}.${ext}]`;
}

export function removeMediaTag(content: string, hash: string): string {
  // Remove image tags
  const imgPattern = new RegExp(`<img[^>]*src="fl_media/${hash}[^"]*"[^>]*>`, 'g');
  let result = content.replace(imgPattern, '');
  // Remove sound tags
  const soundPattern = new RegExp(`\\[sound:${hash}[^\\]]*\\]`, 'g');
  result = result.replace(soundPattern, '');
  return result.trim();
}
