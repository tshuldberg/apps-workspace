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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
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

  const publicToken = body.publicToken;
  if (typeof publicToken !== 'string' || publicToken.trim().length === 0) {
    return NextResponse.json(
      { error: 'Field "publicToken" is required and must be a non-empty string.' },
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
  const provider = providerResult.provider;
  const displayName = typeof body.displayName === 'string' && body.displayName.trim().length > 0
    ? body.displayName.trim()
    : 'Connected account';
  const syncOnConnect = asBool(body.syncOnConnect, false);

  try {
    const runtimeInstance = await getBankApiRuntime();
    const exchange = await runtimeInstance.connector.connectWithPublicToken({
      provider,
      publicToken: publicToken.trim(),
      displayName,
      institutionId:
        typeof body.institutionId === 'string' ? body.institutionId : undefined,
      institutionName:
        typeof body.institutionName === 'string' ? body.institutionName : undefined,
    });

    let syncSummary: Record<string, unknown> | undefined;
    if (syncOnConnect) {
      const syncResult = await runtimeInstance.connector.syncConnection({
        provider,
        connectionExternalId: exchange.connectionExternalId,
      });
      syncSummary = {
        added: syncResult.added.length,
        modified: syncResult.modified.length,
        removed: syncResult.removedProviderTransactionIds.length,
        nextCursor: syncResult.nextCursor,
      };
    }

    return NextResponse.json({
      ...exchange,
      syncSummary,
    });
  } catch (error) {
    return toErrorResponse(error, 'Failed to exchange token.');
  }
}
