import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuditExport } from './audit-chain';
import type { ConsoleQueue } from './console-integrity';
import {
  decodeCursor,
  encodeCursor,
  keysetAfterFilter,
  keysetBeforeFilter,
  type KeysetCursor,
} from './pagination';
import { type ModeratorRole, isModeratorRole, isPendingActionKind, type PendingActionKind } from './roles';

/**
 * Service-role reads for the WP9 surfaces: roles, pending approvals, the unified
 * appeals queue, assignments, and the audit chain. Every function is called from
 * a page that ran requireModerator() first, and every table read here is RLS-on
 * with zero client policies (migration 20260730000010), so nothing but this
 * service-role client can reach them.
 */

/* --------------------------------- roles ---------------------------------- */

export interface ModeratorRoleRow {
  moderatorRef: string;
  role: ModeratorRole;
  isActive: boolean;
  grantedBy: string | null;
  grantedAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
  note: string;
}

export async function fetchModeratorRoles(admin: SupabaseClient): Promise<ModeratorRoleRow[]> {
  const { data, error } = await admin.rpc('nw_moderator_roles_list');
  if (error) throw new Error(`mynews-console: moderator role read failed: ${error.message}`);
  return ((data ?? []) as Array<{
    moderator_ref: string;
    role: string;
    is_active: boolean;
    granted_by: string | null;
    granted_at: string;
    revoked_by: string | null;
    revoked_at: string | null;
    note: string;
  }>)
    .filter((row) => isModeratorRole(row.role))
    .map((row) => ({
      moderatorRef: row.moderator_ref,
      role: row.role as ModeratorRole,
      isActive: row.is_active,
      grantedBy: row.granted_by,
      grantedAt: row.granted_at,
      revokedBy: row.revoked_by,
      revokedAt: row.revoked_at,
      note: row.note,
    }));
}

/* ---------------------------- pending approvals --------------------------- */

export interface PendingActionRow {
  id: string;
  kind: PendingActionKind;
  targetKind: string;
  targetId: string;
  params: Record<string, unknown>;
  reason: string;
  reportId: string | null;
  proposedBy: string;
  proposedRole: string;
  proposedAt: string;
  targetVersion: number | null;
  state: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired' | 'failed';
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string;
  executedAt: string | null;
  executionOutcome: string | null;
  expiresAt: string;
  /** Handle of the target profile, when the target is a profile. */
  targetHandle: string | null;
}

const PENDING_SELECT =
  'id,kind,target_kind,target_id,params,reason,report_id,proposed_by,proposed_role,proposed_at,' +
  'target_version,state,decided_by,decided_at,decision_reason,executed_at,execution_outcome,expires_at';

export interface PendingActionPage {
  items: PendingActionRow[];
  nextCursor: string | null;
}

/**
 * Keyset-paginated approvals, newest proposal first. Cursors run on
 * (proposed_at, id) so a proposal decided between page loads cannot shift the
 * window the way an OFFSET would.
 */
export async function fetchPendingActionPage(
  admin: SupabaseClient,
  options: { openOnly?: boolean; limit?: number; cursor?: string | null } = {},
): Promise<PendingActionPage> {
  const pageSize = Math.min(Math.max(options.limit ?? 25, 1), 200);
  const rows = await fetchPendingActions(admin, {
    openOnly: options.openOnly,
    limit: pageSize + 1,
    cursor: options.cursor,
  });
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last ? encodeCursor({ createdAt: last.proposedAt, id: last.id }) : null,
  };
}

