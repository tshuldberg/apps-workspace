/**
 * Clipboard recipe URL detection.
 * Checks if clipboard content contains a URL that might link to a recipe.
 */

import { detectPlatform } from './social-media';
import type { SocialPlatform } from './social-media';

export interface ClipboardDetection {
  url: string;
  platform: SocialPlatform | null;
}

/** URL pattern: starts with http(s):// */
const URL_RE = /^https?:\/\/[^\s]+$/i;

/**
 * Check if clipboard text contains a recipe-related URL.
 * Returns the URL and detected platform, or null if not a valid URL.
 */
export function detectClipboardRecipeUrl(clipboardText: string | null): ClipboardDetection | null {
  if (!clipboardText) return null;

  const trimmed = clipboardText.trim();
  if (!URL_RE.test(trimmed)) return null;

  return {
    url: trimmed,
    platform: detectPlatform(trimmed),
  };
}
