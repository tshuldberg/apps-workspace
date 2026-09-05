/**
 * @mylife/errors
 *
 * Centralized error classification + retry utilities shared across
 * auth, subscription, migration, cloud adapters (forums/market/surf/workouts),
 * and any other module that talks to remote services or fails in
 * distinguishable ways.
 *
 * Goals:
 *   - Discriminate retryable vs fatal failures so UI layers can surface
 *     "retry" vs "sign in again" vs "contact support" without string-matching.
 *   - Provide a single `retryWithBackoff()` helper so every caller uses
 *     the same exponential schedule.
 *   - Keep the surface tiny: one enum, one error class, one retry helper.
 */

// ────────────────────────────────────────────────────────────────────────────
// Error categories
// ────────────────────────────────────────────────────────────────────────────

/**
 * Categorizes a failure so the UI / orchestrator can pick a recovery action.
 *
 * - `network`: transient connectivity issue. Safe to retry with backoff.
 * - `timeout`: request exceeded deadline. Safe to retry, maybe with a
 *   larger timeout.
 * - `auth`: credentials missing, expired, or rejected. Caller must
 *   re-authenticate before retrying.
 * - `permission`: caller is authenticated but not authorized for this
 *   resource (RLS violation, 403, entitlement missing). Retry will not help.
 * - `not_found`: resource does not exist. Retry will not help.
 * - `conflict`: write conflict (409, unique violation). Caller should
 *   refresh state and retry with a merge/rebase strategy.
 * - `rate_limited`: server asked caller to slow down. Retry after the
 *   server-provided delay (Retry-After header) or a backoff.
 * - `server`: server-side 5xx or unexpected internal state. Retryable
 *   with backoff; surface to the user after N attempts.
 * - `validation`: input failed schema/business-rule validation.
 *   Non-retryable until caller fixes input.
 * - `billing`: subscription lapsed, payment failed, or entitlement
 *   revoked. Caller must resolve billing before retrying.
 * - `unknown`: catch-all. Treat as potentially retryable but log for
 *   investigation.
 */
export type ErrorCategory =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'server'
  | 'validation'
  | 'billing'
  | 'unknown';

/**
 * Categories that are safe to retry automatically with backoff.
 * Everything else requires caller intervention (re-auth, input fix, etc).
 */
const RETRYABLE_CATEGORIES: ReadonlySet<ErrorCategory> = new Set<ErrorCategory>([
  'network',
  'timeout',
  'rate_limited',
  'server',
]);

export function isRetryableCategory(category: ErrorCategory): boolean {
  return RETRYABLE_CATEGORIES.has(category);
}

// ────────────────────────────────────────────────────────────────────────────
// MyLifeError
// ────────────────────────────────────────────────────────────────────────────

export interface MyLifeErrorOptions {
  category: ErrorCategory;
  message: string;
  /** Original error preserved for debugging / stack traces. */
  cause?: unknown;
  /** Optional machine-readable code for precise UI routing. */
  code?: string;
  /** Arbitrary context (request id, moduleId, tier, etc). */
  context?: Record<string, unknown>;
}

export class MyLifeError extends Error {
  readonly category: ErrorCategory;
  readonly code?: string;
  readonly context?: Record<string, unknown>;

  constructor(options: MyLifeErrorOptions) {
    super(options.message);
    this.name = 'MyLifeError';
    this.category = options.category;
    this.code = options.code;
    this.context = options.context;
    if (options.cause !== undefined) {
      // `Error.cause` exists at runtime on ES2022+ but older lib targets don't
      // list it on the Error interface, so assign it dynamically.
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  get isRetryable(): boolean {
    return isRetryableCategory(this.category);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Category inference from unknown errors
// ────────────────────────────────────────────────────────────────────────────

/**
 * Best-effort classifier for raw thrown values. Prefer constructing a
 * `MyLifeError` at the source; use this when bridging third-party errors
 * (fetch, Supabase, SQLite, RevenueCat) that you don't control.
 */
export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof MyLifeError) return error.category;

  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();

    if (name === 'aborterror' || message.includes('aborted')) return 'timeout';
    if (name === 'timeouterror' || message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('fetch failed') || message.includes('econnrefused')) {
      return 'network';
    }
    if (message.includes('unauthorized') || message.includes('401')) return 'auth';
    if (message.includes('forbidden') || message.includes('403')) return 'permission';
    if (message.includes('not found') || message.includes('404')) return 'not_found';
    if (message.includes('conflict') || message.includes('409')) return 'conflict';
    if (message.includes('rate limit') || message.includes('429')) return 'rate_limited';
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return 'server';
    }
  }

  return 'unknown';
}

export function toMyLifeError(error: unknown, fallbackMessage = 'Something went wrong'): MyLifeError {
  if (error instanceof MyLifeError) return error;
  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  return new MyLifeError({
    category: classifyError(error),
    message,
    cause: error,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Retry with backoff
// ────────────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum attempts including the initial call. Default 3. */
  maxAttempts?: number;
  /** Initial delay in ms between retries. Default 250ms. */
  initialDelayMs?: number;
  /** Multiplier applied to delay after each attempt. Default 2.0 (exponential). */
  backoffMultiplier?: number;
  /** Upper bound for any single delay. Default 5000ms. */
  maxDelayMs?: number;
  /**
   * Optional predicate to override the default retry decision. Receives the
   * inferred MyLifeError; return `true` to retry, `false` to abort.
   */
  shouldRetry?: (error: MyLifeError, attempt: number) => boolean;
  /** Called before each retry. Use for telemetry or UI breadcrumbs. */
  onRetry?: (error: MyLifeError, attempt: number, delayMs: number) => void;
  /** Abort the retry loop entirely (e.g. component unmounted). */
  signal?: AbortSignal;
}

const DEFAULTS: Required<
  Omit<RetryOptions, 'shouldRetry' | 'onRetry' | 'signal'>
> = {
  maxAttempts: 3,
  initialDelayMs: 250,
  backoffMultiplier: 2.0,
  maxDelayMs: 5_000,
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new MyLifeError({ category: 'timeout', message: 'Aborted' }));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new MyLifeError({ category: 'timeout', message: 'Aborted' }));
      },
      { once: true },
    );
  });
}

/**
 * Run `fn`, retrying on retryable categories with exponential backoff.
 * Rethrows the final MyLifeError when all attempts are exhausted or when a
 * non-retryable category is encountered.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULTS.maxAttempts;
  const initialDelayMs = options.initialDelayMs ?? DEFAULTS.initialDelayMs;
  const backoffMultiplier = options.backoffMultiplier ?? DEFAULTS.backoffMultiplier;
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;

  let attempt = 0;
  let delay = initialDelayMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      return await fn();
    } catch (raw) {
      const err = toMyLifeError(raw);
      const canRetry = options.shouldRetry ? options.shouldRetry(err, attempt) : err.isRetryable;
      if (!canRetry || attempt >= maxAttempts) {
        throw err;
      }
      options.onRetry?.(err, attempt, delay);
      await sleep(delay, options.signal);
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }
}
