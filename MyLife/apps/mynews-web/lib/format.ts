/**
 * Small presentation helpers shared by the article, journalist, and home pages.
 * Pure; no runtime imports.
 */

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Split article body markdown into paragraph blocks on blank lines. */
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Short, non-identifying editor key label for revision credits. */
export function shortKey(key: string): string {
  return key.slice(0, 8);
}

/**
 * Render-time guard for citation hrefs. The read mapper already filters to
 * https, but React does not sanitize `href`, so a non-https string that ever
 * reaches this component (e.g. a javascript: URL) must not become a clickable
 * link. Defense in depth against a stored-XSS-on-click; the Expo app applies
 * the same startsWith('https://') check before Linking.openURL.
 */
export function safeCitations(urls: string[]): string[] {
  return urls.filter((url) => url.startsWith('https://'));
}
