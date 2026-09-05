// Yearn membership activation (plan 47 Phase 5).
//
// Validates a StoreKit 2 auto-renewable subscription transaction JWS
// (com.mylife.yearn.membership) with the same pinned Apple chain
// verification as the boost, requires the appAccountToken account binding,
// and records server-truth state via the service-role upsert_entitlement
// RPC. Fails closed without configuration; refunds/renewals are kept
// current by the yearn-appstore-notifications webhook.

import {
  verifyYearnBoostTransaction,
  type VerifyYearnBoostTransactionOptions,
  type YearnBoostVerificationResult,
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
  global?: { headers?: Record<string, string> };
}

interface AuthUserResult {
  data: { user: { id: string } | null };
  error: unknown;
}

export interface YearnMembershipSupabaseClient {
  auth: { getUser(jwt?: string): PromiseLike<AuthUserResult> };
  schema(name: string): {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: unknown }>;
  };
}

export type YearnMembershipCreateClient = (
  url: string,
  key: string,
  options?: SupabaseClientOptions,
) => YearnMembershipSupabaseClient;

export interface YearnMembershipActivateDeps {
  env: (key: string) => string | undefined;
  createClient: YearnMembershipCreateClient;
  verifyTransaction: (
    signedTransaction: string,
    options: VerifyYearnBoostTransactionOptions,
  ) => Promise<YearnBoostVerificationResult>;
  now: () => Date;
}

interface YearnMembershipConfig {
  bundleId: string;
  productId: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

const DEFAULT_MEMBERSHIP_PRODUCT_ID = 'com.mylife.yearn.membership';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

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

function readConfig(env: YearnMembershipActivateDeps['env']): YearnMembershipConfig | null {
  const bundleId = stringOrNull(env('YEARN_APPSTORE_BUNDLE_ID'));
  const supabaseUrl = stringOrNull(env('SUPABASE_URL'));
  const anonKey = stringOrNull(env('SUPABASE_ANON_KEY'));
  const serviceRoleKey = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!bundleId || !supabaseUrl || !anonKey || !serviceRoleKey) return null;

  return {
    bundleId,
    productId: stringOrNull(env('YEARN_MEMBERSHIP_PRODUCT_ID')) ?? DEFAULT_MEMBERSHIP_PRODUCT_ID,
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    anonKey,
    serviceRoleKey,
  };
}

function bearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

export async function handleRequest(
  req: Request,
  deps: YearnMembershipActivateDeps,
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
  const signedTransaction = stringOrNull(body.signedTransaction);
  if (!signedTransaction) return errorResponse('malformed_body', 400);

  const token = bearerToken(req.headers.get('Authorization'));
  if (!token) return errorResponse('unauthorized', 401);

  let userId: string | null = null;
  try {
    const anonClient = deps.createClient(config.supabaseUrl, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await anonClient.auth.getUser(token);
    userId = error ? null : stringOrNull(data.user?.id);
  } catch {
    userId = null;
  }
  if (!userId) return errorResponse('unauthorized', 401);

  let verification: YearnBoostVerificationResult;
  try {
    verification = await deps.verifyTransaction(signedTransaction, {
      expectedBundleId: config.bundleId,
      expectedProductId: config.productId,
      expectedType: 'Auto-Renewable Subscription',
      now: deps.now(),
    });
  } catch {
    return errorResponse('malformed_jws', 400);
  }
  if (!verification.valid) return errorResponse(verification.reason, 400);
  if (
    verification.environment !== 'production' &&
    deps.env('YEARN_ALLOW_SANDBOX_MEMBERSHIP') !== 'true'
  ) {
    return errorResponse('sandbox_not_allowed', 400);
  }

  // Same binding rule as the boost: the transaction must carry the
  // purchasing account's id, so a JWS replayed from another session can
  // never redeem. No legacy-client leniency (the app has not launched).
  if (!verification.appAccountToken || verification.appAccountToken !== userId) {
    return errorResponse('account_mismatch', 400);
  }

  const expiresMs = verification.expiresDate;
  if (typeof expiresMs !== 'number') return errorResponse('malformed_jws', 400);

  const nowMs = deps.now().getTime();
  const status = expiresMs > nowMs ? 'active' : 'expired';
  const expiresAt = new Date(expiresMs).toISOString();

  try {
    const serviceClient = deps.createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    const { error } = await serviceClient.schema('yearn').rpc('upsert_entitlement', {
      p_user_id: userId,
      p_product_id: config.productId,
      p_original_transaction_id: verification.originalTransactionId,
      p_status: status,
      p_environment: verification.environment === 'production' ? 'Production' : 'Sandbox',
      p_expires_at: expiresAt,
    });
    if (error) return errorResponse('activation_failed', 500);
    return jsonResponse({ status, expiresAt, isMember: status === 'active' });
  } catch {
    return errorResponse('activation_failed', 500);
  }
}

let runtimeCreateClientPromise: Promise<YearnMembershipCreateClient> | null = null;

function loadRuntimeCreateClient(): Promise<YearnMembershipCreateClient> {
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
      return createClient as YearnMembershipCreateClient;
    })();
  }
  return runtimeCreateClientPromise;
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve(async (req) => {
    let createClient: YearnMembershipCreateClient;
    try {
      createClient = await loadRuntimeCreateClient();
    } catch {
      return errorResponse('not_configured', 503);
    }
    return handleRequest(req, {
      env: (key) => Deno!.env.get(key),
      createClient,
      verifyTransaction: verifyYearnBoostTransaction,
      now: () => new Date(),
    });
  });
}
