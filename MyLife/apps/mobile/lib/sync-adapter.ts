import type { DatabaseAdapter } from '@mylife/db';
import { getModeConfig } from './entitlements';
import { resolveApiBaseUrl } from './server-endpoint';

export interface SyncRequestOptions<T> {
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  fallback: () => Promise<T> | T;
}

function normalizePath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, '');
  return trimmed.startsWith('api/') ? `/${trimmed}` : `/api/${trimmed}`;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(normalizePath(path), `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function callSyncEndpoint<T>(
  db: DatabaseAdapter,
  options: SyncRequestOptions<T>,
): Promise<T> {
  const modeConfig = getModeConfig(db);
  const resolved = resolveApiBaseUrl(modeConfig.mode, modeConfig.serverUrl);
  if (!resolved.ok || !resolved.url) {
    return options.fallback();
  }

  const response = await fetch(buildUrl(resolved.url, options.path, options.query), {
    method: options.method ?? 'GET',
    headers: options.body === undefined
      ? options.headers
      : {
          'content-type': 'application/json',
          ...(options.headers ?? {}),
        },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      detail
        ? `Sync request failed (${response.status}): ${detail}`
        : `Sync request failed with HTTP ${response.status}.`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return await response.json() as T;
}
