/**
 * Demo asset resolution for exercise video/animation demos.
 * Resolves asset:// URIs to bundled local files and https:// to remote URLs.
 */

import type { DemoAsset, DemoStatus } from './types';

/**
 * Resolve a video_url from the exercise record into a typed DemoAsset.
 * Returns null if no demo is available.
 */
export function resolveDemoAsset(
  videoUrl: string | null,
  thumbnailUrl: string | null,
): DemoAsset | null {
  if (!videoUrl || videoUrl.length === 0) {
    return null;
  }

  let type: DemoAsset['type'];
  if (videoUrl.endsWith('.lottie.json') || videoUrl.endsWith('.json')) {
    type = 'lottie';
  } else if (videoUrl.endsWith('.gif')) {
    type = 'gif';
  } else {
    type = 'video';
  }

  return {
    type,
    uri: videoUrl,
    thumbnailUri: thumbnailUrl ?? null,
  };
}

/**
 * Get the demo status for an exercise based on its video_url.
 */
export function getDemoStatus(videoUrl: string | null): DemoStatus {
  if (!videoUrl || videoUrl.length === 0) {
    return 'unavailable';
  }
  return 'available';
}

/**
 * Check whether a demo URI is a bundled asset or a remote resource.
 */
export function isBundledAsset(uri: string): boolean {
  return uri.startsWith('asset://');
}

/**
 * Extract the asset filename from a bundled asset:// URI.
 * e.g., "asset://demos/pushup.lottie.json" -> "demos/pushup.lottie.json"
 */
export function extractAssetPath(uri: string): string | null {
  if (!uri.startsWith('asset://')) return null;
  return uri.slice('asset://'.length);
}
