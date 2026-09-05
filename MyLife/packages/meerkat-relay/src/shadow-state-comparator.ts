/**
 * SHADOW-READ COMPARATOR (Plan 44 Phase 3, WP-3B). The live-parity confidence tool
 * for the file -> PostgreSQL migration window.
 *
 * An operator runs a first-party service in `shadow` backend mode DURING a migration
 * window: the file store is PRIMARY (authoritative, serves traffic, its result always
 * wins) and the PostgreSQL store is SHADOW (the same calls mirrored). Every store call
 * forwards to the primary; concurrently the SAME call runs against the shadow under a
 * bounded timeout, the two results are deep-compared through a per-method normalizer,
 * and a typed divergence / agreement / fault event is emitted through an injected sink.
 *
 * Absolute invariant: the shadow NEVER affects caller-visible behavior. A shadow that
 * throws, times out, or returns a differing value produces an EVENT, never an error to
 * the caller. Writes mirror to the shadow too (both backends must advance together or
 * reads would immediately diverge), but the primary write result is what the caller
 * sees; a shadow write failure is a `shadow_fault` event, never thrown.
 *
 * Bounded by construction: event summaries are digests/counts, NEVER full record dumps,
 * so a divergence log can never leak a body or a secret. Method classification is
 * EXPLICIT per store (read | write | skip) -- never heuristic. `skip` methods are the
 * ones that are inherently divergent between two backends (lease/fencing-token claims,
 * time-window-dependent stats, write-locks): they forward to the primary only and the
 * shadow is never invoked, with the skip reason recorded in the classification so the
 * omission is auditable rather than silent.
 */

import { createHash } from 'node:crypto';

/** How one method on a shadowed store is treated. */
export type ShadowMethodMode = 'read' | 'write' | 'skip';

export interface ShadowMethodClassification {
  mode: ShadowMethodMode;
  /**
   * Required for `skip`: WHY the method is inherently divergent (so the omission is
   * auditable). Optional note for read/write when the normalization needs explaining.
   */
  reason?: string;
  /**
   * Per-method result normalizer. Runs on BOTH the primary and shadow results before
   * the deep compare, so backend-shaped-but-equivalent results (Date vs ISO string,
   * key order, undefined-vs-absent) compare equal. Order-sensitive comparison is the
   * DEFAULT for arrays; a method whose contract does not guarantee order sets a
   * normalizer that sorts. Only used for `read` and `write` modes.
   */
  normalize?: (value: unknown) => unknown;
}

export type ShadowStoreClassification<T> = {
  [K in keyof T]?: ShadowMethodClassification;
};

/** A digest+count summary of a value. NEVER the value itself (bounded, no leak). */
export interface ShadowValueSummary {
  /** Coarse runtime shape: 'null' | 'array' | 'object' | 'string' | 'number' | ... */
  kind: string;
  /** Element count for arrays / key count for objects; absent otherwise. */
  size?: number;
  /** sha256 hex of the normalized JSON, truncated to 16 chars. Absent for null. */
  digest?: string;
}

export type ShadowEvent =
  | {
      kind: 'agreement';
      store: string;
      method: string;
      argsDigest: string;
      /** Present only on the sampled subset (agreement events are rate-limited). */
      sampled: true;
    }
  | {
      kind: 'divergence';
      store: string;
      method: string;
      argsDigest: string;
      primarySummary: ShadowValueSummary;
      shadowSummary: ShadowValueSummary;
    }
  | {
      kind: 'shadow_fault';
      store: string;
      method: string;
      argsDigest: string;
      phase: 'read' | 'write';
      /** Bounded fault class: 'timeout' | 'throw'. Never the raw error message. */
      fault: 'timeout' | 'throw';
    };

export type ShadowEventSink = (event: ShadowEvent) => void;

export interface ShadowedStoreOptions<T extends object> {
  /** Human-readable store id for events (e.g. 'community.publications'). */
  store: string;
  classification: ShadowStoreClassification<T>;
  sink: ShadowEventSink;
  /** Bounded shadow-call timeout in ms. Default 2000. A slower shadow is a fault. */
  shadowTimeoutMs?: number;
  /**
   * Emit at most one `agreement` event per this many agreeing reads per method
   * (the rest are silent). Default 200. Set 0 to disable agreement sampling.
   */
  agreementSampleEvery?: number;
  /** Deterministic clock for the timeout race, for tests. Defaults to real timers. */
  setTimeoutFn?: (cb: () => void, ms: number) => { unref?: () => void };
  clearTimeoutFn?: (handle: unknown) => void;
}