export async function fetchPendingActions(
  admin: SupabaseClient,
  options: { openOnly?: boolean; limit?: number; cursor?: string | null } = {},
): Promise<PendingActionRow[]> {
  let query = admin.from('nw_pending_actions').select(PENDING_SELECT);
  if (options.openOnly !== false) query = query.eq('state', 'pending');
  const cursor = decodeCursor(options.cursor);
  if (cursor) query = query.or(keysetBeforeFilter(cursor, 'proposed_at'));
  const { data, error } = await query
    .order('proposed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(options.limit ?? 100);
  if (error) throw new Error(`mynews-console: pending action read failed: ${error.message}`);
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  const profileIds = [
    ...new Set(
      rows
        .filter((row) => row.target_kind === 'profile' || row.target_kind === 'payout_account')
        .map((row) => String(row.target_id)),
    ),
  ];
  const handleById = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles, error: profileError } = await admin
      .from('nw_profiles')
      .select('id,handle')
      .in('id', profileIds);
    if (profileError) {
      throw new Error(`mynews-console: pending action handle read failed: ${profileError.message}`);
    }
    for (const profile of (profiles ?? []) as Array<{ id: string; handle: string }>) {
      handleById.set(profile.id, profile.handle);
    }
  }

  return rows
    .filter((row) => isPendingActionKind(row.kind))
    .map((row) => ({
      id: String(row.id),
      kind: row.kind as PendingActionKind,
      targetKind: String(row.target_kind),
      targetId: String(row.target_id),
      params:
        row.params && typeof row.params === 'object'
          ? (row.params as Record<string, unknown>)
          : {},
      reason: String(row.reason ?? ''),
      reportId: (row.report_id as string | null) ?? null,
      proposedBy: String(row.proposed_by ?? ''),
      proposedRole: String(row.proposed_role ?? ''),
      proposedAt: String(row.proposed_at),
      targetVersion:
        typeof row.target_version === 'number' ? (row.target_version as number) : null,
      state: row.state as PendingActionRow['state'],
      decidedBy: (row.decided_by as string | null) ?? null,
      decidedAt: (row.decided_at as string | null) ?? null,
      decisionReason: String(row.decision_reason ?? ''),
      executedAt: (row.executed_at as string | null) ?? null,
      executionOutcome: (row.execution_outcome as string | null) ?? null,
      expiresAt: String(row.expires_at),
      targetHandle: handleById.get(String(row.target_id)) ?? null,
    }));
}

/* ------------------------------- appeals ---------------------------------- */

export interface ConsoleAppealRow {
  source: 'moderation' | 'screening';
  appealId: string;
  state: string;
  appealReason: string;
  createdAt: string;
  consoleVersion: number;
  subjectAction: string;
  targetKind: string;
  targetId: string;
  subjectNote: string;
  /** The moderator whose decision is being appealed, when one is recorded. */
  decidedAgainstBy: string | null;
  appellantProfileId: string;
  appellantHandle: string | null;
  reviewerRef: string | null;
  decidedAt: string | null;
  decisionReason: string;
}

/**
 * The unified appeals queue: appeals against moderation actions plus the WP8
 * screening appeals, from one view. Requested appeals first (that is the work),
 * newest last so the oldest unanswered appeal is at the top.
 */
export interface AppealPage {
  items: ConsoleAppealRow[];
  nextCursor: string | null;
}

/**
 * Keyset-paginated appeals. Oldest first, so the appeal that has been waiting
 * longest is the first thing an operator sees, with the cursor moving forward
 * through (created_at, appeal_id).
 */
export async function fetchAppealPage(
  admin: SupabaseClient,
  options: { openOnly?: boolean; limit?: number; cursor?: string | null } = {},
): Promise<AppealPage> {
  const pageSize = Math.min(Math.max(options.limit ?? 25, 1), 200);
  const cursor = decodeCursor(options.cursor);
  const rows = await readAppealRows(admin, {
    openOnly: options.openOnly,
    limit: pageSize + 1,
    cursor,
  });
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.appealId }) : null,
  };
}

