export type CloudWriteFailureClass = 'transient' | 'permanent';

type ErrorRecord = Record<string, unknown>;

const TRANSIENT_MESSAGES = [
  /network/i,
  /fetch failed/i,
  /failed to fetch/i,
  /timeout/i,
  /timed out/i,
  /abort/i,
  /offline/i,
  /socket/i,
  /connection/i,
  /econn/i,
  /enotfound/i,
  /dns/i,
];

const PERMANENT_MESSAGES = [
  /row-level security/i,
  /violates.*policy/i,
  /permission denied/i,
  /forbidden/i,
  /not allowed/i,
  /duplicate key/i,
  /unique constraint/i,
  /foreign key constraint/i,
  /check constraint/i,
  /not-null constraint/i,
  /null value/i,
  /invalid input syntax/i,
  /invalid uuid/i,
  /validation/i,
  /bad request/i,
  /jwt/i,
  /unauthorized/i,
  /not authenticated/i,
];

const PERMANENT_CODES = new Set([
  '22000',
  '22001',
  '22003',
  '22P02',
  '23502',
  '23503',
  '23505',
  '23514',
  '28P01',
  '42501',
  'PGRST301',
  'PGRST302',
  'PGRST303',
  'PGRST116',
]);

function objectValue(error: unknown, key: string): unknown {
  if (!error || typeof error !== 'object') return undefined;
  return (error as ErrorRecord)[key];
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function statusValue(error: unknown): number | null {
  for (const key of ['status', 'statusCode']) {
    const raw = objectValue(error, key);
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function textParts(error: unknown): string[] {
  const parts: string[] = [];
  if (typeof error === 'string') parts.push(error);
  if (error instanceof Error) {
    parts.push(error.name, error.message);
  }
  for (const key of ['message', 'details', 'hint', 'code', 'name']) {
    const value = stringValue(objectValue(error, key));
    if (value) parts.push(value);
  }
  return parts.filter(Boolean);
}

function statusFromText(message: string): number | null {
  const match = message.match(/\b(?:http|status(?: code)?)\s*:?\s*([1-5][0-9]{2})\b/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function classifyCloudWriteFailure(error: unknown): CloudWriteFailureClass {
  const parts = textParts(error);
  const joined = parts.join(' ');

  if (parts.includes('no_session')) return 'transient';
  if (TRANSIENT_MESSAGES.some((pattern) => pattern.test(joined))) return 'transient';

  const explicitStatus = statusValue(error);
  const textStatus = statusFromText(joined);
  const status = explicitStatus ?? textStatus;
  if (typeof status === 'number') {
    if (status === 0 || status === 408 || status >= 500) return 'transient';
    if (status >= 400) return 'permanent';
  }

  if (parts.some((part) => PERMANENT_CODES.has(part))) return 'permanent';
  if (PERMANENT_MESSAGES.some((pattern) => pattern.test(joined))) return 'permanent';

  return 'permanent';
}

export function isTransientCloudWriteFailure(error: unknown): boolean {
  return classifyCloudWriteFailure(error) === 'transient';
}