/** A value whose digest and shape can be summarized without dumping it. */
function summarize(value: unknown): ShadowValueSummary {
  if (value === null || value === undefined) return { kind: 'null' };
  if (Array.isArray(value)) {
    return { kind: 'array', size: value.length, digest: digestOf(value) };
  }
  const kind = typeof value;
  if (kind === 'object') {
    return {
      kind: 'object',
      size: Object.keys(value as Record<string, unknown>).length,
      digest: digestOf(value),
    };
  }
  return { kind, digest: digestOf(value) };
}

/** sha256(stableJson(value)) truncated to 16 hex chars. Bounded, one-way. */
function digestOf(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex').slice(0, 16);
}

/**
 * Canonicalizing JSON: sorts object keys, encodes Uint8Array/Buffer as a tagged byte
 * array, and normalizes Date to its ISO string, so the digest is stable across the two
 * backends and across key ordering. Absent (`undefined`) values are dropped so that
 * `{a:1}` and `{a:1,b:undefined}` compare equal.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(canonical(value));
}

function canonical(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return { __date: value.toISOString() };
  if (value instanceof Uint8Array) return { __bytes: Array.from(value) };
  if (Buffer.isBuffer(value)) return { __bytes: Array.from(value) };
  if (Array.isArray(value)) return value.map((entry) => canonical(entry));
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
    const out: Record<string, unknown> = {};
    for (const key of sortedKeys) out[key] = canonical(record[key]);
    return out;
  }
  if (typeof value === 'bigint') return { __bigint: value.toString() };
  return value;
}

/**
 * A normalizer that deep-sorts arrays by their canonical JSON, for methods whose result
 * order is NOT contract-guaranteed. Sorts only the top-level array; nested arrays keep
 * their order (their own elements' canonical form still normalizes their contents).
 */
export function unordered(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return [...value].sort((a, b) => (stableJson(a) < stableJson(b) ? -1 : 1));
}

/** Bound the args to a single digest so an event never carries the raw arguments. */
function argsDigest(args: unknown[]): string {
  return digestOf(args);
}

/** Deep structural equality via canonical JSON (order-sensitive unless normalized). */
function canonicalEqual(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b);
}

interface TimeoutRacer {
  setTimeoutFn: (cb: () => void, ms: number) => { unref?: () => void };
  clearTimeoutFn: (handle: unknown) => void;
}

/**
 * Run `work()` but reject with the sentinel `SHADOW_TIMEOUT` if it does not settle within
 * `ms`. The primary is never subject to this; only the shadow call is bounded so a stuck
 * shadow backend can never stall a caller.
 */
