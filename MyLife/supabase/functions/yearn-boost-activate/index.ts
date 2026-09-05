import {
  verifyYearnBoostTransaction,
  type VerifyYearnBoostTransactionOptions,
  type YearnBoostVerificationResult,
} from './verify.ts';

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

export interface YearnBoostSupabaseClient {
  auth: { getUser(jwt?: string): PromiseLike<AuthUserResult> };
  schema(name: string): {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: unknown }>;
  };
}

export type YearnBoostCreateClient = (
  url: string,
  key: string,
  options?: SupabaseClientOptions,
) => YearnBoostSupabaseClient;

export interface YearnBoostActivateDeps {
  env: (key: string) => string | undefined;
  createClient: YearnBoostCreateClient;
  verifyTransaction: (
    signedTransaction: string,
    options: VerifyYearnBoostTransactionOptions,
  ) => Promise<YearnBoostVerificationResult>;
  now: () => Date;
}

interface YearnBoostConfig {
  bundleId: string;
  productId: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

interface BoostRpcRow {
  expires_at: string;
  duplicate: boolean;
}

const DEFAULT_BOOST_PRODUCT_ID = 'com.mylife.yearn.boost';
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

function readConfig(env: YearnBoostActivateDeps['env']): YearnBoostConfig | null {
  const bundleId = stringOrNull(env('YEARN_APPSTORE_BUNDLE_ID'));
  const supabaseUrl = stringOrNull(env('SUPABASE_URL'));
  const anonKey = stringOrNull(env('SUPABASE_ANON_KEY'));
  const serviceRoleKey = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!bundleId || !supabaseUrl || !anonKey || !serviceRoleKey) return null;

  return {
    bundleId,
    productId: stringOrNull(env('YEARN_BOOST_PRODUCT_ID')) ?? DEFAULT_BOOST_PRODUCT_ID,
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

function parseBoostRpcRow(data: unknown): BoostRpcRow | null {
  const candidate = Array.isArray(data) ? data[0] : data;
  const row = objectRecord(candidate);
  const expiresAt = stringOrNull(row.expires_at);
  if (!expiresAt || typeof row.duplicate !== 'boolean') return null;
  return { expires_at: expiresAt, duplicate: row.duplicate };
}

export async function handleRequest(
  req: Request,
  deps: YearnBoostActivateDeps,
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
      now: deps.now(),
    });
  } catch {
    return errorResponse('malformed_jws', 400);
  }
  if (!verification.valid) return errorResponse(verification.reason, 400);
  if (
    verification.environment !== 'production' &&
    deps.env('YEARN_ALLOW_SANDBOX_BOOST') !== 'true'
  ) {
    return errorResponse('sandbox_not_allowed', 400);
  }

  // The client sets appAccountToken to the authenticated user id when
  // starting the StoreKit purchase (src/lib/iap.ts). Requiring it binds the
  // transaction to exactly one account: a JWS passed to another user's
  // session can never redeem. There are no legacy clients (the app has not
  // launched), so absence is rejected, not tolerated.
  if (!verification.appAccountToken || verification.appAccountToken !== userId) {
    return errorResponse('account_mismatch', 400);
  }

  try {
    const serviceClient = deps.createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    const { data, error } = await serviceClient.schema('yearn').rpc(
      'activate_boost_validated',
      {
        p_user_id: userId,
        // The RPC keeps its existing parameter name, but consumable repurchases
        // share originalTransactionId. Store transactionId for per-purchase dedup.
        p_original_transaction_id: verification.transactionId,
        p_environment: verification.environment,
      },
    );
    if (error) return errorResponse('activation_failed', 500);

    const row = parseBoostRpcRow(data);
    if (!row) return errorResponse('activation_failed', 500);
    return jsonResponse({ expiresAt: row.expires_at, duplicate: row.duplicate });
  } catch {
    return errorResponse('activation_failed', 500);
  }
}

let runtimeCreateClientPromise: Promise<YearnBoostCreateClient> | null = null;

function loadRuntimeCreateClient(): Promise<YearnBoostCreateClient> {
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
      return createClient as YearnBoostCreateClient;
    })();
  }
  return runtimeCreateClientPromise;
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve(async (req) => {
    let createClient: YearnBoostCreateClient;
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
