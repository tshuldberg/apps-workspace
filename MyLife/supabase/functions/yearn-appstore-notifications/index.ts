// Yearn App Store Server Notifications V2 webhook (plan 47 Phase 5).
//
// Keeps yearn.entitlements current across renewals, expirations, refunds,
// and revocations. Authentication IS the cryptography: both the notification
// envelope and the inner transaction are Apple-signed JWS values verified
// against the pinned Apple Root CA G3 chain (shared verifier with
// yearn-boost-activate); there is no bearer secret because Apple does not
// send one. Non-membership products and unresolvable users are acknowledged
// with 200 so Apple stops retrying; real processing failures return 5xx so
// Apple retries.

import {
  verifyAppleSignedJws,
  type AppleSignedJwsResult,
  type VerifyAppleSignedJwsOptions,
} from '../yearn-boost-activate/verify.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

interface SupabaseClientOptions {
  auth?: {
    autoRefreshToken?: boolean;
    detectSessionInUrl?: boolean;
    persistSession?: boolean;
  };
}

export interface YearnNotificationsSupabaseClient {
  schema(name: string): {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: unknown }>;
  };
}

export type YearnNotificationsCreateClient = (
  url: string,
  key: string,
  options?: SupabaseClientOptions,
) => YearnNotificationsSupabaseClient;

export interface YearnNotificationsDeps {
  env: (key: string) => string | undefined;
  createClient: YearnNotificationsCreateClient;
  verifyJws: (
    signedJws: string,
    options?: VerifyAppleSignedJwsOptions,
  ) => Promise<AppleSignedJwsResult>;
  now: () => Date;
}

interface YearnNotificationsConfig {
  bundleId: string;
  productId: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}

const DEFAULT_MEMBERSHIP_PRODUCT_ID = 'com.mylife.yearn.membership';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function errorResponse(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readConfig(env: YearnNotificationsDeps['env']): YearnNotificationsConfig | null {
  const bundleId = stringOrNull(env('YEARN_APPSTORE_BUNDLE_ID'));
  const supabaseUrl = stringOrNull(env('SUPABASE_URL'));
  const serviceRoleKey = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!bundleId || !supabaseUrl || !serviceRoleKey) return null;
  return {
    bundleId,
    productId: stringOrNull(env('YEARN_MEMBERSHIP_PRODUCT_ID')) ?? DEFAULT_MEMBERSHIP_PRODUCT_ID,
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    serviceRoleKey,
  };
}

/**
 * Maps a notification to the entitlement status. Refunds and revocations
 * always win; explicit expiration events force 'expired'; a failed renewal
 * inside Apple's grace period keeps access as 'grace'; everything else is
 * derived from the transaction's expiry against now.
 */
export function statusForNotification(
  notificationType: string,
  subtype: string | null,
  expiresMs: number | null,
  nowMs: number,
): 'active' | 'expired' | 'revoked' | 'grace' {
  if (notificationType === 'REFUND' || notificationType === 'REVOKE') return 'revoked';
  if (notificationType === 'EXPIRED' || notificationType === 'GRACE_PERIOD_EXPIRED') {
    return 'expired';
  }
  if (notificationType === 'DID_FAIL_TO_RENEW') {
    if (subtype === 'GRACE_PERIOD') return 'grace';
    return expiresMs !== null && expiresMs > nowMs ? 'grace' : 'expired';
  }
  return expiresMs !== null && expiresMs > nowMs ? 'active' : 'expired';
}

