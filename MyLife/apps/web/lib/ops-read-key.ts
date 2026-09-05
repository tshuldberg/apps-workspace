import type { NextRequest } from 'next/server';

function parseOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getConfiguredOpsReadKey(): string | null {
  return parseOptionalString(process.env.MYLIFE_OPS_READ_KEY);
}

export function isOpsReadAuthorized(providedKey: string | null | undefined): boolean {
  const configured = getConfiguredOpsReadKey();
  if (!configured) return true;
  return parseOptionalString(providedKey) === configured;
}

export function getProvidedOpsReadKeyFromRequest(request: NextRequest): string | null {
  const fromHeader = parseOptionalString(request.headers.get('x-ops-read-key'));
  if (fromHeader) return fromHeader;
  return parseOptionalString(request.nextUrl.searchParams.get('key'));
}
