// Node test environment setup for the browser adapter contract tests.
//
// - fake-indexeddb/auto installs `indexedDB` + `IDBKeyRange` on globalThis, so
//   the IndexedDB-backed paths (db bytes store, secret vault, block fallback)
//   run unchanged in Node.
// - Node >= 20 already provides `globalThis.crypto` (WebCrypto), which the secret
//   store (SubtleCrypto) and the PRNG (getRandomValues) rely on.
import 'fake-indexeddb/auto';

// In-process Web Locks model. Real shared-origin exclusion is tested in Playwright.
import { beforeEach } from 'vitest';
let held = new Set<string>();
beforeEach(() => { held = new Set(); });
Object.defineProperty(globalThis.navigator, 'locks', { configurable: true, value: {
  async request(name: string, optionsOrCallback: unknown, callback?: (lock: unknown) => Promise<unknown>) {
    const cb = (callback ?? optionsOrCallback) as (lock: unknown) => Promise<unknown>;
    const locks = held;
    if (locks.has(name)) return cb(null);
    locks.add(name);
    try { return await cb({ name }); } finally { locks.delete(name); }
  },
} });
