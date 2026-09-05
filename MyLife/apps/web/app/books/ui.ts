export function parseStoredList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function formatShelfLabel(slug: string): string {
  if (slug === 'reading') return 'Currently Reading';
  if (slug === 'want-to-read') return 'Want to Read';
  if (slug === 'dnf') return 'DNF';

  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatBookStatus(status: string | null | undefined): string {
  if (!status) return 'No reading activity yet';
  return status.replace(/_/g, ' ');
}

export function formatMonthLabel(monthKey: string): string {
  const monthPart = monthKey.split('-')[1];
  const monthIndex = Number.parseInt(monthPart ?? '', 10) - 1;
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex] ?? monthKey;
}
