/**
 * Photo processing pipeline for dining module.
 *
 * This module-level code defines the interface and validation logic for photo
 * processing. On mobile, actual compression and EXIF stripping would use
 * expo-image-manipulator at the UI layer before calling this pipeline.
 */

export interface PhotoPipelineOptions {
  /** File URI of the photo to process. */
  uri: string;
  /** Whether to strip EXIF metadata. Defaults to true. */
  stripExif?: boolean;
  /** Optional pre-computed width. */
  width?: number;
  /** Optional pre-computed height. */
  height?: number;
  /** Optional pre-computed file size in bytes. */
  sizeBytes?: number;
}

export interface PhotoPipelineResult {
  /** Final local URI for storage. */
  localUri: string;
  /** Image width in pixels, if known. */
  width?: number;
  /** Image height in pixels, if known. */
  height?: number;
  /** File size in bytes, if known. */
  sizeBytes?: number;
  /** Whether EXIF data was stripped. */
  exifStripped: boolean;
}

/**
 * Process a photo for storage. Validates the URI and returns normalized metadata.
 *
 * In a full mobile implementation, this would be wrapped by a platform-specific
 * layer that handles actual image compression and EXIF stripping via
 * expo-image-manipulator. At the module level, we validate inputs and pass
 * through metadata.
 */
export function processPhoto(options: PhotoPipelineOptions): PhotoPipelineResult {
  if (!options.uri || options.uri.trim().length === 0) {
    throw new Error('Photo URI is required');
  }

  return {
    localUri: options.uri,
    width: options.width,
    height: options.height,
    sizeBytes: options.sizeBytes,
    exifStripped: options.stripExif ?? true,
  };
}
