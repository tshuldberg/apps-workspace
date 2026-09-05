import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role reads and RPC calls for the journalist verification center
 * (plan 48 WP8). The journalist tier follows the verification state INSIDE the
 * RPCs, so nothing here sets a tier: an operator approves or revokes a
 * verification and the badge follows, which is what keeps a 'verified' badge
 * from existing without a verification record behind it.
 */

export type VerificationMethod = 'domain_email' | 'orcid' | 'byline' | 'manual';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired';

export interface VerificationRequestRow {
  id: string;
  journalistId: string;
  handle: string | null;
  displayName: string | null;
  method: VerificationMethod;
  /** Free-text evidence reference (a masthead URL, an ORCID, a byline link). */
  evidenceRef: string;
  /** Additional evidence references. Operator-only; never public. */
  evidence: string[];
  status: VerificationStatus;
  decisionReason: string;
  reviewedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  /** Current tier on nw_journalists, so drift between the two is visible. */
  tier: string | null;
  /** Live verification state per nw_verification_state. */
  liveState: VerificationStatus | 'none' | null;
  /** Optimistic concurrency token (plan 48 WP9). */
  consoleVersion: number;
}

const SELECT =
  'id,journalist_id,method,evidence_ref,evidence_json,status,decision_reason,reviewed_by,' +
  'created_at,decided_at,expires_at,revoked_at,console_version';

interface RawRow {
  id: string;
  journalist_id: string;
  method: VerificationMethod;
  evidence_ref: string;
  evidence_json: unknown;
  status: VerificationStatus;
  decision_reason: string;
  reviewed_by: string | null;
  created_at: string;
  decided_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  console_version: number;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/**
 * Verification requests by status, oldest first for the pending queue. Handles,
 * display names, and the current tier are hydrated so an operator can see at a
 * glance whether the tier and the record agree.
 */
export async function fetchVerificationRequests(
  admin: SupabaseClient,
  options: { statuses?: VerificationStatus[]; limit?: number } = {},
): Promise<VerificationRequestRow[]> {
  const statuses = options.statuses ?? ['pending'];
  const { data, error } = await admin
    .from('nw_journalist_verifications')
    .select(SELECT)
    .in('status', statuses)
    .order('created_at', { ascending: true })
    .limit(options.limit ?? 100);
  if (error) throw new Error(`mynews-console: verification read failed: ${error.message}`);
  const rows = (data ?? []) as unknown as RawRow[];
  if (rows.length === 0) return [];

  const journalistIds = [...new Set(rows.map((row) => row.journalist_id))];
  const [profiles, journalists] = await Promise.all([
    admin.from('nw_profiles').select('id,handle,display_name').in('id', journalistIds),
    admin.from('nw_journalists').select('profile_id,tier').in('profile_id', journalistIds),
  ]);
  if (profiles.error) {
    throw new Error(`mynews-console: verification profile hydrate failed: ${profiles.error.message}`);
  }
  if (journalists.error) {
    throw new Error(
      `mynews-console: verification tier hydrate failed: ${journalists.error.message}`,
    );
  }

  const profileById = new Map(
    (
      (profiles.data ?? []) as Array<{ id: string; handle: string; display_name: string }>
    ).map((row) => [row.id, row]),
  );
  const tierById = new Map(
    ((journalists.data ?? []) as Array<{ profile_id: string; tier: string }>).map((row) => [
      row.profile_id,
      row.tier,
    ]),
  );

  // Live state per journalist, from the single SQL definition the app and the
  // public view also read, so the console never invents its own rule.
  const liveStates = new Map<string, VerificationStatus | 'none'>();
  await Promise.all(
    journalistIds.map(async (id) => {
      const { data: state, error: stateError } = await admin.rpc('nw_verification_state', {
        p_profile_id: id,
      });
      if (stateError) {
        console.error(`mynews-console: nw_verification_state failed: ${stateError.message}`);
        return;
      }
      if (typeof state === 'string') liveStates.set(id, state as VerificationStatus | 'none');
    }),
  );

  return rows.map((row) => ({
    id: row.id,
    journalistId: row.journalist_id,
    handle: profileById.get(row.journalist_id)?.handle ?? null,
    displayName: profileById.get(row.journalist_id)?.display_name ?? null,
    method: row.method,
    evidenceRef: row.evidence_ref,
    evidence: stringArray(row.evidence_json),
    status: row.status,
    decisionReason: row.decision_reason,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    tier: tierById.get(row.journalist_id) ?? null,
    liveState: liveStates.get(row.journalist_id) ?? null,
    consoleVersion: row.console_version,
  }));
}

/** Current status of one request (server-action staleness guard). */
export async function fetchVerificationStatus(
  admin: SupabaseClient,
  verificationId: string,
): Promise<VerificationStatus | null> {
  const { data, error } = await admin
    .from('nw_journalist_verifications')
    .select('status')
    .eq('id', verificationId)
    .limit(1);
  if (error) throw new Error(`mynews-console: verification status read failed: ${error.message}`);
  const row = (data ?? [])[0] as { status: VerificationStatus } | undefined;
  return row?.status ?? null;
}

async function callRpc(
  admin: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    console.error(`mynews-console: ${name} failed: ${error.message}`);
    return 'rpc-failed';
  }
  return data;
}

