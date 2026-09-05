import type { SupabaseClient } from '@supabase/supabase-js';

// Moderation decisions about YOUR content + the DSA Art. 20 appeal flow
// (plan 33 Phase 1.7). Reads ride RLS (own rows only); writes go through
// the bc_submit_appeal RPC which enforces ownership, dedup, and the
// durable appeal quota.

export interface MyAppeal {
  id: string;
  status: 'open' | 'upheld' | 'overturned';
  resolutionReason: string | null;
  createdAt: string;
}

export interface MyModerationDecision {
  id: string;
  kind: string;
  decision: 'approved' | 'rejected';
  reason: string | null;
  createdAt: string;
  appeal: MyAppeal | null;
}

export type SubmitAppealError =
  | 'rate_limited'
  | 'already_appealed'
  | 'decision_not_found'
  | 'invalid_body'
  | 'unknown';

export interface SubmitAppealResult {
  ok: boolean;
  error?: SubmitAppealError;
}

export async function listMyModerationDecisions(
  supabase: SupabaseClient,
  profileId: string,
): Promise<MyModerationDecision[]> {
  if (!profileId) return [];

  const [decisionsRes, appealsRes] = await Promise.all([
    supabase
      .from('bc_moderation_decisions')
      .select('id, kind, decision, reason, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('bc_appeals')
      .select('id, decision_id, status, resolution_reason, created_at')
      .eq('profile_id', profileId),
  ]);

  if (decisionsRes.error || !decisionsRes.data) return [];

  const appealsByDecision = new Map<string, MyAppeal>();
  for (const row of appealsRes.data ?? []) {
    const record = row as {
      id?: string;
      decision_id?: string;
      status?: string;
      resolution_reason?: string | null;
      created_at?: string;
    };
    if (!record.decision_id || !record.id) continue;
    appealsByDecision.set(record.decision_id, {
      id: record.id,
      status: (record.status ?? 'open') as MyAppeal['status'],
      resolutionReason: record.resolution_reason ?? null,
      createdAt: record.created_at ?? '',
    });
  }

  return decisionsRes.data.map((row) => {
    const record = row as {
      id: string;
      kind: string;
      decision: string;
      reason: string | null;
      created_at: string;
    };
    return {
      id: record.id,
      kind: record.kind,
      decision: record.decision === 'approved' ? 'approved' : 'rejected',
      reason: record.reason,
      createdAt: record.created_at,
      appeal: appealsByDecision.get(record.id) ?? null,
    };
  });
}

export async function submitAppeal(
  supabase: SupabaseClient,
  decisionId: string,
  body: string,
): Promise<SubmitAppealResult> {
  const { data, error } = await supabase.rpc('bc_submit_appeal', {
    p_decision_id: decisionId,
    p_body: body,
  });
  if (error) return { ok: false, error: 'unknown' };

  const row = Array.isArray(data) ? data[0] : data;
  const errorCode = (row as { error_code?: string | null } | null)?.error_code ?? null;
  if (!errorCode) return { ok: true };
  if (
    errorCode === 'rate_limited' ||
    errorCode === 'already_appealed' ||
    errorCode === 'decision_not_found' ||
    errorCode === 'invalid_body'
  ) {
    return { ok: false, error: errorCode };
  }
  return { ok: false, error: 'unknown' };
}
