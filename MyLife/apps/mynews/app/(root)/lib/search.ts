// C8.9 Discover logic: a debounced search controller with a stale-result
// guard (injectable scheduler so it unit-tests without real timers) and the
// no-follow Latest browse loader. The screen maps every state to honest copy.

import type { FeedItem, MyNewsCloudPort, SearchResult } from '@mylife/mynews';

export const SEARCH_DEBOUNCE_MS = 300;

export type SearchRunState =
  | { status: 'idle' }
  | { status: 'pending'; query: string }
  | { status: 'searching'; query: string }
  | { status: 'results'; query: string; results: SearchResult[] }
  | { status: 'empty'; query: string }
  | { status: 'error'; query: string; message: string };

export interface DebouncedSearch {
  setQuery(query: string): void;
  dispose(): void;
}

/**
 * Debounce keystrokes, then run the search. A monotonically increasing
 * sequence number guards both the pending timer and in-flight promises: any
 * later setQuery invalidates earlier work, so a slow older response can
 * never clobber a newer one.
 */
export function createDebouncedSearch(options: {
  run: (query: string) => Promise<SearchResult[]>;
  onState: (state: SearchRunState) => void;
  debounceMs?: number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}): DebouncedSearch {
  const debounceMs = options.debounceMs ?? SEARCH_DEBOUNCE_MS;
  const schedule =
    options.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const cancel =
    options.cancel ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let seq = 0;
  let disposed = false;
  const emit = (state: SearchRunState) => {
    if (!disposed) options.onState(state);
  };
  return {
    setQuery(raw: string) {
      const query = raw.trim();
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
      seq += 1;
      const mySeq = seq;
      if (query.length === 0) {
        emit({ status: 'idle' });
        return;
      }
      emit({ status: 'pending', query });
      timer = schedule(() => {
        timer = null;
        if (mySeq !== seq) return;
        emit({ status: 'searching', query });
        void options.run(query).then(
          (results) => {
            if (mySeq !== seq) return;
            emit(
              results.length > 0
                ? { status: 'results', query, results }
                : { status: 'empty', query },
            );
          },
          (error: unknown) => {
            if (mySeq !== seq) return;
            emit({
              status: 'error',
              query,
              message: error instanceof Error ? error.message : String(error),
            });
          },
        );
      }, debounceMs);
    },
    dispose() {
      disposed = true;
      seq += 1;
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
    },
  };
}

export type LatestState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; items: FeedItem[] };

/** The no-follow browse list (C8.9): newest published articles across all authors. */
export async function loadLatest(input: {
  configured: boolean;
  port: MyNewsCloudPort | null;
}): Promise<LatestState> {
  if (!input.configured || !input.port) return { status: 'not-configured' };
  try {
    const items = await input.port.getLatest();
    return items.length === 0 ? { status: 'empty' } : { status: 'loaded', items };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
