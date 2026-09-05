import type { DatabaseAdapter } from '@mylife/db';
import type { VideoImportResult } from '../types';
import { detectPlatform, fetchSocialMetadata, extractRecipeFromText } from './index';

export async function importRecipeFromVideo(
  url: string,
  apiKey: string,
  db?: DatabaseAdapter,
): Promise<VideoImportResult> {
  const platform = detectPlatform(url);
  if (!platform) {
    return { parsed: null, sourceUrl: url, error: 'Unsupported URL. Try a YouTube, TikTok, or Instagram link.' };
  }

  let metadata;
  try {
    metadata = await fetchSocialMetadata(url);
  } catch {
    return { parsed: null, sourceUrl: url, platform, error: 'Could not access this video. Make sure it is public.' };
  }

  if (!metadata || (!metadata.captionText && !metadata.title)) {
    return { parsed: null, sourceUrl: url, platform, error: 'Could not access this video. Make sure it is public.' };
  }

  // Check for duplicate
  if (db) {
    const existing = db.query<{ id: string }>(
      `SELECT id FROM rc_recipes WHERE source_url = ? LIMIT 1`,
      [url],
    );
    if (existing.length > 0) {
      return {
        parsed: null,
        sourceUrl: url,
        platform,
        thumbnailUrl: metadata.thumbnailUrl ?? undefined,
        author: metadata.author ?? undefined,
        error: 'A recipe from this URL already exists.',
      };
    }
  }

  const captionText = [metadata.title, metadata.captionText].filter(Boolean).join('\n\n');

  if (captionText.trim().length < 20) {
    return {
      parsed: null,
      sourceUrl: url,
      platform,
      thumbnailUrl: metadata.thumbnailUrl ?? undefined,
      author: metadata.author ?? undefined,
      error: 'Not enough content to extract a recipe. Try manual entry.',
    };
  }

  try {
    const parsed = await extractRecipeFromText(captionText, apiKey, {
      sourceUrl: url,
      author: metadata.author ?? undefined,
    });

    return {
      parsed,
      sourceUrl: url,
      thumbnailUrl: metadata.thumbnailUrl ?? undefined,
      author: metadata.author ?? undefined,
      platform,
    };
  } catch {
    return {
      parsed: null,
      sourceUrl: url,
      platform,
      thumbnailUrl: metadata.thumbnailUrl ?? undefined,
      author: metadata.author ?? undefined,
      error: 'Could not find a recipe in this video description.',
    };
  }
}
