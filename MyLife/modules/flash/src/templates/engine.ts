import type { CreateFieldInput, CreateTemplateInput } from './types';

const PLACEHOLDER_PATTERN = /\{\{(\w[\w\s-]*?)\}\}/g;

export function renderCardContent(
  format: string,
  fields: Record<string, string>,
): string {
  return format.replace(PLACEHOLDER_PATTERN, (_match, name: string) => {
    const key = name.trim();
    return fields[key] ?? '';
  });
}

export function extractPlaceholders(format: string): string[] {
  const names: string[] = [];
  for (const match of format.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1].trim();
    if (!names.includes(key)) {
      names.push(key);
    }
  }
  return names;
}

export function validateTemplateInput(input: CreateTemplateInput): string | null {
  if (!input.name.trim()) return 'Template name is required.';
  if (!input.fields || input.fields.length < 2) return 'At least 2 fields required.';
  const names = new Set<string>();
  for (const field of input.fields) {
    const normalName = field.name.trim().toLowerCase();
    if (!normalName) return 'All fields must have a name.';
    if (names.has(normalName)) return `Duplicate field name: "${field.name}".`;
    if (normalName.includes('{{') || normalName.includes('}}')) {
      return 'Field names cannot contain {{ or }}.';
    }
    names.add(normalName);
  }
  return null;
}

export function sanitizeFieldName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9\s_-]/g, '');
}

export function buildFieldDefaults(fields: CreateFieldInput[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    result[field.name.trim()] = '';
  }
  return result;
}
