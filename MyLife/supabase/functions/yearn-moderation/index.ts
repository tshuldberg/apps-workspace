// Yearn moderation operations surface (plan 47 Phase 3 item 2).
//
// Thin auth + transport wrapper over the service-role moderation RPCs from
// 20260712000004 and 20260730000001. Authenticates operators with a bearer
// admin secret (timing-safe compare) and fails closed (503) when the secret
// or Supabase service credentials are not configured. It contains no
// moderation business logic: lifecycle rules, the enforcement ledger, and the
// minor-safety seam all live in SQL. This function can never transmit to
// NCMEC; 'transmitted' is refused here, in the RPC, and by the DB trigger.

import { timingSafeEqual } from '../_shared/worker-secret.ts';

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

export interface YearnModerationSupabaseClient {
  schema(name: string): {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: unknown }>;
  };
}

export type YearnModerationCreateClient = (
  url: string,
  key: string,
  options?: SupabaseClientOptions,
) => YearnModerationSupabaseClient;

export interface YearnModerationDeps {
  env: (key: string) => string | undefined;
  createClient: YearnModerationCreateClient;
}

interface YearnModerationConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  adminSecret: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const REPORT_STATUSES = new Set(['open', 'reviewing', 'actioned', 'dismissed']);
const ESCALATION_STATUSES = new Set([
  'pending_registration',
  'ready_for_transmission',
  'transmitted',
  'dismissed',
]);
const ESCALATION_ADVANCE_STATUSES = new Set(['ready_for_transmission', 'dismissed']);
const VERIFICATION_STATUSES = new Set([
  'pending_review',
  'approved',
  'rejected',
  'revoked',
  'superseded',
]);
const VERIFICATION_DECISIONS = new Set(['approved', 'rejected', 'revoked']);
const MODERATION_ACTIONS = new Set([
  'warn',
  'hide_pending_review',
  'unhide',
  'suspend',
  'unsuspend',
  'ban',
  'remove_photo',
  'clear_profile_field',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function errorResponse(error: string, status: number, message?: string): Response {
  return jsonResponse(message ? { error, message } : { error }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function uuidOrNull(value: unknown): string | null {
  const candidate = stringOrNull(value);
  return candidate && UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

function timestampOrNull(value: unknown): string | null {
  const candidate = stringOrNull(value);
  if (!candidate) return null;
  return Number.isFinite(Date.parse(candidate)) ? candidate : null;
}

function limitOrDefault(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 50;
  return Math.max(1, Math.min(value, 200));
}

function readConfig(env: YearnModerationDeps['env']): YearnModerationConfig | null {
  const supabaseUrl = stringOrNull(env('SUPABASE_URL'));
  const serviceRoleKey = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  const adminSecret = stringOrNull(env('YEARN_MODERATION_ADMIN_SECRET'));
  if (!supabaseUrl || !serviceRoleKey || !adminSecret) return null;
  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    serviceRoleKey,
    adminSecret,
  };
}

function bearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

interface RpcCall {
  name: string;
  params: Record<string, unknown>;
}

/**
 * Maps a validated op body onto exactly one service-role RPC call.
 * Returns a string error code when the body fails validation.
 */
export function rpcCallForOp(body: Record<string, unknown>): RpcCall | string {
  const op = stringOrNull(body.op);
  switch (op) {
    case 'list_reports': {
      const status = stringOrNull(body.status);
      if (status && !REPORT_STATUSES.has(status)) return 'invalid_status';
      if (body.before !== undefined && !timestampOrNull(body.before)) return 'invalid_before';
      return {
        name: 'list_reports',
        params: {
          p_status: status,
          p_limit: limitOrDefault(body.limit),
          p_before: timestampOrNull(body.before),
        },
      };
    }
    case 'get_report': {
      const reportId = uuidOrNull(body.reportId);
      if (!reportId) return 'invalid_report_id';
      return { name: 'get_report_detail', params: { p_report_id: reportId } };
    }
    case 'set_report_status': {
      const reportId = uuidOrNull(body.reportId);
      const status = stringOrNull(body.status);
      const reviewer = stringOrNull(body.reviewer);
      if (!reportId) return 'invalid_report_id';
      if (!status || !REPORT_STATUSES.has(status)) return 'invalid_status';
      if (!reviewer) return 'invalid_reviewer';
      return {
        name: 'moderate_report',
        params: {
          p_report_id: reportId,
          p_new_status: status,
          p_reviewer: reviewer,
          p_note: stringOrNull(body.note),
        },
      };
    }
    case 'apply_action': {
      const targetUserId = uuidOrNull(body.targetUserId);
      const action = stringOrNull(body.action);
      const actor = stringOrNull(body.actor);
      if (!targetUserId) return 'invalid_target_user_id';
      if (!action || !MODERATION_ACTIONS.has(action)) return 'invalid_action';
      if (!actor) return 'invalid_actor';
      if (body.reportId !== undefined && !uuidOrNull(body.reportId)) return 'invalid_report_id';
      if (body.suspendUntil !== undefined && !timestampOrNull(body.suspendUntil)) {
        return 'invalid_suspend_until';
      }
      const detail = body.detail === undefined ? null : body.detail;
      if (detail !== null && (typeof detail !== 'object' || Array.isArray(detail))) {
        return 'invalid_detail';
      }
      return {
        name: 'apply_moderation_action',
        params: {
          p_target_user_id: targetUserId,
          p_action: action,
          p_actor: actor,
          p_reason: stringOrNull(body.reason),
          p_report_id: uuidOrNull(body.reportId),
          p_suspend_until: timestampOrNull(body.suspendUntil),
          p_detail: detail,
        },
      };
    }
    case 'list_escalations': {
      const status = stringOrNull(body.status);
      if (status && !ESCALATION_STATUSES.has(status)) return 'invalid_status';
      if (body.before !== undefined && !timestampOrNull(body.before)) return 'invalid_before';
      return {
        name: 'list_safety_escalations',
        params: {
          p_status: status,
          p_limit: limitOrDefault(body.limit),
          p_before: timestampOrNull(body.before),
        },
      };
    }
    case 'list_verifications': {
      const status = stringOrNull(body.status);
      if (status && !VERIFICATION_STATUSES.has(status)) return 'invalid_status';
      if (body.before !== undefined && !timestampOrNull(body.before)) return 'invalid_before';
      return {
        name: 'list_verification_submissions',
        params: {
          p_status: status,
          p_limit: limitOrDefault(body.limit),
          p_before: timestampOrNull(body.before),
        },
      };
    }
    case 'review_verification': {
      const submissionId = uuidOrNull(body.submissionId);
      const decision = stringOrNull(body.decision);
      const reviewer = stringOrNull(body.reviewer);
      if (!submissionId) return 'invalid_submission_id';
      if (!decision || !VERIFICATION_DECISIONS.has(decision)) return 'invalid_decision';
      if (!reviewer) return 'invalid_reviewer';
      return {
        name: 'review_verification',
        params: {
          p_submission_id: submissionId,
          p_decision: decision,
          p_reviewer: reviewer,
          p_reason: stringOrNull(body.reason),
        },
      };
    }
    case 'advance_escalation': {
      const escalationId = uuidOrNull(body.escalationId);
      const status = stringOrNull(body.status);
      const operator = stringOrNull(body.operator);
      if (!escalationId) return 'invalid_escalation_id';
      // 'transmitted' is structurally impossible from this surface: NCMEC
      // transmission requires registered ESP status (founder item) and a
      // separately authored migration.
      if (!status || !ESCALATION_ADVANCE_STATUSES.has(status)) return 'invalid_status';
      if (!operator) return 'invalid_operator';
      return {
        name: 'advance_safety_escalation',
        params: {
          p_escalation_id: escalationId,
          p_new_status: status,
          p_operator: operator,
        },
      };
    }
    default:
      return 'unknown_op';
  }
}

function rpcErrorMessage(error: unknown): string | undefined {
  const record = objectRecord(error);
  return stringOrNull(record.message) ?? undefined;
}

export async function handleRequest(
  req: Request,
  deps: YearnModerationDeps,
): Promise<Response> {
  const config = readConfig(deps.env);
  if (!config) return errorResponse('not_configured', 503);

  if (req.method !== 'POST') return errorResponse('method_not_allowed', 405);

  const supplied = bearerToken(req.headers.get('Authorization'));
  if (!(await timingSafeEqual(supplied, config.adminSecret))) {
    return errorResponse('unauthorized', 401);
  }

  let body: Record<string, unknown>;
  try {
    body = objectRecord(await req.json());
  } catch {
    return errorResponse('malformed_body', 400);
  }

  const call = rpcCallForOp(body);
  if (typeof call === 'string') return errorResponse(call, 400);

  try {
    const client = deps.createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    const { data, error } = await client.schema('yearn').rpc(call.name, call.params);
    if (error) return errorResponse('rpc_failed', 400, rpcErrorMessage(error));
    return jsonResponse({ data: data ?? null });
  } catch {
    return errorResponse('rpc_failed', 500);
  }
}

let runtimeCreateClientPromise: Promise<YearnModerationCreateClient> | null = null;

function loadRuntimeCreateClient(): Promise<YearnModerationCreateClient> {
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
      return createClient as YearnModerationCreateClient;
    })();
  }
  return runtimeCreateClientPromise;
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve(async (req) => {
    let createClient: YearnModerationCreateClient;
    try {
      createClient = await loadRuntimeCreateClient();
    } catch {
      return errorResponse('not_configured', 503);
    }
    return handleRequest(req, {
      env: (key) => Deno!.env.get(key),
      createClient,
    });
  });
}
