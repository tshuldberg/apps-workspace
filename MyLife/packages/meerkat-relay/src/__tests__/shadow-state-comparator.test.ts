import { describe, expect, it, vi } from 'vitest';
import {
  shadowedStore,
  stableJson,
  unordered,
  type ShadowEvent,
  type ShadowStoreClassification,
} from '../shadow-state-comparator';

/**
 * A minimal store contract exercising every classification mode. `get`/`list` are reads,
 * `put` is a write, `claimLease` is a skip (inherently divergent), and `unorderedList` is
 * an order-insensitive read.
 */
interface DemoStore {
  get(key: string): Promise<string | null>;
  list(): Promise<string[]>;
  unorderedList(): Promise<string[]>;
  put(key: string, value: string): Promise<void>;
  claimLease(): Promise<string>;
}

const classification: ShadowStoreClassification<DemoStore> = {
  get: { mode: 'read' },
  list: { mode: 'read' },
  unorderedList: { mode: 'read', normalize: unordered },
  put: { mode: 'write' },
  claimLease: { mode: 'skip', reason: 'single-use lease token' },
};

function collectingSink() {
  const events: ShadowEvent[] = [];
  return { events, sink: (event: ShadowEvent) => events.push(event) };
}

/** A tiny in-memory DemoStore, optionally seeded to a fixed state. */
class MemoryDemoStore implements DemoStore {
  readonly records = new Map<string, string>();
  private leaseCounter = 0;
  constructor(seed: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(seed)) this.records.set(k, v);
  }
  async get(key: string): Promise<string | null> {
    return this.records.get(key) ?? null;
  }
  async list(): Promise<string[]> {
    return [...this.records.values()];
  }
  async unorderedList(): Promise<string[]> {
    return [...this.records.values()];
  }
  async put(key: string, value: string): Promise<void> {
    this.records.set(key, value);
  }
  async claimLease(): Promise<string> {
    this.leaseCounter += 1;
    return `lease-${this.leaseCounter}`;
  }
}

