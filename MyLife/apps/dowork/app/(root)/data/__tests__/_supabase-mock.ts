// Shared test helper: minimal Supabase PostgREST builder mock for the
// DoWork cloud-* helpers.
//
// Returns a thenable chain so `await supabase.from(t).select().eq()...`
// resolves to `{ data, error }`. Supports `.insert`, `.select`, `.update`,
// `.delete`, `.eq`, `.in`, `.order`, `.limit`, `.lt`, `.single`,
// `.maybeSingle`. Responses are keyed by `${table}:${op}` where op is
// one of `insert | select | update | delete`.

import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

export type MockResult = {
  data: unknown;
  error: { message: string; code?: string; status?: number } | null;
};

export interface MockConfig {
  responses: Record<string, MockResult | (() => MockResult)>;
}

export interface MockOptions {
  userId?: string | null;
}

function makeChain(table: string, op: 'insert' | 'select' | 'update' | 'delete', cfg: MockConfig) {
  const respond = async (): Promise<MockResult> => {
    const key = `${table}:${op}`;
    const r = cfg.responses[key];
    if (!r) return { data: null, error: { message: `no mock response for ${key}` } };
    return typeof r === 'function' ? r() : r;
  };
  const handler: Record<string, (...args: unknown[]) => unknown> = {
    select() {
      return chainable();
    },
    single() {
      return respond();
    },
    maybeSingle() {
      return respond();
    },
    eq() {
      return chainable();
    },
    in() {
      return chainable();
    },
    order() {
      return chainable();
    },
    limit() {
      return chainable();
    },
    lt() {
      return chainable();
    },
    then(onFulfilled: (v: MockResult) => unknown, onRejected?: (e: unknown) => unknown) {
      return respond().then(onFulfilled, onRejected);
    },
  };
  function chainable() {
    return new Proxy({}, {
      get(_t, prop) {
        if (typeof prop === 'string' && prop in handler) {
          return handler[prop];
        }
        return undefined;
      },
    });
  }
  return chainable();
}

export function makeSupabase(cfg: MockConfig, opts: MockOptions = {}): SupabaseClient {
  const fromFn = (table: string) => ({
    insert() {
      return makeChain(table, 'insert', cfg);
    },
    select() {
      return makeChain(table, 'select', cfg);
    },
    update() {
      return makeChain(table, 'update', cfg);
    },
    delete() {
      return makeChain(table, 'delete', cfg);
    },
  });
  return {
    from: vi.fn(fromFn),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: opts.userId ? { id: opts.userId } : null },
        error: null,
      })),
      getSession: vi.fn(async () => ({
        data: { session: opts.userId ? { user: { id: opts.userId } } : null },
        error: null,
      })),
    },
  } as unknown as SupabaseClient;
}
