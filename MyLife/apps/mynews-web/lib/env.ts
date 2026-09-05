/**
 * Cloud environment parsing for the public site (server-only values).
 *
 * Pure functions here so they are unit-testable without `process.env`; the
 * React-bound port lives in `./cloud`. The `server-only` package is not added
 * (no new dependencies): discipline is that only `lib/cloud.ts` and server
 * components import cloud helpers, never a client component.
 */

export interface CloudEnv {
  /** Supabase project base, https, no trailing slash. */
  baseUrl: string;
  anonKey: string;
}

/**
 * Validate a raw URL + anon key pair. Returns null (unconfigured) when either
 * is missing, blank, or the URL is not https. Trailing slashes are stripped so
 * the base concatenates cleanly with PostgREST paths.
 */
export function parseCloudEnv(
  rawUrl: string | undefined,
  rawKey: string | undefined,
): CloudEnv | null {
  const url = (rawUrl ?? '').trim();
  const anonKey = (rawKey ?? '').trim();
  if (!url || !anonKey) return null;
  if (!/^https:\/\/[^\s]+$/i.test(url)) return null;
  const baseUrl = url.replace(/\/+$/, '');
  if (!baseUrl) return null;
  return { baseUrl, anonKey };
}

export function readCloudEnv(): CloudEnv | null {
  return parseCloudEnv(process.env.MYNEWS_SUPABASE_URL, process.env.MYNEWS_SUPABASE_ANON_KEY);
}

export function isCloudConfigured(): boolean {
  return readCloudEnv() !== null;
}
