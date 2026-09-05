/**
 * BestChef content-classifier and child-safety provider seam (audit C3, C5).
 *
 * This module is the INTEGRATION SEAM ONLY. It defines the typed provider
 * interfaces, a capability descriptor, and an env-driven registry. It does NOT
 * contain detection logic, classification heuristics, hash lists, hash-matching
 * algorithms, or vendor request/response bodies. Real vendor adapters land only
 * after the founder completes item F3 (contract NSFW+food classifier vendor,
 * contract hash-match child-safety vendor, register with NCMEC, set env vars).
 *
 * FAIL-CLOSED CONTRACT (the whole point of this file):
 *   - An unset or unknown provider name resolves to NO provider (null). Callers
 *     that get null MUST route content to human review; they must NOT approve.
 *   - The only providers that ever return a "safe"/"food" verdict are the test
 *     stubs, and they are gated behind BESTCHEF_MODERATION_TEST_STUBS=1 AND a
 *     non-production environment marker. A production deploy that sets the stub
 *     flag is a configuration error: resolution throws (loud, structured) so the
 *     worker refuses to run rather than silently auto-approving.
 *   - There is deliberately no "fail open" branch anywhere in this seam.
 */

export type ProviderEnv = (key: string) => string | undefined;

/**
 * Verdict enum shared by classifier providers. `provider_unavailable` is a
 * first-class outcome so an outage is never confused with a "safe" result:
 * callers treat it exactly like no-provider (route to human review).
 */
export type ClassifierVerdict = 'flagged' | 'clear' | 'provider_unavailable';

/** Verdict enum for the child-safety hash-match seam. */
export type ChildSafetyVerdict = 'hit' | 'no_match' | 'provider_unavailable';

/**
 * Reference to the asset being screened. The seam is transport-agnostic on
 * purpose: a vendor adapter decides whether it needs the signed URL, the raw
 * bytes, or a content hash. No detection logic lives here.
 */
export interface AssetRef {
  assetId: string;
  mediaKind: string;
  ownerKind?: string;
  ownerId?: string;
  ownerProfileId?: string | null;
  storageBucket?: string | null;
  storageKey?: string | null;
  /** A short-lived signed URL, when the caller has one. */
  signedUrl?: string | null;
  /** Content hash when the caller already computed one. */
  contentHash?: string | null;
}

/**
 * Capability descriptor: a provider advertises what it can screen so the worker
 * can log a precise, honest record of what ran (or that nothing ran).
 */
export interface ProviderCapability {
  /** Registry name resolved from env (e.g. 'noop', a future vendor id). */
  name: string;
  kind: 'nsfw_image' | 'food_image' | 'child_safety_hash';
  /** Human-readable so ops logs are unambiguous. */
  description: string;
  /** Media kinds the provider claims to handle (e.g. ['image', 'video']). */
  supportedMediaKinds: readonly string[];
  /**
   * False for the test stubs and the null provider. A real vendor adapter sets
   * this true. Used only for structured logging and ops health, never to gate
   * an approval.
   */
  productionReady: boolean;
}

export interface ClassifierScreenResult {
  verdict: ClassifierVerdict;
  /** Optional confidence in [0,1] when the vendor supplies one. */
  score?: number;
  /** Vendor label passthrough for the audit record. */
  label?: string;
  /** Present when verdict is provider_unavailable. */
  reason?: string;
}

export interface ChildSafetyScreenResult {
  verdict: ChildSafetyVerdict;
  /** Opaque vendor reference for the matched hash list entry, on a hit. */
  matchRef?: string;
  reason?: string;
}

export interface NsfwImageClassifierProvider {
  readonly capability: ProviderCapability;
  screen(asset: AssetRef): Promise<ClassifierScreenResult>;
}

export interface FoodImageClassifierProvider {
  readonly capability: ProviderCapability;
  screen(asset: AssetRef): Promise<ClassifierScreenResult>;
}

export interface ChildSafetyHashMatchProvider {
  readonly capability: ProviderCapability;
  screen(asset: AssetRef): Promise<ChildSafetyScreenResult>;
}

/**
 * The full resolved provider set for a worker run. Any field may be null, which
 * means "no provider configured for this dimension" and forces the caller down
 * its fail-closed human-review path.
 */
export interface ResolvedModerationProviders {
  nsfw: NsfwImageClassifierProvider | null;
  food: FoodImageClassifierProvider | null;
  childSafety: ChildSafetyHashMatchProvider | null;
  /** True only when the env-gated, non-production test stubs are active. */
  usingTestStubs: boolean;
}

export class ModerationConfigError extends Error {
  constructor(
    message: string,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ModerationConfigError';
  }
}

