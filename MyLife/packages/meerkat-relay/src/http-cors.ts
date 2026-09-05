import type http from 'node:http';

export interface HttpCorsOptions {
  allowedOrigins?: readonly string[];
  methods: readonly string[];
  headers: readonly string[];
  maxAgeSeconds?: number;
}

function requestOrigin(req: http.IncomingMessage): string | null {
  const raw = req.headers.origin;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function configuredOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (parsed.pathname !== '/' && parsed.pathname !== '') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Apply a strict reflected-origin CORS policy. Requests without Origin are
 * server-to-server or same-origin and remain allowed. Browser origins must match
 * the configured allowlist exactly; wildcard access is never emitted.
 */
export function applyHttpCors(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: HttpCorsOptions,
): boolean {
  const origin = requestOrigin(req);
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  const allowed = new Set(
    (options.allowedOrigins ?? [])
      .map(normalizeOrigin)
      .filter((value): value is string => value !== null),
  );
  if (!normalized || !allowed.has(normalized)) return false;
  res.setHeader('Access-Control-Allow-Origin', normalized);
  res.setHeader('Access-Control-Allow-Methods', options.methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', options.headers.join(', '));
  res.setHeader('Access-Control-Max-Age', String(options.maxAgeSeconds ?? 600));
  res.setHeader('Vary', 'Origin');
  return true;
}

export function parseCorsAllowedOrigins(value: string | undefined): string[] {
  return [...new Set((value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .map(configuredOrigin)
    .filter((entry): entry is string => entry !== null))];
}
