export function serializeStringArray(
  value: string[] | null | undefined,
): string {
  return JSON.stringify(value ?? []);
}

export function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

export function normalizeNullableText(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  return value.trim().length === 0 ? null : value;
}
