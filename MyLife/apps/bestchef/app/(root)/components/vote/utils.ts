/**
 * Shared utilities for the vote feed components.
 */

/**
 * Format a count to a short string: 12300 -> "12.3k", 1200000 -> "1.2M".
 */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
