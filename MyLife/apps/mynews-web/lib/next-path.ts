/**
 * Open-redirect guard for the sign-in return path (plan 48 WP10).
 *
 * A reader who signs in by clicking the emailed magic link lands on
 * `/auth/callback?next=<where they were>`. That value arrives from a URL, so it
 * is attacker-controlled: without this, the sign-in link in a MyNews email would
 * be a redirector to any site on the internet, which is exactly the shape
 * phishing wants.
 *
 * Only same-site absolute paths survive. Pure, so the rejection list is a test
 * rather than a claim.
 */

export const DEFAULT_NEXT_PATH = '/';

/**
 * True when the value carries a C0/C1 control character or DEL. An encoded
 * newline that survived decoding can smuggle a second header, and nothing
 * legitimate in one of this site's paths contains a control character.
 */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

export function safeNextPath(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return DEFAULT_NEXT_PATH;

  // Must be a rooted path. This rejects `https://evil.example`, `//evil.example`
  // (protocol-relative, which a browser treats as another host), and any scheme
  // such as `javascript:` or `data:`.
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_NEXT_PATH;

  // `/\evil.example` is treated as protocol-relative by some browsers, and a
  // backslash has no legitimate place in one of this site's paths.
  if (value.includes('\\')) return DEFAULT_NEXT_PATH;

  if (hasControlChar(value)) return DEFAULT_NEXT_PATH;

  return value;
}
