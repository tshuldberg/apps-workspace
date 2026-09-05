/**
 * Social media recipe extraction.
 * Detects Instagram, TikTok, and YouTube URLs, fetches metadata via oEmbed APIs,
 * and extracts caption/description text for AI-assisted recipe parsing.
 */

import { fetchHtml, ImportError } from './fetch';

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube';

export interface SocialMediaResult {
  platform: SocialPlatform;
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  captionText: string | null;
  originalUrl: string;
}

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

const INSTAGRAM_RE = /instagram\.com\/(reel|p|tv)\//i;
const TIKTOK_RE = /tiktok\.com\/(@[\w.]+\/video\/|v\/|\?.*item_id=)/i;
const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)/i;

const OEMBED_URLS: Record<SocialPlatform, string> = {
  instagram: 'https://api.instagram.com/oembed',
  tiktok: 'https://www.tiktok.com/oembed',
  youtube: 'https://www.youtube.com/oembed',
};

/** Detect which social platform a URL belongs to, or null for regular websites. */
export function detectPlatform(url: string): SocialPlatform | null {
  if (INSTAGRAM_RE.test(url)) return 'instagram';
  if (TIKTOK_RE.test(url)) return 'tiktok';
  if (YOUTUBE_RE.test(url)) return 'youtube';
  return null;
}

/**
 * Fetch social media metadata (title, author, thumbnail) and caption text.
 * Uses oEmbed APIs for metadata, then fetches the page HTML to extract
 * caption/description from meta tags.
 */
export async function fetchSocialMetadata(url: string): Promise<SocialMediaResult> {
  const platform = detectPlatform(url);
  if (!platform) {
    throw new ImportError('Not a recognized social media URL', 'unsupported', url);
  }

  const result: SocialMediaResult = {
    platform,
    title: null,
    author: null,
    thumbnailUrl: null,
    captionText: null,
    originalUrl: url,
  };

  // Try oEmbed API for metadata (non-blocking -- we continue even if it fails)
  const oembedData = await fetchOEmbed(platform, url);
  if (oembedData) {
    result.title = oembedData.title ?? null;
    result.author = oembedData.author_name ?? null;
    result.thumbnailUrl = oembedData.thumbnail_url ?? null;
  }

  // Fetch page HTML to extract caption/description from meta tags
  try {
    const { html } = await fetchHtml(url, 10_000);
    result.captionText = extractCaptionFromHtml(html);

    // If title wasn't from oEmbed, try og:title
    if (!result.title) {
      result.title = extractMetaContent(html, 'og:title');
    }
    // If thumbnail wasn't from oEmbed, try og:image
    if (!result.thumbnailUrl) {
      result.thumbnailUrl = extractMetaContent(html, 'og:image');
    }
  } catch {
    // HTML fetch is best-effort; caption may remain null
  }

  return result;
}

/** Call the platform's oEmbed API to get metadata. */
async function fetchOEmbed(platform: SocialPlatform, url: string): Promise<OEmbedResponse | null> {
  const baseUrl = OEMBED_URLS[platform];
  const oembedUrl = `${baseUrl}?url=${encodeURIComponent(url)}&format=json`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const response = await fetch(oembedUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (!response.ok) return null;
    return (await response.json()) as OEmbedResponse;
  } catch {
    return null;
  }
}

/** Extract caption/description text from HTML meta tags. */
function extractCaptionFromHtml(html: string): string | null {
  // Try og:description first (most platforms put caption here)
  const ogDesc = extractMetaContent(html, 'og:description');
  if (ogDesc && ogDesc.length > 20) return ogDesc;

  // Try regular meta description
  const metaDesc = extractMetaName(html, 'description');
  if (metaDesc && metaDesc.length > 20) return metaDesc;

  // Try twitter:description
  const twitterDesc = extractMetaContent(html, 'twitter:description');
  if (twitterDesc && twitterDesc.length > 20) return twitterDesc;

  return ogDesc ?? metaDesc ?? twitterDesc ?? null;
}

/** Extract content from <meta property="..."> tags. */
function extractMetaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const match = html.match(re);
  if (match?.[1]) return decodeHtmlEntities(match[1]);

  // Try reversed attribute order (content before property)
  const reReversed = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegex(property)}["']`,
    'i',
  );
  const matchReversed = html.match(reReversed);
  return matchReversed?.[1] ? decodeHtmlEntities(matchReversed[1]) : null;
}

/** Extract content from <meta name="..."> tags. */
function extractMetaName(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+name=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const match = html.match(re);
  if (match?.[1]) return decodeHtmlEntities(match[1]);

  const reReversed = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegex(name)}["']`,
    'i',
  );
  const matchReversed = html.match(reReversed);
  return matchReversed?.[1] ? decodeHtmlEntities(matchReversed[1]) : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}
