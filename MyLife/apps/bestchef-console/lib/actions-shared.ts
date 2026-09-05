import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { unwrapRpcRow, type RpcErrorRow } from './rpc';

/**
 * Shared redirect helpers for server actions: every mutation revalidates its
 * list page plus the overview counts, then redirects with a machine code
 * (rendered through sanitizeErrorCode on the page side).
 *
 * Call sites must annotate the binding (`const respond: ActionRedirects =`)
 * so TypeScript's never-call control-flow analysis treats respond.fail()
 * as terminating (the rule requires an explicit type on the root
 * identifier of the dotted name).
 */
export interface ActionRedirects {
  done: (ok: string) => never;
  fail: (code: string) => never;
}

export function actionRedirects(listPath: string): ActionRedirects {
  return {
    done(ok: string): never {
      revalidatePath(listPath);
      revalidatePath('/');
      redirect(`${listPath}?ok=${encodeURIComponent(ok)}`);
    },
    fail(code: string): never {
      redirect(`${listPath}?error=${encodeURIComponent(code)}`);
    },
  };
}

interface DecisionRpcRow extends RpcErrorRow {
  target_id: string | null;
  decision_id: string | null;
  previous_state: Record<string, unknown>;
  new_state: Record<string, unknown>;
}

export interface DecisionCallResult {
  decisionId: string | null;
  errorCode: string | null;
}

/**
 * One wrapper for every bc_apply_moderation_decision call so moderator
 * attribution (console_moderator in decision metadata) can never be
 * forgotten. The RPC records actor_profile_id null under service role, so
 * this metadata is the DSA audit trail for who acted. Failures log full
 * detail server-side and return only a machine code.
 */
export async function applyModerationDecision(
  admin: SupabaseClient,
  input: {
    kind: string;
    targetId: string;
    decision: string;
    reason: string | null;
    moderatorEmail: string;
    extraMetadata?: Record<string, unknown>;
  },
): Promise<DecisionCallResult> {
  const { data, error } = await admin.rpc('bc_apply_moderation_decision', {
    p_kind: input.kind,
    p_target_id: input.targetId,
    p_decision: input.decision,
    p_reason: input.reason,
    p_metadata: { console_moderator: input.moderatorEmail, ...input.extraMetadata },
  });
  if (error) {
    console.error(
      `bestchef-console: bc_apply_moderation_decision failed (kind=${input.kind}, target=${input.targetId}, decision=${input.decision}): ${error.message}`,
    );
  }
  const unwrapped = unwrapRpcRow<DecisionRpcRow>(data, error);
  return { decisionId: unwrapped.row?.decision_id ?? null, errorCode: unwrapped.errorCode };
}