async function readAppealRows(
  admin: SupabaseClient,
  options: { openOnly?: boolean; limit: number; cursor?: KeysetCursor | null },
): Promise<ConsoleAppealRow[]> {
  let query = admin
    .from('nw_console_appeals')
    .select(
      'source,appeal_id,state,appeal_reason,created_at,console_version,subject_action,target_kind,' +
        'target_id,subject_note,decided_against_by,appellant_profile_id,reviewer_ref,decided_at,decision_reason',
    );
  if (options.openOnly !== false) query = query.eq('state', 'requested');
  if (options.cursor) {
    query = query.or(keysetAfterFilter(options.cursor, 'created_at', 'appeal_id'));
  }
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .order('appeal_id', { ascending: true })
    .limit(options.limit);
  if (error) throw new Error(`mynews-console: appeal queue read failed: ${error.message}`);
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  const profileIds = [...new Set(rows.map((row) => String(row.appellant_profile_id)))];
  const { data: profiles, error: profileError } = await admin
    .from('nw_profiles')
    .select('id,handle')
    .in('id', profileIds);
  if (profileError) {
    throw new Error(`mynews-console: appeal handle read failed: ${profileError.message}`);
  }
  const handleById = new Map(
    ((profiles ?? []) as Array<{ id: string; handle: string }>).map((row) => [row.id, row.handle]),
  );

  return rows.map((row) => ({
    source: row.source === 'screening' ? 'screening' : 'moderation',
    appealId: String(row.appeal_id),
    state: String(row.state),
    appealReason: String(row.appeal_reason ?? ''),
    createdAt: String(row.created_at),
    consoleVersion: typeof row.console_version === 'number' ? (row.console_version as number) : 0,
    subjectAction: String(row.subject_action ?? ''),
    targetKind: String(row.target_kind ?? ''),
    targetId: String(row.target_id ?? ''),
    subjectNote: String(row.subject_note ?? ''),
    decidedAgainstBy: (row.decided_against_by as string | null) ?? null,
    appellantProfileId: String(row.appellant_profile_id),
    appellantHandle: handleById.get(String(row.appellant_profile_id)) ?? null,
    reviewerRef: (row.reviewer_ref as string | null) ?? null,
    decidedAt: (row.decided_at as string | null) ?? null,
    decisionReason: String(row.decision_reason ?? ''),
  }));
}

/* ------------------------------ assignments ------------------------------- */

export interface QueueAssignment {
  queue: ConsoleQueue;
  itemId: string;
  assigneeRef: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  escalationLevel: 'none' | 'senior' | 'admin';
  escalationReason: string;
  escalatedBy: string | null;
  escalatedAt: string | null;
}

/**
 * Assignment and escalation state for a set of items in one queue, keyed by item
 * id. Batched so a queue page stays one extra read rather than one per row.
 */
export async function fetchAssignments(
  admin: SupabaseClient,
  queue: ConsoleQueue,
  itemIds: readonly string[],
): Promise<Map<string, QueueAssignment>> {
  if (itemIds.length === 0) return new Map();
  const { data, error } = await admin
    .from('nw_queue_assignments')
    .select(
      'queue,item_id,assignee_ref,assigned_by,assigned_at,escalation_level,escalation_reason,escalated_by,escalated_at',
    )
    .eq('queue', queue)
    .in('item_id', [...itemIds]);
  if (error) throw new Error(`mynews-console: assignment read failed: ${error.message}`);
  const out = new Map<string, QueueAssignment>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    out.set(String(row.item_id), {
      queue,
      itemId: String(row.item_id),
      assigneeRef: (row.assignee_ref as string | null) ?? null,
      assignedBy: (row.assigned_by as string | null) ?? null,
      assignedAt: (row.assigned_at as string | null) ?? null,
      escalationLevel: (row.escalation_level as QueueAssignment['escalationLevel']) ?? 'none',
      escalationReason: String(row.escalation_reason ?? ''),
      escalatedBy: (row.escalated_by as string | null) ?? null,
      escalatedAt: (row.escalated_at as string | null) ?? null,
    });
  }
  return out;
}

/* -------------------------------- audit ----------------------------------- */

export interface ConsoleAuditRow {
  seq: number;
  actorRef: string;
  actorRole: string;
  action: string;
  targetKind: string;
  targetId: string;
  outcome: string;
  reason: string;
  payload: Record<string, unknown>;
  createdAt: string;
  rowHash: string;
}