function trimmed(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * A production deploy is one where the environment marker says so. We treat the
 * environment as production unless it is explicitly a non-production marker, so
 * an unset/ambiguous env is fail-closed (stubs refuse). Checked against a small
 * allow-list of non-production markers.
 */
const NON_PRODUCTION_MARKERS = new Set([
  'development',
  'dev',
  'local',
  'test',
  'testing',
  'staging',
  'preview',
  'ci',
]);

export function environmentMarker(env: ProviderEnv): string | null {
  return (
    trimmed(env('BESTCHEF_ENV')) ??
    trimmed(env('BESTCHEF_ENVIRONMENT')) ??
    trimmed(env('SUPABASE_ENV')) ??
    trimmed(env('DENO_ENV')) ??
    trimmed(env('NODE_ENV'))
  );
}

export function isNonProductionEnvironment(env: ProviderEnv): boolean {
  const marker = environmentMarker(env);
  if (!marker) return false;
  return NON_PRODUCTION_MARKERS.has(marker.toLowerCase());
}

function stubsRequested(env: ProviderEnv): boolean {
  return trimmed(env('BESTCHEF_MODERATION_TEST_STUBS')) === '1';
}

// ── Registry ────────────────────────────────────────────────────────────
//
// Vendor adapters are NOT built here (founder item F3). Real names get wired
// into these maps once the adapters exist behind this same interface. Today the
// only recognized names are 'noop' (an explicit, honest no-provider) so that ops
// can distinguish "intentionally unwired" from "misconfigured typo".

const KNOWN_NSFW_PROVIDERS = new Set(['noop']);
const KNOWN_FOOD_PROVIDERS = new Set(['noop']);
const KNOWN_CHILD_SAFETY_PROVIDERS = new Set(['noop']);

/**
 * Resolve one provider name from env. Returns:
 *   - { name: null } when unset or 'noop' (no provider; caller fails closed).
 *   - { name } when a known non-noop vendor id is present (adapter dispatch).
 *   - throws ModerationConfigError on an UNKNOWN name, because a typo must never
 *     silently degrade to "no screening ran, approved anyway".
 */
function resolveProviderName(
  env: ProviderEnv,
  envKey: string,
  known: Set<string>,
): string | null {
  const raw = trimmed(env(envKey))?.toLowerCase() ?? null;
  if (!raw || raw === 'noop') return null;
  if (!known.has(raw)) {
    throw new ModerationConfigError(
      `Unknown moderation provider "${raw}" for ${envKey}. Fail closed: refusing to run.`,
      { envKey, name: raw },
    );
  }
  return raw;
}

/**
 * Resolve the provider set for a worker run.
 *
 * With no configured vendor and no test stubs, every field is null and
 * usingTestStubs is false. Callers MUST interpret that as "route to human
 * review". This function throws only for genuine configuration errors (unknown
 * provider name, or stubs requested in production), never for the normal
 * unwired state.
 */
export function resolveModerationProviders(env: ProviderEnv): ResolvedModerationProviders {
  if (stubsRequested(env)) {
    if (!isNonProductionEnvironment(env)) {
      throw new ModerationConfigError(
        'BESTCHEF_MODERATION_TEST_STUBS=1 requires a non-production environment marker ' +
          '(BESTCHEF_ENV / NODE_ENV in development|test|staging|...). Refusing to run: ' +
          'stubs in production would auto-approve content.',
        { environment: environmentMarker(env) },
      );
    }
    const stubs = createTestStubProviders();
    return { ...stubs, usingTestStubs: true };
  }

  // No stubs: resolve real vendor names. Unknown names throw; noop/unset => null.
  const nsfwName = resolveProviderName(env, 'BESTCHEF_NSFW_PROVIDER', KNOWN_NSFW_PROVIDERS);
  const foodName = resolveProviderName(env, 'BESTCHEF_FOOD_PROVIDER', KNOWN_FOOD_PROVIDERS);
  const childName = resolveProviderName(
    env,
    'BESTCHEF_CHILD_SAFETY_PROVIDER',
    KNOWN_CHILD_SAFETY_PROVIDERS,
  );

  // Every known name today is 'noop' (handled as null above). When a real vendor
  // adapter is added for F3, construct it here keyed on the resolved name. Until
  // then, a non-null name is unreachable, so any name resolves to no provider
  // and the worker stays fully fail-closed.
  return {
    nsfw: nsfwName ? unbuiltVendorAdapter('nsfw', nsfwName) : null,
    food: foodName ? unbuiltVendorAdapter('food', foodName) : null,
    childSafety: childName ? unbuiltVendorAdapter('childSafety', childName) : null,
    usingTestStubs: false,
  };
}

/**
 * Placeholder for a not-yet-built vendor adapter. Reaching this is only possible
 * if a name is added to a KNOWN_* set before its adapter exists; it throws so the
 * gap is loud rather than silently approving. It is NOT detection logic.
 */
function unbuiltVendorAdapter(dimension: string, name: string): never {
  throw new ModerationConfigError(
    `Provider "${name}" for ${dimension} is registered but has no adapter yet (founder item F3). ` +
      'Fail closed: refusing to run until the vendor adapter is implemented behind this seam.',
    { dimension, name },
  );
}

// ── Test stubs (env-gated, non-production only) ──────────────────────────
//
// These are the ONLY providers that emit a clear/food verdict. They exist so the
// worker's happy path and the dispatch skeleton can be exercised in dev/CI. They
// are unreachable in production by construction (see resolveModerationProviders).

function stubCapability(
  kind: ProviderCapability['kind'],
  description: string,
): ProviderCapability {
  return {
    name: 'test-stub',
    kind,
    description,
    supportedMediaKinds: ['image', 'video'],
    productionReady: false,
  };
}

export function createTestStubProviders(): {
  nsfw: NsfwImageClassifierProvider;
  food: FoodImageClassifierProvider;
  childSafety: ChildSafetyHashMatchProvider;
} {
  return {
    nsfw: {
      capability: stubCapability('nsfw_image', 'Non-production NSFW test stub (always clear).'),
      async screen() {
        return { verdict: 'clear', score: 0.01, label: 'safe' };
      },
    },
    food: {
      capability: stubCapability('food_image', 'Non-production food test stub (always food).'),
      async screen() {
        return { verdict: 'clear', score: 0.95, label: 'food' };
      },
    },
    childSafety: {
      capability: stubCapability(
        'child_safety_hash',
        'Non-production child-safety test stub (never matches).',
      ),
      async screen() {
        return { verdict: 'no_match' };
      },
    },
  };
}
