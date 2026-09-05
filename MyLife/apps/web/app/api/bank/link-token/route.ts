import { NextRequest, NextResponse } from 'next/server';
import {
  BANK_SYNC_IMPLEMENTED_PROVIDERS,
  BANK_SYNC_PROVIDERS,
  type BankSyncProvider,
} from '@mylife/budget';
import { getBankApiRuntime } from '../_lib/runtime';

/** Enable after security hardening (webhook JWT, auth guards, encrypted tokens, idempotency) */
const BANK_SYNC_ENABLED = false;

export const runtime = 'nodejs';

function parseProvider(value: unknown): {
  provider?: BankSyncProvider;
  error?: string;
} {
  if (value === undefined || value === null) {
    return { provider: 'plaid' };
  }
  if (typeof value !== 'string') {
    return { error: 'Field "provider" must be a string when provided.' };
  }
  const normalized = value.trim().toLowerCase();
  if (!BANK_SYNC_PROVIDERS.includes(normalized as BankSyncProvider)) {
    return { error: `Unsupported provider "${normalized}".` };
  }
  if (!BANK_SYNC_IMPLEMENTED_PROVIDERS.includes(normalized as BankSyncProvider)) {
    return {
      error: `Provider "${normalized}" is not enabled in this build. Enabled providers: ${BANK_SYNC_IMPLEMENTED_PROVIDERS.join(', ')}.`,
    };
  }
  return { provider: normalized as BankSyncProvider };
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((item): item is string => typeof item === 'string');
  return values.length > 0 ? values : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toErrorResponse(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : '';
  const is400 = message.includes('No bank sync provider registered for');
  console.error(fallback, error);
  return NextResponse.json(
    { error: is400 ? message : 'Internal server error.' },
    { status: is400 ? 400 : 500 },
  );
}

export async function POST(request: NextRequest) {
  if (!BANK_SYNC_ENABLED) {
    return NextResponse.json(
      { error: 'Bank sync is disabled. It will be available in a future release.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Request body must be an object.' }, { status: 400 });
  }

  const userId = body.userId;
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return NextResponse.json(
      { error: 'Field "userId" is required and must be a non-empty string.' },
      { status: 400 },
    );
  }
  const providerResult = parseProvider(body.provider);
  if (!providerResult.provider) {
    return NextResponse.json(
      { error: providerResult.error ?? 'Invalid provider.' },
      { status: 400 },
    );
  }

  try {
    const runtimeInstance = await getBankApiRuntime();
    const token = await runtimeInstance.connector.createLinkToken({
      provider: providerResult.provider,
      userId: userId.trim(),
      redirectUri: typeof body.redirectUri === 'string' ? body.redirectUri : undefined,
      countryCodes: readStringArray(body.countryCodes),
    });
    return NextResponse.json(token);
  } catch (error) {
    return toErrorResponse(error, 'Failed to create link token.');
  }
}
