import { NextRequest, NextResponse } from 'next/server';
import { getHubEntitlement } from '@mylife/db';
import { getAdapter } from '@/lib/db';
import { resolveActorIdentity } from '@/app/api/_shared/actor-identity';
import { requireEnvVar } from '@/lib/env-guard';

export const runtime = 'nodejs';

/**
 * Authenticated proxy for entitlement sync.
 *
 * Mobile clients send their actor identity token instead of the raw sync key.
 * This endpoint verifies the actor, then reads the entitlement from the local
 * database (same logic as /api/entitlements/sync) without exposing the sync
 * key to the client.
 */
export async function GET(request: NextRequest) {
  const identity = resolveActorIdentity({
    token: request.headers.get('x-actor-identity-token') ?? undefined,
    required: true,
  });

  if (!identity.ok || !identity.userId) {
    return NextResponse.json(
      { error: identity.error ?? 'Actor identity is required.' },
      { status: identity.status ?? 401 },
    );
  }

  // Validate that the sync key is configured server-side (fail-fast if missing).
  try {
    requireEnvVar('MYLIFE_ENTITLEMENT_SYNC_KEY');
  } catch {
    return NextResponse.json(
      { error: 'Entitlement sync key not configured.' },
      { status: 500 },
    );
  }

  const db = getAdapter();
  const cached = getHubEntitlement(db);

  if (!cached) {
    return NextResponse.json({ error: 'No entitlement found.' }, { status: 404 });
  }

  const entitlements = {
    appId: cached.app_id,
    mode: cached.mode,
    hostedActive: cached.hosted_active,
    selfHostLicense: cached.self_host_license,
    updatePackYear: cached.update_pack_year ?? undefined,
    features: cached.features,
    issuedAt: cached.issued_at,
    expiresAt: cached.expires_at ?? undefined,
    signature: cached.signature,
  };

  return NextResponse.json({
    token: cached.raw_token,
    entitlements,
    syncedAt: new Date().toISOString(),
  });
}
