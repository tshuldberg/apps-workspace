import type { DatabaseAdapter, HubPlanMode } from '@mylife/db';
import {
  getHubEntitlement,
  setHubEntitlement,
  clearHubEntitlement,
  getHubMode,
  setHubMode,
} from '@mylife/db';
import { resolveApiBaseUrl } from './server-endpoint';

/**
 * Server entitlement payload shape (camelCase, validated before DB persist).
 * This is the legacy server-token model used by hub mode/self-host entitlement sync.
 */
interface ServerEntitlement {
  appId: string;
  mode: HubPlanMode;
  hostedActive: boolean;
  selfHostLicense: boolean;
  updatePackYear?: number;
  features: string[];
  issuedAt: string;
  expiresAt?: string;
  signature: string;
}

const VALID_MODES: ReadonlySet<string> = new Set(['hosted', 'self_host', 'local_only']);

function parseServerEntitlement(value: unknown): ServerEntitlement | null {
  if (typeof value !== 'object' || value === null) return null;
  const obj = value as Record<string, unknown>;

  if (typeof obj.appId !== 'string') return null;
  if (typeof obj.mode !== 'string' || !VALID_MODES.has(obj.mode)) return null;
  if (typeof obj.hostedActive !== 'boolean') return null;
  if (typeof obj.selfHostLicense !== 'boolean') return null;
  if (obj.updatePackYear !== undefined && typeof obj.updatePackYear !== 'number') return null;
  if (!Array.isArray(obj.features) || !obj.features.every((f) => typeof f === 'string')) return null;
  if (typeof obj.issuedAt !== 'string') return null;
  if (obj.expiresAt !== undefined && typeof obj.expiresAt !== 'string') return null;
  if (typeof obj.signature !== 'string') return null;

  return {
    appId: obj.appId,
    mode: obj.mode as HubPlanMode,
    hostedActive: obj.hostedActive,
    selfHostLicense: obj.selfHostLicense,
    updatePackYear: obj.updatePackYear as number | undefined,
    features: obj.features as string[],
    issuedAt: obj.issuedAt,
    expiresAt: obj.expiresAt as string | undefined,
    signature: obj.signature,
  };
}

export interface ModeConfig {
  mode: HubPlanMode;
  serverUrl: string | null;
}

export interface SaveEntitlementResult {
  ok: boolean;
  reason?: 'invalid_shape';
}

export interface RefreshEntitlementResult {
  ok: boolean;
  reason?:
    | 'missing_server_url'
    | 'invalid_server_url'
    | 'local_only_mode'
    | 'network_error'
    | 'invalid_response'
    | 'invalid_shape';
}

/** Returns persisted mode config or a safe local-only default. */
export function getModeConfig(db: DatabaseAdapter): ModeConfig {
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
export function saveModeConfig(
  db: DatabaseAdapter,
  mode: HubPlanMode,
  serverUrl?: string | null,
): void {
  setHubMode(db, mode, serverUrl ?? null);
}

/** Returns locally cached entitlement payload if one exists. */
export function getStoredEntitlement(db: DatabaseAdapter): ServerEntitlement | null {
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
 * Corrupt payloads are ignored to protect local state.
 */
export function saveEntitlement(
  db: DatabaseAdapter,
  rawToken: string,
  payload: unknown,
): SaveEntitlementResult {
  const parsed = parseServerEntitlement(payload);
  if (!parsed) {
    return { ok: false, reason: 'invalid_shape' };
  }

  setHubEntitlement(db, {
    raw_token: rawToken,
    app_id: parsed.appId,
    mode: parsed.mode,
    hosted_active: parsed.hostedActive,
    self_host_license: parsed.selfHostLicense,
    update_pack_year: parsed.updatePackYear,
    features: parsed.features,
    issued_at: parsed.issuedAt,
    expires_at: parsed.expiresAt,
    signature: parsed.signature,
  });

  return { ok: true };
}

/** Clears locally cached entitlement payload. */
export function clearStoredEntitlement(db: DatabaseAdapter): void {
  clearHubEntitlement(db);
}

/** Pulls latest entitlement payload from the authenticated proxy endpoint. */
export async function refreshEntitlementFromServer(
  db: DatabaseAdapter,
  actorToken?: string,
): Promise<RefreshEntitlementResult> {
  const modeConfig = getModeConfig(db);
  const resolved = resolveApiBaseUrl(modeConfig.mode, modeConfig.serverUrl);
  if (!resolved.ok || !resolved.url) {
    if (resolved.reason === 'local_only_mode') {
      return { ok: false, reason: 'local_only_mode' };
    }
    if (
      resolved.reason === 'invalid_hosted_url'
      || resolved.reason === 'invalid_self_host_url'
    ) {
      return { ok: false, reason: 'invalid_server_url' };
    }
    return { ok: false, reason: 'missing_server_url' };
  }

  const headers: Record<string, string> = {};
  if (actorToken) {
    headers['x-actor-identity-token'] = actorToken;
  }

  let response: Response;
  try {
    response = await fetch(`${resolved.url}/api/entitlements/proxy`, {
      method: 'GET',
      headers,
    });
  } catch {
    return { ok: false, reason: 'network_error' };
  }

  if (!response.ok) {
    return { ok: false, reason: 'network_error' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'invalid_response' };
  }

  const token = (body as { token?: unknown })?.token;
  const entitlements = (body as { entitlements?: unknown })?.entitlements;
  if (typeof token !== 'string' || entitlements === undefined) {
    return { ok: false, reason: 'invalid_response' };
  }

  const saved = saveEntitlement(db, token, entitlements);
  if (!saved.ok) {
    return { ok: false, reason: 'invalid_shape' };
  }

  return { ok: true };
}