export async function handleRequest(
  req: Request,
  deps: YearnNotificationsDeps,
): Promise<Response> {
  const config = readConfig(deps.env);
  if (!config) return errorResponse('not_configured', 503);

  if (req.method !== 'POST') return errorResponse('method_not_allowed', 405);

  let body: Record<string, unknown>;
  try {
    body = objectRecord(await req.json());
  } catch {
    return errorResponse('malformed_body', 400);
  }
  const signedPayload = stringOrNull(body.signedPayload);
  if (!signedPayload) return errorResponse('malformed_body', 400);

  // Outer envelope: Apple-signed responseBodyV2.
  let envelope: AppleSignedJwsResult;
  try {
    envelope = await deps.verifyJws(signedPayload, { now: deps.now() });
  } catch {
    return errorResponse('malformed_jws', 400);
  }
  if (!envelope.valid) return errorResponse(envelope.reason, 400);

  const notificationType = stringOrNull(envelope.payload.notificationType);
  const subtype = stringOrNull(envelope.payload.subtype);
  const data = objectRecord(envelope.payload.data);
  if (!notificationType) return errorResponse('malformed_body', 400);

  const envelopeBundleId = stringOrNull(data.bundleId);
  if (envelopeBundleId && envelopeBundleId !== config.bundleId) {
    return errorResponse('wrong_bundle', 400);
  }

  const signedTransactionInfo = stringOrNull(data.signedTransactionInfo);
  if (!signedTransactionInfo) {
    // Events without a transaction (e.g. TEST) are acknowledged, not errors.
    return jsonResponse({ ok: true, ignored: 'no_transaction', notificationType });
  }

  // Inner transaction: independently Apple-signed.
  let inner: AppleSignedJwsResult;
  try {
    inner = await deps.verifyJws(signedTransactionInfo, { now: deps.now() });
  } catch {
    return errorResponse('malformed_jws', 400);
  }
  if (!inner.valid) return errorResponse(inner.reason, 400);
  const txn = inner.payload;

  if (txn.bundleId !== config.bundleId) return errorResponse('wrong_bundle', 400);
  if (txn.productId !== config.productId) {
    // Boost consumables (ONE_TIME_CHARGE etc.) carry no subscription state.
    return jsonResponse({ ok: true, ignored: 'product' });
  }

  const environment = txn.environment === 'Production'
    ? 'Production'
    : txn.environment === 'Sandbox'
    ? 'Sandbox'
    : null;
  if (!environment) return errorResponse('malformed_jws', 400);
  if (environment === 'Sandbox' && deps.env('YEARN_ALLOW_SANDBOX_MEMBERSHIP') !== 'true') {
    // Acknowledged so the sandbox does not retry-flood; nothing is written.
    return jsonResponse({ ok: true, ignored: 'sandbox' });
  }

  const originalTransactionId = stringOrNull(txn.originalTransactionId);
  if (!originalTransactionId) return errorResponse('malformed_jws', 400);

  const expiresMs = typeof txn.expiresDate === 'number' && Number.isFinite(txn.expiresDate)
    ? txn.expiresDate
    : null;

  const client = deps.createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  // Resolve the entitlement owner: prefer the account binding in the
  // transaction, fall back to the recorded original transaction id.
  const appAccountToken = stringOrNull(txn.appAccountToken);
  let userId = appAccountToken && UUID_PATTERN.test(appAccountToken)
    ? appAccountToken.toLowerCase()
    : null;
  if (!userId) {
    try {
      const { data: lookup, error } = await client.schema('yearn').rpc(
        'entitlement_user_for_transaction',
        { p_original_transaction_id: originalTransactionId },
      );
      if (error) return errorResponse('processing_failed', 500);
      userId = stringOrNull(lookup);
    } catch {
      return errorResponse('processing_failed', 500);
    }
  }
  if (!userId) {
    // No binding and no recorded purchase: nothing to update. Acknowledged
    // so Apple stops retrying a notification we can never attribute.
    return jsonResponse({ ok: true, ignored: 'no_user', notificationType });
  }

  const status = statusForNotification(
    notificationType,
    subtype,
    expiresMs,
    deps.now().getTime(),
  );

  try {
    const { error } = await client.schema('yearn').rpc('upsert_entitlement', {
      p_user_id: userId,
      p_product_id: config.productId,
      p_original_transaction_id: originalTransactionId,
      p_status: status,
      p_environment: environment,
      p_expires_at: expiresMs !== null ? new Date(expiresMs).toISOString() : null,
    });
    if (error) return errorResponse('processing_failed', 500);
    return jsonResponse({ ok: true, status, notificationType });
  } catch {
    return errorResponse('processing_failed', 500);
  }
}

let runtimeCreateClientPromise: Promise<YearnNotificationsCreateClient> | null = null;

function loadRuntimeCreateClient(): Promise<YearnNotificationsCreateClient> {
  if (!runtimeCreateClientPromise) {
    runtimeCreateClientPromise = (async () => {
      // Keep the pinned dependency literal so the Supabase bundler includes it.
      const imported: unknown = await import(
        // @ts-ignore Deno resolves npm specifiers that TypeScript bundler mode cannot.
        // deno-lint-ignore no-import-prefix
        /* @vite-ignore */ 'npm:@supabase/supabase-js@2.97.0'
      );
      const createClient = objectRecord(imported).createClient;
      if (typeof createClient !== 'function') throw new Error('Supabase client is unavailable.');
      return createClient as YearnNotificationsCreateClient;
    })();
  }
  return runtimeCreateClientPromise;
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve(async (req) => {
    let createClient: YearnNotificationsCreateClient;
    try {
      createClient = await loadRuntimeCreateClient();
    } catch {
      return errorResponse('not_configured', 503);
    }
    return handleRequest(req, {
      env: (key) => Deno!.env.get(key),
      createClient,
      verifyJws: verifyAppleSignedJws,
      now: () => new Date(),
    });
  });
}
