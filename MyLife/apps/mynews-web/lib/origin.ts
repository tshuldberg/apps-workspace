/**
 * Public origin for absolute URLs in RSS, sitemap, and OpenGraph tags.
 */

// No production domain is chosen yet. This placeholder is used only for
// absolute-URL construction and is pending a domain decision before launch.
export const FALLBACK_ORIGIN = 'https://mynews.app';

export function resolveOrigin(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
  return trimmed || FALLBACK_ORIGIN;
}

export function publicOrigin(): string {
  return resolveOrigin(process.env.MYNEWS_PUBLIC_ORIGIN);
}