// Flush the microtask + macrotask queues so the fire-and-forget shadow work (a Promise.race
// plus several awaits) fully settles before assertions.
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('shadowedStore comparator', () => {
  it('returns the primary result unchanged and emits sampled agreement on matching reads', async () => {
    const { events, sink } = collectingSink();
    const primary = new MemoryDemoStore({ a: '1' });
    const shadow = new MemoryDemoStore({ a: '1' });
    const store = shadowedStore(primary, shadow, {
      store: 'demo',
      classification,
      sink,
      agreementSampleEvery: 1,
    });

    await expect(store.get('a')).resolves.toBe('1');
    await flush();

    expect(events).toEqual([
      { kind: 'agreement', store: 'demo', method: 'get', argsDigest: expect.any(String), sampled: true },
    ]);
  });

  it('emits a divergence event with bounded summaries when results differ', async () => {
    const { events, sink } = collectingSink();
    const primary = new MemoryDemoStore({ a: 'primary-value' });
    const shadow = new MemoryDemoStore({ a: 'shadow-value' });
    const store = shadowedStore(primary, shadow, { store: 'demo', classification, sink });

    await expect(store.get('a')).resolves.toBe('primary-value');
    await flush();

    const divergence = events.find((event) => event.kind === 'divergence');
    expect(divergence).toBeDefined();
    if (divergence?.kind !== 'divergence') throw new Error('expected divergence');
    expect(divergence.store).toBe('demo');
    expect(divergence.method).toBe('get');
    // Summaries are digests, never the raw values.
    expect(JSON.stringify(divergence)).not.toContain('primary-value');
    expect(JSON.stringify(divergence)).not.toContain('shadow-value');
    expect(divergence.primarySummary.digest).not.toBe(divergence.shadowSummary.digest);
  });

  it('isolates a shadow throw as a fault event; the caller is unaffected', async () => {
    const { events, sink } = collectingSink();
    const primary = new MemoryDemoStore({ a: '1' });
    const shadow = new MemoryDemoStore({ a: '1' });
    shadow.get = vi.fn().mockRejectedValue(new Error('shadow db is down'));
    const store = shadowedStore(primary, shadow, { store: 'demo', classification, sink });

    // The primary result is returned normally even though the shadow rejects.
    await expect(store.get('a')).resolves.toBe('1');
    await flush();

    const fault = events.find((event) => event.kind === 'shadow_fault');
    expect(fault).toMatchObject({ kind: 'shadow_fault', store: 'demo', method: 'get', phase: 'read', fault: 'throw' });
    // The shadow error message never appears in an event (bounded fault class only).
    expect(JSON.stringify(events)).not.toContain('shadow db is down');
  });

  it('treats a hung shadow as a timeout fault without stalling the caller', async () => {
    const { events, sink } = collectingSink();
    const primary = new MemoryDemoStore({ a: '1' });
    const shadow = new MemoryDemoStore({ a: '1' });
    // A shadow call that never settles must not block the caller; the injected timer fires.
    shadow.get = vi.fn(() => new Promise<string | null>(() => {}));
    const timers: Array<() => void> = [];
    const store = shadowedStore(primary, shadow, {
      store: 'demo',
      classification,
      sink,
      shadowTimeoutMs: 50,
      setTimeoutFn: (cb) => {
        timers.push(cb);
        return { unref: () => undefined };
      },
      clearTimeoutFn: () => undefined,
    });

    await expect(store.get('a')).resolves.toBe('1');
    // Fire the injected timeout deterministically.
    timers.forEach((cb) => cb());
    await flush();

    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'shadow_fault', method: 'get', fault: 'timeout' }),
    );
  });

  it('mirrors writes to the shadow so both backends advance together', async () => {
    const { sink } = collectingSink();
    const primary = new MemoryDemoStore();
    const shadow = new MemoryDemoStore();
    const store = shadowedStore(primary, shadow, { store: 'demo', classification, sink });

    await store.put('k', 'v');
    await flush();

    expect(primary.records.get('k')).toBe('v');
    expect(shadow.records.get('k')).toBe('v');
  });

  it('reports a shadow write failure as a fault; the primary write still succeeds', async () => {
    const { events, sink } = collectingSink();
    const primary = new MemoryDemoStore();
    const shadow = new MemoryDemoStore();
    shadow.put = vi.fn().mockRejectedValue(new Error('shadow write rejected'));
    const store = shadowedStore(primary, shadow, { store: 'demo', classification, sink });

    await expect(store.put('k', 'v')).resolves.toBeUndefined();
    await flush();

    expect(primary.records.get('k')).toBe('v');
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'shadow_fault', method: 'put', phase: 'write', fault: 'throw' }),
    );
  });

  it('never invokes the shadow for a skip-classified method', async () => {
    const { events, sink } = collectingSink();
    const primary = new MemoryDemoStore();
    const shadow = new MemoryDemoStore();
    const shadowLease = vi.spyOn(shadow, 'claimLease');
    const store = shadowedStore(primary, shadow, { store: 'demo', classification, sink });

    await expect(store.claimLease()).resolves.toBe('lease-1');
    await flush();

    expect(shadowLease).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('applies the unordered normalizer so a reordered read agrees', async () => {
    const { events, sink } = collectingSink();
    // Same members, different order: order-sensitive would diverge, unordered agrees.
    const primary = new MemoryDemoStore();
    primary.unorderedList = async () => ['a', 'b', 'c'];
    const shadow = new MemoryDemoStore();
    shadow.unorderedList = async () => ['c', 'a', 'b'];
    const store = shadowedStore(primary, shadow, {
      store: 'demo',
      classification,
      sink,
      agreementSampleEvery: 1,
    });

    await store.unorderedList();
    await flush();

    expect(events).not.toContainEqual(expect.objectContaining({ kind: 'divergence' }));
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'agreement', method: 'unorderedList' }),
    );
  });

  it('order-sensitive reads diverge on reordering (default, no normalizer)', async () => {
    const { events, sink } = collectingSink();
    const primary = new MemoryDemoStore();
    primary.list = async () => ['a', 'b'];
    const shadow = new MemoryDemoStore();
    shadow.list = async () => ['b', 'a'];
    const store = shadowedStore(primary, shadow, { store: 'demo', classification, sink });

    await store.list();
    await flush();

    expect(events).toContainEqual(expect.objectContaining({ kind: 'divergence', method: 'list' }));
  });

  it('throws for an unclassified method rather than silently skipping it', () => {
    const primary = new MemoryDemoStore();
    const shadow = new MemoryDemoStore();
    const store = shadowedStore(primary, shadow, {
      store: 'demo',
      // Deliberately omit `get` from the classification.
      classification: { put: { mode: 'write' } } as ShadowStoreClassification<DemoStore>,
      sink: () => undefined,
    });

    expect(() => store.get('a')).toThrow(/not classified/);
  });

  it('rate-limits agreement events by the sample interval', async () => {
    const { events, sink } = collectingSink();
    const primary = new MemoryDemoStore({ a: '1' });
    const shadow = new MemoryDemoStore({ a: '1' });
    const store = shadowedStore(primary, shadow, {
      store: 'demo',
      classification,
      sink,
      agreementSampleEvery: 3,
    });

    for (let i = 0; i < 6; i += 1) {
      await store.get('a');
      await flush();
    }

    const agreements = events.filter((event) => event.kind === 'agreement');
    // 6 agreeing reads at "every 3rd" -> the 1st and 4th are sampled.
    expect(agreements).toHaveLength(2);
  });
});

describe('stableJson normalization', () => {
  it('is key-order and undefined-vs-absent insensitive', () => {
    expect(stableJson({ a: 1, b: 2 })).toBe(stableJson({ b: 2, a: 1 }));
    expect(stableJson({ a: 1 })).toBe(stableJson({ a: 1, b: undefined }));
  });

  it('normalizes Date and ISO string, and Uint8Array and Buffer, to a common form', () => {
    const iso = '2026-07-10T00:00:00.000Z';
    expect(stableJson(new Date(iso))).toBe(stableJson({ __date: iso }));
    expect(stableJson(new Uint8Array([1, 2, 3]))).toBe(stableJson(Buffer.from([1, 2, 3])));
  });
});
