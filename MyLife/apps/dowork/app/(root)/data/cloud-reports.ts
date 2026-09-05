// DoWork content reporting (App Review Guideline 1.2).
//
// Reports land in dw_reports (insert-own, read-own RLS); moderation
// decisions are service-role-only via dw_moderation_decisions. Triage
// happens in the Supabase dashboard at launch (24h SLA per the
// moderation runbook).

import type { SupabaseClient } from '@supabase/supabase-js';

const REPORTS_TABLE = 'dw_reports';

export type ReportTargetKind =
  | 'share'
  | 'comment'
  | 'trainer_video'
  | 'profile'
  | 'form_check'
  | 'form_feedback';

export const REPORT_REASONS = [
  'Spam or scam',
  'Inappropriate content',
  'Harassment',
  'Dangerous form advice',
  'Other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export type CloudReportsResult<T> = ({ ok: true } & T) | { ok: false; error: string };

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

export async function submitReport(
  supabase: SupabaseClient,
  params: {
    reporterUserId: string;
    targetKind: ReportTargetKind;
    targetId: string;
    reason: string;
    notes?: string;
  },
): Promise<CloudReportsResult<object>> {
  if (!params.reporterUserId) return { ok: false, error: 'Sign in to report content.' };
  if (!params.targetId) return { ok: false, error: 'Report target is required.' };
  if (!params.reason.trim()) return { ok: false, error: 'Pick a report reason.' };

  try {
    const result = await supabase.from(REPORTS_TABLE).insert({
      reporter_user_id: params.reporterUserId,
      target_kind: params.targetKind,
      target_id: params.targetId,
      reason: params.reason.trim(),
      notes: params.notes?.trim() || null,
    });
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}
