/** Extract YYYY-MM key from an ISO date string. */
export function getMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Return the YYYY-MM key for N months ago from the current date. */
export function monthsAgoKey(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
