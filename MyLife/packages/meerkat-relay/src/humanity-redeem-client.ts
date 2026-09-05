import type { HumanityRedeemFn } from './persona-registry';

const KNOWN_REASONS = new Set([
  'already_spent',
  'invalid',
  'expired',
  'attempt_conflict',
  'request_digest_mismatch',
]);
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 16 * 1024;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface HumanityRedeemClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Explicit opt-in for a trusted private network. Public production URLs must use HTTPS. */
  allowInsecureHttp?: boolean;
}

function redeemEndpoint(baseUrl: string, allowInsecureHttp: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl.trim());
  } catch {
    throw new TypeError('Humanity redeem base URL is invalid');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError('Humanity redeem base URL cannot contain credentials, query, or fragment');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new TypeError('Humanity redeem base URL must use HTTPS');
  }
  if (parsed.protocol === 'http:'
    && !LOOPBACK_HOSTS.has(parsed.hostname)
    && !allowInsecureHttp) {
    throw new TypeError('Humanity redeem HTTP requires an explicit trusted-network opt-in');
  }
  parsed.pathname = `${parsed.pathname.replace(/\/+$/u, '')}/humanity/redeem`;
  return parsed.toString();
}

function timeoutMs(value: number | undefined): number {
  const resolved = value ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(resolved) || resolved < 10 || resolved > MAX_TIMEOUT_MS) {
    throw new RangeError(`Humanity redeem timeout must be between 10 and ${MAX_TIMEOUT_MS} ms`);
  }
  return resolved;
}

async function boundedJson(response: Response): Promise<{
  ok?: unknown;
  reason?: unknown;
  replayed?: unknown;
} | null> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as {
      ok?: unknown;
      reason?: unknown;
      replayed?: unknown;
    };
  } catch {
    return null;
  }
}

/** HTTP client supporting both legacy token-only redeems and replayable registration redeems. */
export function createHumanityRedeemClient(
  baseUrl: string,
  options: HumanityRedeemClientOptions = {},
): HumanityRedeemFn {
  const endpoint = redeemEndpoint(baseUrl, options.allowInsecureHttp === true);
  const requestTimeoutMs = timeoutMs(options.timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;
  return async (token, registration) => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Humanity redeem deadline exceeded'));
        }, requestTimeoutMs);
        timeout.unref?.();
      });
      const request = (async () => {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registration
            ? { token, attemptId: registration.attemptId, requestDigest: registration.requestDigest }
            : { token }),
          signal: controller.signal,
        });
        return { response, body: await boundedJson(response) };
      })();
      const { response, body } = await Promise.race([request, deadline]);
      if (response.ok && body?.ok === true) {
        return { ok: true, ...(typeof body.replayed === 'boolean' ? { replayed: body.replayed } : {}) };
      }
      if (typeof body?.reason === 'string' && KNOWN_REASONS.has(body.reason)) {
        return { ok: false, reason: body.reason };
      }
      return { ok: false, reason: 'service_unreachable' };
    } catch {
      return { ok: false, reason: 'service_unreachable' };
    } finally {
      if (timeout) clearTimeout(timeout);
      controller.abort();
    }
  };
}
