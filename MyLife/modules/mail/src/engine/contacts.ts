import type { MailContact } from '../types';

/**
 * Generate initials from a display name or email address.
 * "John Doe" -> "JD", "john.doe@example.com" -> "JD", "support" -> "SU"
 */
export function generateInitials(nameOrEmail: string): string {
  // Try display name first (space-separated)
  const name = nameOrEmail.includes('@')
    ? nameOrEmail.split('@')[0].replace(/[._-]/g, ' ')
    : nameOrEmail;

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return nameOrEmail.slice(0, 2).toUpperCase();
}

/**
 * Generate a deterministic avatar background color from an email address.
 * Returns one of 12 distinct colors.
 */
export function getAvatarColor(email: string): string {
  const COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
    '#22C55E', '#A78BFA', '#FB7185', '#14B8A6',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

/**
 * Resolve a sender email to a display name using contacts list.
 * Returns the display name if found, otherwise null.
 */
export function resolveContact(
  email: string,
  contacts: MailContact[],
): MailContact | null {
  const lower = email.toLowerCase();
  return contacts.find((c) => c.email.toLowerCase() === lower) ?? null;
}

/**
 * Auto-complete search across contacts.
 * Matches partial email or display name, sorted by frequency (most contacted first).
 */
export function autoComplete(
  query: string,
  contacts: MailContact[],
  limit: number = 10,
): MailContact[] {
  if (query.length < 2) return [];
  const lower = query.toLowerCase();

  return contacts
    .filter(
      (c) =>
        c.email.toLowerCase().includes(lower) ||
        (c.displayName?.toLowerCase().includes(lower) ?? false),
    )
    .sort((a, b) => {
      // VIP first, then by frequency
      if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
      return b.frequency - a.frequency;
    })
    .slice(0, limit);
}

/**
 * Extract display name from email prefix.
 * "john.doe@example.com" -> "john doe"
 */
export function nameFromEmail(email: string): string {
  const prefix = email.split('@')[0] ?? email;
  return prefix.replace(/[._-]/g, ' ').trim();
}

/**
 * Compute Gravatar URL from email (MD5 hash placeholder -- actual impl needs crypto).
 * Returns a URL that can be fetched to check if a Gravatar exists.
 */
export function gravatarUrl(email: string, size: number = 72): string {
  // Simple hash for deterministic URL generation (not actual MD5)
  let hash = 0;
  const lower = email.toLowerCase().trim();
  for (let i = 0; i < lower.length; i++) {
    hash = ((hash << 5) - hash + lower.charCodeAt(i)) | 0;
  }
  const hexHash = Math.abs(hash).toString(16).padStart(32, '0');
  return `https://gravatar.com/avatar/${hexHash}?d=404&s=${size}`;
}
