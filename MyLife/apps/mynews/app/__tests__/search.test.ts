import { describe, expect, it } from 'vitest';
import { InMemoryCloudAdapter, type ArticleView, type SearchResult } from '@mylife/mynews';
import {
  SEARCH_DEBOUNCE_MS,
  createDebouncedSearch,
  loadLatest,
  type SearchRunState,
} from '../(root)/lib/search';

/** Manual scheduler: fires only when the test flushes it. */
function manualScheduler() {
  let next = 0;
  const pending = new Map<number, () => void>();
  return {
    schedule: (fn: () => void, _ms: number) => {
      next += 1;
      pending.set(next, fn);
      return next;
    },
    cancel: (handle: unknown) => {
      pending.delete(handle as number);
    },
    flush() {
      const fns = [...pending.values()];
      pending.clear();
      for (const fn of fns) fn();
    },
    get pendingCount() {
      return pending.size;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const RESULT: SearchResult = { kind: 'article', ref: 'slug-1', title: 'Hit', snippet: 'snip' };

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createDebouncedSearch', () => {
  it('defaults to a 300ms debounce', () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it('only searches after the debounce fires, cancelling superseded keystrokes', async () => {
    const scheduler = manualScheduler();
    const states: SearchRunState[] = [];
    const queries: string[] = [];
    const search = createDebouncedSearch({
      run: async (query) => {
        queries.push(query);
        return [RESULT];
      },
      onState: (state) => states.push(state),
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
    });
    search.setQuery('cl');
    search.setQuery('climate');
    expect(queries).toEqual([]);
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    await settle();
    expect(queries).toEqual(['climate']);
    expect(states.at(-1)).toEqual({
      status: 'results',
      query: 'climate',
      results: [RESULT],
    });
  });

  it('guards against a slow older response clobbering a newer one', async () => {
    const scheduler = manualScheduler();
    const states: SearchRunState[] = [];
    const first = deferred<SearchResult[]>();
    const second = deferred<SearchResult[]>();
    const responses = [first, second];
    const search = createDebouncedSearch({
      run: () => responses.shift()!.promise,
      onState: (state) => states.push(state),
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
    });
    search.setQuery('one');
    scheduler.flush();
    search.setQuery('two');
    scheduler.flush();
    second.resolve([RESULT]);
    await settle();
    first.resolve([]);
    await settle();
    expect(states.at(-1)).toEqual({ status: 'results', query: 'two', results: [RESULT] });
  });

  it('returns to idle on an empty query and reports empty and error states', async () => {
    const scheduler = manualScheduler();
    const states: SearchRunState[] = [];
    let fail = false;
    const search = createDebouncedSearch({
      run: async () => {
        if (fail) throw new Error('search backend down');
        return [];
      },
      onState: (state) => states.push(state),
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
    });
    search.setQuery('nothing');
    scheduler.flush();
    await settle();
    expect(states.at(-1)).toEqual({ status: 'empty', query: 'nothing' });
    fail = true;
    search.setQuery('boom');
    scheduler.flush();
    await settle();
    expect(states.at(-1)).toEqual({
      status: 'error',
      query: 'boom',
      message: 'search backend down',
    });
    search.setQuery('   ');
    expect(states.at(-1)).toEqual({ status: 'idle' });
    expect(scheduler.pendingCount).toBe(0);
  });

  it('stops emitting after dispose', async () => {
    const scheduler = manualScheduler();
    const states: SearchRunState[] = [];
    const search = createDebouncedSearch({
      run: async () => [RESULT],
      onState: (state) => states.push(state),
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
    });
    search.setQuery('query');
    search.dispose();
    scheduler.flush();
    await settle();
    expect(states.at(-1)).toEqual({ status: 'pending', query: 'query' });
  });
});

describe('loadLatest', () => {
  function article(over: Partial<ArticleView>): ArticleView {
    return {
      articleId: 'a1',
      slug: 's1',
      headline: 'Headline',
      kind: 'news',
      rev: 1,
      publishedAt: '2026-07-01T00:00:00.000Z',
      authorHandle: 'jane',
      authorDisplayName: 'Jane Doe',
      authorPubkey: 'pub-jane',
      authorTier: 'open',
      status: 'published',
      bodyMd: 'Body.',
      signature: 'sig',
      signerPubkey: 'pub-jane',
      createdAt: '2026-07-01T00:00:00.000Z',
      revisionSummaries: [],
      ...over,
    };
  }

  it('is honest when unconfigured', async () => {
    expect(await loadLatest({ configured: false, port: null })).toEqual({
      status: 'not-configured',
    });
  });

  it('reports empty when nothing is published yet', async () => {
    const port = new InMemoryCloudAdapter();
    expect(await loadLatest({ configured: true, port })).toEqual({ status: 'empty' });
  });

  it('loads the newest published articles across all authors, newest first', async () => {
    const port = new InMemoryCloudAdapter();
    port.articles = [
      article({ articleId: 'a1', slug: 's1', publishedAt: '2026-07-01T00:00:00.000Z' }),
      article({
        articleId: 'a2',
        slug: 's2',
        authorPubkey: 'pub-other',
        publishedAt: '2026-07-02T00:00:00.000Z',
      }),
      article({ articleId: 'a3', slug: 's3', status: 'draft' }),
    ];
    const state = await loadLatest({ configured: true, port });
    expect(state.status).toBe('loaded');
    if (state.status === 'loaded') {
      expect(state.items.map((i) => i.articleId)).toEqual(['a2', 'a1']);
    }
  });

  it('maps a port failure to an error state', async () => {
    const port = new InMemoryCloudAdapter();
    port.getLatest = async () => {
      throw new Error('offline');
    };
    expect(await loadLatest({ configured: true, port })).toEqual({
      status: 'error',
      message: 'offline',
    });
  });
});