/** Recent console audit rows, newest first. Read-only: the table is append-only. */
export async function fetchConsoleAudit(
  admin: SupabaseClient,
  options: { limit?: number; actorRef?: string | null; action?: string | null } = {},
): Promise<ConsoleAuditRow[]> {
  let query = admin
    .from('nw_console_audit')
    .select('seq,actor_ref,actor_role,action,target_kind,target_id,outcome,reason,payload,created_at,row_hash');
  if (options.actorRef) query = query.eq('actor_ref', options.actorRef);
  if (options.action) query = query.eq('action', options.action);
  const { data, error } = await query
    .order('seq', { ascending: false })
    .limit(options.limit ?? 100);
  if (error) throw new Error(`mynews-console: console audit read failed: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    seq: Number(row.seq),
    actorRef: String(row.actor_ref ?? ''),
    actorRole: String(row.actor_role ?? ''),
    action: String(row.action ?? ''),
    targetKind: String(row.target_kind ?? ''),
    targetId: String(row.target_id ?? ''),
    outcome: String(row.outcome ?? ''),
    reason: String(row.reason ?? ''),
    payload:
      row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {},
    createdAt: String(row.created_at),
    rowHash: String(row.row_hash ?? ''),
  }));
}

/** The chain's current head hash and length, for the audit screen header. */
export async function fetchAuditChainHead(
  admin: SupabaseClient,
): Promise<{ seq: number; rowHash: string } | null> {
  const { data, error } = await admin
    .from('nw_console_audit')
    .select('seq,row_hash')
    .order('seq', { ascending: false })
    .limit(1);
  if (error) throw new Error(`mynews-console: audit head read failed: ${error.message}`);
  const row = (data ?? [])[0] as { seq: number; row_hash: string } | undefined;
  return row ? { seq: Number(row.seq), rowHash: row.row_hash } : null;
}

/** SQL-side chain verification, for the console to show alongside its own. */
export async function verifyAuditChainInSql(
  admin: SupabaseClient,
  options: { fromSeq?: number; limit?: number } = {},
): Promise<unknown> {
  const { data, error } = await admin.rpc('nw_console_audit_verify', {
    p_from: options.fromSeq ?? 0,
    p_limit: options.limit ?? 100000,
  });
  if (error) {
    console.error(`mynews-console: nw_console_audit_verify failed: ${error.message}`);
    return { ok: false, reason: 'verify-unavailable' };
  }
  return data;
}

/**
 * The exportable, self-verifying audit document. Carries payloadText so an
 * offline verifier reproduces every hash without trusting this process.
 */
export async function exportAuditChain(
  admin: SupabaseClient,
  options: { fromSeq?: number; limit?: number } = {},
): Promise<AuditExport | null> {
  const { data, error } = await admin.rpc('nw_console_audit_export', {
    p_from: options.fromSeq ?? 0,
    p_limit: options.limit ?? 5000,
  });
  if (error) {
    console.error(`mynews-console: nw_console_audit_export failed: ${error.message}`);
    return null;
  }
  if (!data || typeof data !== 'object' || !Array.isArray((data as AuditExport).rows)) return null;
  return data as AuditExport;
}

/* ----------------------------- payout accounts ---------------------------- */

export interface PayoutAccountRow {
  journalistProfileId: string;
  handle: string | null;
  onboardingState: 'none' | 'pending' | 'verified' | 'blocked';
  provider: string | null;
  statusReason: string | null;
  consoleVersion: number;
  updatedAt: string;
}

/**
 * Payout accounts, so the payment-adjacent dual-control actions have a surface.
 * Read-only here: blocking and unblocking always go through a pending action.
 */
export async function fetchPayoutAccounts(
  admin: SupabaseClient,
  options: { limit?: number } = {},
): Promise<PayoutAccountRow[]> {
  const { data, error } = await admin
    .from('nw_payout_accounts')
    .select('journalist_profile_id,onboarding_state,provider,status_reason,console_version,updated_at')
    .order('updated_at', { ascending: false })
    .limit(options.limit ?? 100);
  if (error) throw new Error(`mynews-console: payout account read failed: ${error.message}`);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];
  const { data: profiles } = await admin
    .from('nw_profiles')
    .select('id,handle')
    .in('id', rows.map((row) => String(row.journalist_profile_id)));
  const handleById = new Map(
    ((profiles ?? []) as Array<{ id: string; handle: string }>).map((row) => [row.id, row.handle]),
  );
  return rows.map((row) => ({
    journalistProfileId: String(row.journalist_profile_id),
    handle: handleById.get(String(row.journalist_profile_id)) ?? null,
    onboardingState: row.onboarding_state as PayoutAccountRow['onboardingState'],
    provider: (row.provider as string | null) ?? null,
    statusReason: (row.status_reason as string | null) ?? null,
    consoleVersion: typeof row.console_version === 'number' ? (row.console_version as number) : 0,
    updatedAt: String(row.updated_at),
  }));
}
