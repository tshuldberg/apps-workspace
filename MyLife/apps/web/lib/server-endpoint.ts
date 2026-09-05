import type { PlanMode } from '@mylife/entitlements';
import { getModeConfig } from './entitlements';

export type ApiBaseUrlReason =
  | 'missing_hosted_url'
  | 'missing_self_host_url'
  | 'invalid_hosted_url'
  | 'invalid_self_host_url'
  | 'local_only_mode';

export interface ResolvedApiBaseUrl {
  ok: boolean;
  url: string | null;
  reason?: ApiBaseUrlReason;
}

export interface ConnectionCheck {
  id: 'url' | 'tls' | 'health' | 'sync';
  ok: boolean;
  message: string;
  httpStatus?: number;
}

export interface SelfHostConnectionResult {
  ok: boolean;
  baseUrl: string | null;
  checks: ConnectionCheck[];
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeServerUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  return trimTrailingSlash(parsed.toString());
}

export function resolveApiBaseUrl(
  mode: PlanMode,
  serverUrl: string | null,
): ResolvedApiBaseUrl {
  if (mode === 'local_only') {
    return { ok: false, url: null, reason: 'local_only_mode' };
  }

  if (mode === 'hosted') {
    const hosted = normalizeServerUrl(process.env.MYLIFE_HOSTED_API_URL ?? null);
    if (!process.env.MYLIFE_HOSTED_API_URL) {
      return { ok: false, url: null, reason: 'missing_hosted_url' };
    }
    if (!hosted) {
      return { ok: false, url: null, reason: 'invalid_hosted_url' };
    }
    return { ok: true, url: hosted };
  }

  const selfHost = normalizeServerUrl(serverUrl);
  if (!serverUrl) {
    return { ok: false, url: null, reason: 'missing_self_host_url' };
  }
  if (!selfHost) {
    return { ok: false, url: null, reason: 'invalid_self_host_url' };
  }

  return { ok: true, url: selfHost };
}

export function resolveCurrentApiBaseUrl(): ResolvedApiBaseUrl {
  const modeConfig = getModeConfig();
  return resolveApiBaseUrl(modeConfig.mode, modeConfig.serverUrl);
}

export async function testSelfHostConnection(
  serverUrl: string,
): Promise<SelfHostConnectionResult> {
  const normalizedUrl = normalizeServerUrl(serverUrl);
  const checks: ConnectionCheck[] = [];

  if (!normalizedUrl) {
    checks.push({
      id: 'url',
      ok: false,
      message: 'Server URL is invalid. Use a full http(s) URL, e.g. https://home.example.com.',
    });

    return {
      ok: false,
      baseUrl: null,
      checks,
    };
  }

  checks.push({
    id: 'url',
    ok: true,
    message: 'Server URL format is valid.',
  });

  const usesHttps = normalizedUrl.startsWith('https://');
  checks.push({
    id: 'tls',
    ok: usesHttps,
    message: usesHttps
      ? 'TLS check passed (HTTPS URL).'
      : 'TLS check failed. Use HTTPS for internet-facing deployments.',
  });

  try {
    const healthResponse = await fetch(`${normalizedUrl}/health`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!healthResponse.ok) {
      checks.push({
        id: 'health',
        ok: false,
        httpStatus: healthResponse.status,
        message: `Health endpoint returned HTTP ${healthResponse.status}.`,
      });
    } else {
      checks.push({
        id: 'health',
        ok: true,
        httpStatus: healthResponse.status,
        message: 'Health endpoint is reachable.',
      });
    }
  } catch {
    checks.push({
      id: 'health',
      ok: false,
      message: 'Health endpoint is unreachable. Check DNS, firewall, and server port mapping.',
    });
  }

  const syncKey = process.env.MYLIFE_ENTITLEMENT_SYNC_KEY;
  try {
    const syncResponse = await fetch(`${normalizedUrl}/api/entitlements/sync`, {
      method: 'GET',
      headers: syncKey
        ? {
            'x-entitlement-sync-key': syncKey,
          }
        : undefined,
      cache: 'no-store',
    });

    if (syncResponse.status === 200) {
      checks.push({
        id: 'sync',
        ok: true,
        httpStatus: syncResponse.status,
        message: 'Entitlement sync endpoint is reachable and returned data.',
      });
    } else if (syncResponse.status === 401 || syncResponse.status === 404) {
      checks.push({
        id: 'sync',
        ok: true,
        httpStatus: syncResponse.status,
        message: syncResponse.status === 401
          ? 'Entitlement sync endpoint is reachable but rejected auth (expected until sync key is configured).'
          : 'Entitlement sync endpoint is reachable but no entitlement is cached yet.',
      });
    } else {
      checks.push({
        id: 'sync',
        ok: false,
        httpStatus: syncResponse.status,
        message: `Entitlement sync endpoint returned HTTP ${syncResponse.status}.`,
      });
    }
  } catch {
    checks.push({
      id: 'sync',
      ok: false,
      message: 'Entitlement sync endpoint is unreachable. Confirm reverse proxy rules and API routes.',
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    baseUrl: normalizedUrl,
    checks,
  };
}
