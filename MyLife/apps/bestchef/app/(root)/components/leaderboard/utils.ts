/**
 * Format a numeric vote score to human-readable abbreviated string.
 * < 1,000        → "742"
 * 1,000-99,999   → "1.2k"
 * 100,000-999,999 → "123k"
 * >= 1,000,000   → "1.4M"
 */
export function formatScore(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 100_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return `${value}`;
}