/**
 * Approve or deny a pending request. Approval stamps the expiry and sets the
 * tier in the same transaction; denial records the reason and leaves the tier
 * alone. Both require a reason.
 */
export function decideVerification(
  admin: SupabaseClient,
  input: {
    verificationId: string;
    moderatorRef: string;
    approve: boolean;
    reason: string;
    expiresAt: string | null;
  },
): Promise<unknown> {
  return callRpc(admin, 'nw_verification_decide', {
    p_verification_id: input.verificationId,
    p_reviewer_ref: input.moderatorRef,
    p_approve: input.approve,
    p_reason: input.reason,
    p_expires_at: input.expiresAt,
  });
}

/** Revoke a live approval. The tier drops in the same transaction. */
export function revokeVerification(
  admin: SupabaseClient,
  input: { verificationId: string; moderatorRef: string; reason: string },
): Promise<unknown> {
  return callRpc(admin, 'nw_verification_revoke', {
    p_verification_id: input.verificationId,
    p_reviewer_ref: input.moderatorRef,
    p_reason: input.reason,
  });
}

/**
 * Expire approvals past their expiry. Idempotent and batched; returns how many
 * rows expired. Exposed here so an operator can run it from the console instead
 * of waiting for the scheduled pass.
 */
export async function expireDueVerifications(
  admin: SupabaseClient,
  limit = 200,
): Promise<number> {
  const result = await callRpc(admin, 'nw_verification_expire_due', { p_limit: limit });
  return typeof result === 'number' ? result : 0;
}

/* ------------------------- endorsement ring flags ------------------------- */

export interface EndorsementEdgeRow {
  endorserId: string;
  beneficiaryId: string;
  createdAtMs: number;
  similarity: number;
}

/**
 * The endorsement graph as edges: an endorsement of a suggestion credits that
 * suggestion's editor, so the beneficiary is the editor, not the suggestion.
 * Newest first, bounded.
 */
export async function fetchEndorsementEdges(
  admin: SupabaseClient,
  limit = 2000,
): Promise<EndorsementEdgeRow[]> {
  const { data, error } = await admin
    .from('nw_suggestion_dupes')
    .select('endorser_id,similarity,created_at,nw_edit_suggestions!inner(editor_id)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`mynews-console: endorsement graph read failed: ${error.message}`);
  const rows = (data ?? []) as unknown as Array<{
    endorser_id: string;
    similarity: number | string;
    created_at: string;
    nw_edit_suggestions: { editor_id: string } | Array<{ editor_id: string }> | null;
  }>;
  return rows
    .map((row) => {
      const embedded = Array.isArray(row.nw_edit_suggestions)
        ? row.nw_edit_suggestions[0]
        : row.nw_edit_suggestions;
      if (!embedded) return null;
      return {
        endorserId: row.endorser_id,
        beneficiaryId: embedded.editor_id,
        createdAtMs: Date.parse(row.created_at),
        similarity: Number(row.similarity),
      };
    })
    .filter((edge): edge is EndorsementEdgeRow => edge !== null && Number.isFinite(edge.createdAtMs));
}

/** Persist one profile's ring suspicion so the edge cap check can read it. */
export function upsertRingFlag(
  admin: SupabaseClient,
  input: {
    profileId: string;
    suspicion: number;
    findings: unknown;
    detectorVersion: string;
    computedBy: string;
  },
): Promise<unknown> {
  return callRpc(admin, 'nw_ring_flags_upsert', {
    p_profile_id: input.profileId,
    p_suspicion: input.suspicion,
    p_findings: input.findings,
    p_detector_version: input.detectorVersion,
    p_computed_by: input.computedBy,
  });
}

export interface RingFlagRow {
  profileId: string;
  handle: string | null;
  suspicion: number;
  findings: unknown;
  detectorVersion: string;
  computedBy: string;
  computedAt: string;
}

/** Stored ring flags, most suspicious first. */
export async function fetchRingFlags(
  admin: SupabaseClient,
  limit = 50,
): Promise<RingFlagRow[]> {
  const { data, error } = await admin
    .from('nw_ring_flags')
    .select('profile_id,suspicion,findings,detector_version,computed_by,computed_at')
    .order('suspicion', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`mynews-console: ring flag read failed: ${error.message}`);
  const rows = (data ?? []) as unknown as Array<{
    profile_id: string;
    suspicion: number | string;
    findings: unknown;
    detector_version: string;
    computed_by: string;
    computed_at: string;
  }>;
  if (rows.length === 0) return [];
  const { data: profiles } = await admin
    .from('nw_profiles')
    .select('id,handle')
    .in('id', rows.map((row) => row.profile_id));
  const handleById = new Map(
    ((profiles ?? []) as Array<{ id: string; handle: string }>).map((row) => [row.id, row.handle]),
  );
  return rows.map((row) => ({
    profileId: row.profile_id,
    handle: handleById.get(row.profile_id) ?? null,
    suspicion: Number(row.suspicion),
    findings: row.findings,
    detectorVersion: row.detector_version,
    computedBy: row.computed_by,
    computedAt: row.computed_at,
  }));
}
