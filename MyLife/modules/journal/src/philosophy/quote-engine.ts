/**
 * Get the day-of-year (1-366) for a given date string.
 */
export function getDayOfYear(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if a year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get the day_number to query for today's quote.
 * Feb 29 in leap years uses day_number 366.
 */
export function getQuoteDayNumber(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const month = date.getUTCMonth(); // 0-indexed
  const day = date.getUTCDate();

  // Feb 29 always uses 366
  if (month === 1 && day === 29) return 366;

  const dayOfYear = getDayOfYear(dateStr);
  // Clamp to 1-365 for non-leap or regular days
  return ((dayOfYear - 1) % 365) + 1;
}

/**
 * Format a reflection entry body with quote as blockquote.
 */
export function formatReflectionEntry(
  quoteText: string,
  author: string,
  reflectionPrompt: string,
): string {
  return `> ${quoteText}\n> -- ${author}\n\n### ${reflectionPrompt}\n\n`;
}

/**
 * Format a quote for clipboard copy.
 */
export function formatQuoteForClipboard(quoteText: string, author: string): string {
  return `"${quoteText}" -- ${author}`;
}
