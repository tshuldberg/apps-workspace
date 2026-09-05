import type { FetchImpl, FetchResponse } from './types';

// Discovery fetches run against third-party endpoints with no SLA. Without a
// deadline a hung socket pins the refresh spinner forever (2026-06-09
// production eval, F9), so every pull-source request goes through here.
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export class SourceTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number,
  ) {
    super(`Request timed out after ${timeoutMs}ms: ${url}`);
    this.name = 'SourceTimeoutError';
  }
}

interface AbortControllerLike {
  abort(): void;
  signal: unknown;
}

function createAbortController(): AbortControllerLike | null {
  const ctor = (globalThis as { AbortController?: new () => AbortControllerLike })
    .AbortController;
  return ctor ? new ctor() : null;
}

export async function fetchWithTimeout(
  fetchImpl: FetchImpl,
  url: string,
  init?: Parameters<FetchImpl>[1],
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<FetchResponse> {
  const controller = createAbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new SourceTimeoutError(url, timeoutMs));
    }, timeoutMs);
  });

  try {
    const request = fetchImpl(
      url,
      controller ? { ...init, signal: controller.signal } : init,
    );
    return await Promise.race([request, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
