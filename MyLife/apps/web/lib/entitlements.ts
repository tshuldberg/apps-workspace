import {
  EntitlementsSchema,
  type Entitlements,
  type PlanMode,
} from '@mylife/entitlements';
import { verifyEntitlementSignature } from '@mylife/entitlements/server';
import {
  getHubEntitlement,
  setHubEntitlement,
  clearHubEntitlement,
  getHubMode,
  setHubMode,
  isHubEntitlementRevoked,
} from '@mylife/db';
import { getAdapter } from './db';

export interface ModeConfig {
  mode: PlanMode;
  serverUrl: string | null;
}

export interface SaveEntitlementResult {
  ok: boolean;
  reason?: 'invalid_shape' | 'missing_secret' | 'invalid_signature' | 'revoked';
}

/** Returns persisted mode config or a safe local-only default. */
export function getModeConfig(): ModeConfig {
  const db = getAdapter();
  const mode = getHubMode(db);

  if (!mode) {
    return { mode: 'local_only', serverUrl: null };
  }

  return {
    mode: mode.mode,
    serverUrl: mode.server_url,
  };
}

/** Persists selected runtime mode and optional server URL. */
export function saveModeConfig(mode: PlanMode, serverUrl?: string | null): void {
  const db = getAdapter();
  setHubMode(db, mode, serverUrl ?? null);
}

/** Returns the currently cached entitlement payload, if any. */
export function getStoredEntitlement(): Entitlements | null {
  const db = getAdapter();
  const cached = getHubEntitlement(db);
  if (!cached) return null;

  return {
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
}

/**
 * Validates and persists entitlement payloads.
 * Invalid payloads are rejected and never written to storage.
 */
export async function saveEntitlement(
  rawToken: string,
  payload: unknown,
): Promise<SaveEntitlementResult> {
  const db = getAdapter();
  const parsed = EntitlementsSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_shape' };
  }

  if (isHubEntitlementRevoked(db, parsed.data.signature)) {
    return { ok: false, reason: 'revoked' };
  }

  const secret = process.env.MYLIFE_ENTITLEMENT_SECRET;
  if (!secret) {
    return { ok: false, reason: 'missing_secret' };
  }

  const verified = await verifyEntitlementSignature(parsed.data, secret, {
    isRevoked: (signature) => isHubEntitlementRevoked(db, signature),
  });
  if (!verified) {
    return { ok: false, reason: 'invalid_signature' };
  }

  setHubEntitlement(db, {
    raw_token: rawToken,
    app_id: parsed.data.appId,
    mode: parsed.data.mode,
    hosted_active: parsed.data.hostedActive,
    self_host_license: parsed.data.selfHostLicense,
    update_pack_year: parsed.data.updatePackYear,
    features: parsed.data.features,
    issued_at: parsed.data.issuedAt,
    expires_at: parsed.data.expiresAt,
    signature: parsed.data.signature,
  });

  return { ok: true };
}

/** Clears locally cached entitlement payload. */
export function clearStoredEntitlement(): void {
  const db = getAdapter();
  clearHubEntitlement(db);
}
