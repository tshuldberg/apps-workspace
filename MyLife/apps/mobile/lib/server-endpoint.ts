import type { HubPlanMode } from '@mylife/db';

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
  mode: HubPlanMode,
  serverUrl: string | null,
): ResolvedApiBaseUrl {
  if (mode === 'local_only') {
    return { ok: false, url: null, reason: 'local_only_mode' };
  }

  if (mode === 'hosted') {
    const rawHosted = process.env.EXPO_PUBLIC_MYLIFE_HOSTED_API_URL ?? null;
    if (!rawHosted) {
      return { ok: false, url: null, reason: 'missing_hosted_url' };
    }

    const hosted = normalizeServerUrl(rawHosted);
    if (!hosted) {
      return { ok: false, url: null, reason: 'invalid_hosted_url' };
    }

    return { ok: true, url: hosted };
  }

  if (!serverUrl) {
    return { ok: false, url: null, reason: 'missing_self_host_url' };
  }

  const selfHost = normalizeServerUrl(serverUrl);
  if (!selfHost) {
    return { ok: false, url: null, reason: 'invalid_self_host_url' };
  }

  return { ok: true, url: selfHost };
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

  try {
    const syncResponse = await fetch(`${normalizedUrl}/api/entitlements/proxy`, {
      method: 'GET',
    });

    if (syncResponse.status === 200) {
      checks.push({
        id: 'sync',
        ok: true,
        httpStatus: syncResponse.status,
        message: 'Entitlement proxy endpoint is reachable and returned data.',
      });
    } else if (syncResponse.status === 400 || syncResponse.status === 401 || syncResponse.status === 404) {
      checks.push({
        id: 'sync',
        ok: true,
        httpStatus: syncResponse.status,
        message: syncResponse.status === 401 || syncResponse.status === 400
          ? 'Entitlement proxy endpoint is reachable (auth required as expected).'
          : 'Entitlement proxy endpoint is reachable but no entitlement is cached yet.',
      });
    } else {
      checks.push({
        id: 'sync',
        ok: false,
        httpStatus: syncResponse.status,
        message: `Entitlement proxy endpoint returned HTTP ${syncResponse.status}.`,
      });
    }
  } catch {
    checks.push({
      id: 'sync',
      ok: false,
      message: 'Entitlement proxy endpoint is unreachable. Confirm reverse proxy rules and API routes.',
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    baseUrl: normalizedUrl,
    checks,
  };
}
