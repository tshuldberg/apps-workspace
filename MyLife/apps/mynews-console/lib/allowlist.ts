/**
 * Moderator email allowlist. Pure so it is unit-testable; consumed by
 * middleware and by requireModerator() in every page and server action
 * (defense in depth).
 *
 * Fail closed: an empty, missing, or malformed allowlist admits nobody.
 */

export function parseModeratorAllowlist(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const email = part.trim().toLowerCase();
    // Minimal shape check: something@something. Silently dropping junk keeps
    // one typo from disabling the whole list while never widening access.
    if (email.length >= 3 && email.includes('@') && !email.startsWith('@') && !email.endsWith('@')) {
      seen.add(email);
    }
  }
  return Array.from(seen);
}

export function isModeratorEmail(
  email: string | null | undefined,
  allowlist: readonly string[],
): boolean {
  if (!email || allowlist.length === 0) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
