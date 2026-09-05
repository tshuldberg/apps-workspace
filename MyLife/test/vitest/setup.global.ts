import { beforeEach, vi } from 'vitest';

function describeTarget(target: unknown): string {
  if (typeof target === 'string') {
    return target;
  }

  if (target instanceof URL) {
    return target.toString();
  }

  if (target && typeof target === 'object') {
    const maybeTarget = target as {
      protocol?: string;
      host?: string;
      hostname?: string;
      path?: string;
      href?: string;
      method?: string;
    };
    if (maybeTarget.href) {
      return maybeTarget.href;
    }

    const host = maybeTarget.host ?? maybeTarget.hostname ?? '';
    const path = maybeTarget.path ?? '';
    const protocol = maybeTarget.protocol ?? '';
    const composed = `${protocol}//${host}${path}`.replace(/^\/\//, '');
    if (composed.trim()) {
      return composed;
    }
  }

  return String(target);
}

function blockedRequest(kind: string, target: unknown): never {
  throw new Error(
    `[test-network-guard] Blocked outbound ${kind} request to ${describeTarget(target)}. ` +
      'Mock external I/O explicitly in this test.',
  );
}

beforeEach(() => {
  process.env.TZ = 'UTC';

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      blockedRequest('fetch', input);
    }) as unknown as typeof fetch,
  );
});