const SHADOW_TIMEOUT = Symbol('shadow_timeout');
async function withTimeout<R>(
  work: Promise<R>,
  ms: number,
  racer: TimeoutRacer,
): Promise<R> {
  let handle: unknown;
  const timeout = new Promise<never>((_resolve, reject) => {
    const timer = racer.setTimeoutFn(() => reject(SHADOW_TIMEOUT), ms);
    timer.unref?.();
    handle = timer;
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    racer.clearTimeoutFn(handle);
  }
}

/**
 * Wrap a (primary, shadow) store pair into a Proxy that behaves EXACTLY like the primary
 * for callers while mirroring every classified call to the shadow and emitting comparison
 * events. `read` methods forward to primary, invoke the shadow concurrently, and compare.
 * `write` methods forward to primary (its result wins) and mirror to the shadow, treating
 * a shadow write failure as a fault event. `skip` methods forward to the primary ONLY.
 *
 * Non-function properties and unclassified methods pass through to the primary untouched;
 * an unclassified METHOD call is a hard configuration error (fail loud, never silently
 * skip a store method that the operator forgot to classify).
 */
export function shadowedStore<T extends object>(
  primary: T,
  shadow: T,
  options: ShadowedStoreOptions<T>,
): T {
  const shadowTimeoutMs = options.shadowTimeoutMs ?? 2000;
  const agreementSampleEvery = options.agreementSampleEvery ?? 200;
  const racer: TimeoutRacer = {
    setTimeoutFn:
      options.setTimeoutFn ??
      ((cb, ms) => {
        const t = setTimeout(cb, ms);
        return t as unknown as { unref?: () => void };
      }),
    clearTimeoutFn: options.clearTimeoutFn ?? ((handle) => clearTimeout(handle as never)),
  };
  const agreementCounters = new Map<string, number>();

  const emitComparison = (method: string, args: unknown[], primaryResult: unknown, shadowResult: unknown, normalize?: (v: unknown) => unknown): void => {
    const normalizedPrimary = normalize ? normalize(primaryResult) : primaryResult;
    const normalizedShadow = normalize ? normalize(shadowResult) : shadowResult;
    const digest = argsDigest(args);
    if (canonicalEqual(normalizedPrimary, normalizedShadow)) {
      if (agreementSampleEvery > 0) {
        const seen = (agreementCounters.get(method) ?? 0) + 1;
        agreementCounters.set(method, seen);
        // Sample the 1st agreement and every Nth after it (1, 1+N, 1+2N, ...).
        if ((seen - 1) % agreementSampleEvery === 0) {
          options.sink({ kind: 'agreement', store: options.store, method, argsDigest: digest, sampled: true });
        }
      }
      return;
    }
    options.sink({
      kind: 'divergence',
      store: options.store,
      method,
      argsDigest: digest,
      primarySummary: summarize(normalizedPrimary),
      shadowSummary: summarize(normalizedShadow),
    });
  };

  return new Proxy(primary, {
    get(target, property, receiver) {
      const original = Reflect.get(target, property, receiver);
      if (typeof original !== 'function' || typeof property === 'symbol') {
        return original;
      }
      const method = property;
      const classification = options.classification[method as keyof T];
      const primaryFn = original as (...args: unknown[]) => unknown;
      const shadowRaw = Reflect.get(shadow, property, shadow);
      const shadowFn = typeof shadowRaw === 'function'
        ? (shadowRaw as (...args: unknown[]) => unknown)
        : undefined;

      return (...args: unknown[]): unknown => {
        // A misclassification must fail BEFORE the primary runs: throwing after a
        // side-effectful call would execute the write and then error the caller,
        // inviting a retry of an already-applied effect.
        if (!classification) {
          throw new Error(
            `shadowedStore(${options.store}): method '${String(method)}' is not classified. ` +
              'Every store method must be explicitly read | write | skip (no silent skip).',
          );
        }

        // The primary call is ALWAYS forwarded verbatim; its result is what the caller
        // sees, on every path below. bind() preserves the store's `this`.
        const primaryResult = primaryFn.apply(target, args);

        // skip: forward to primary only, never touch the shadow. Inherently divergent
        // methods (leases/fencing tokens, time-window stats, write-locks) live here.
        if (classification.mode === 'skip' || !shadowFn) {
          return primaryResult;
        }

        const phase: 'read' | 'write' = classification.mode === 'write' ? 'write' : 'read';

        // The shadow mirror runs concurrently and is fully isolated: a throw, a rejected
        // promise, or a timeout becomes a fault EVENT, never propagates to the caller.
        const runShadow = async (): Promise<void> => {
          let shadowSettled: unknown;
          try {
            shadowSettled = await withTimeout(
              Promise.resolve(shadowFn.apply(shadow, args)),
              shadowTimeoutMs,
              racer,
            );
          } catch (error) {
            options.sink({
              kind: 'shadow_fault',
              store: options.store,
              method: String(method),
              argsDigest: argsDigest(args),
              phase,
              fault: error === SHADOW_TIMEOUT ? 'timeout' : 'throw',
            });
            return;
          }
          // WRITE mirroring emits no comparison (a write's return is an ack, not state);
          // a successful shadow write is silent, a failing one already faulted above.
          if (phase === 'read') {
            let primarySettled: unknown;
            try {
              primarySettled = await Promise.resolve(primaryResult);
            } catch {
              // The primary threw; the caller already sees that throw via the returned
              // promise. Nothing to compare, and the shadow is not at fault.
              return;
            }
            emitComparison(String(method), args, primarySettled, shadowSettled, classification.normalize);
          }
        };
        void runShadow();

        return primaryResult;
      };
    },
  });
}
