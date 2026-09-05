/**
 * Pure moderation helpers (unit-tested). The console's enforcement actions
 * call the SECURITY DEFINER RPCs from migration 20260705000007 through the
 * service-role client; these functions translate the RPC's scalar text result
 * into a machine code for the redirect, and format queue context for display.
 * No secrets, no I/O: this file is safe to unit test in isolation.
 */

export type ModerationRpcResult = 'ok' | 'not-found' | 'bad-moderator' | 'bad-status' | 'not-open';

/**
 * Map an RPC scalar result to (ok, machineCode). 'ok' clears; anything else is
 * a named failure the page renders through its error copy map. An unknown value
 * (should never happen) is treated as a failure, never a silent success.
 */
export function mapRpcResult(result: unknown): { ok: boolean; code: string } {
  if (result === 'ok') return { ok: true, code: 'done' };
  if (typeof result === 'string' && result.length > 0) {
    return { ok: false, code: result.replace(/-/g, '_') };
  }
  return { ok: false, code: 'rpc_failed' };
}

/**
 * Map the strike RPC scalar ('suspended' | 'struck' | 'not-found' |
 * 'bad-moderator' | 'rpc-failed'). Both 'suspended' and 'struck' are successful
 * strikes; the code distinguishes them for the redirect copy. Anything else is a
 * named failure, never a silent success.
 */
export function mapStrikeResult(result: unknown): { ok: boolean; code: string } {
  if (result === 'suspended') return { ok: true, code: 'suspended' };
  if (result === 'struck') return { ok: true, code: 'struck' };
  if (typeof result === 'string' && result.length > 0) {
    return { ok: false, code: result.replace(/-/g, '_') };
  }
  return { ok: false, code: 'rpc_failed' };
}

export type SuspensionPreset = '7d' | '30d' | '90d' | 'permanent';

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Far-future sentinel for a permanent suspension; a real ban lift sets null.
 *
 * Exported (plan 48 WP9) because the SQL side needs the same value:
 * nw_moderate_suspend_profile treats a null `until` as LIFTING the ban, so the
 * dual-control terminate path must write a real timestamp. Twin of
 * nw_console_permanent_until() in migration 20260730000010, pinned by
 * lib/__tests__/console-policy.test.ts.
 */
export const PERMANENT_SUSPENSION_ISO = '2999-12-31T23:59:59.000Z';
const PERMANENT_ISO = PERMANENT_SUSPENSION_ISO;

/** Resolve a suspension preset to an ISO `until`, given the current time. */
export function suspensionUntil(preset: SuspensionPreset, nowMs: number): string {
  switch (preset) {
    case '7d':
      return new Date(nowMs + 7 * DAY_MS).toISOString();
    case '30d':
      return new Date(nowMs + 30 * DAY_MS).toISOString();
    case '90d':
      return new Date(nowMs + 90 * DAY_MS).toISOString();
    case 'permanent':
      return PERMANENT_ISO;
  }
}

export function isSuspensionPreset(value: string): value is SuspensionPreset {
  return value === '7d' || value === '30d' || value === '90d' || value === 'permanent';
}

/** True when a stored suspended_until still bites at nowMs. */
export function isCurrentlySuspended(until: string | null, nowMs: number): boolean {
  if (!until) return false;
  const t = Date.parse(until);
  return !Number.isNaN(t) && t > nowMs;
}

/**
 * NCII SLA countdown for the case list. Returns a human label and whether the
 * 48h TAKE IT DOWN deadline is already breached (overdue). Pure: the page passes
 * Date.now().
 */
export function nciiDeadlineLabel(
  deadlineIso: string,
  nowMs: number,
): { label: string; overdue: boolean } {
  const t = Date.parse(deadlineIso);
  if (Number.isNaN(t)) return { label: 'unknown', overdue: false };
  const diffMs = t - nowMs;
  if (diffMs <= 0) {
    const overdueH = Math.floor(-diffMs / (60 * 60 * 1000));
    return { label: `overdue by ${overdueH}h`, overdue: true };
  }
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  return { label: `${hours}h ${mins}m left`, overdue: false };
}

/** Human label for an NCII case status. */
export function nciiStatusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: 'Queued (not yet removed)',
    removed: 'Removed (pending review)',
    escalated: 'Escalated (SLA breach)',
    cleared: 'Cleared',
  };
  return map[status] ?? status;
}

/**
 * Report SLA routing (plan 48 WP8). Twin of REPORT_SLA_HOURS in
 * modules/mynews/src/data/report.ts and the nw_report_sla seed in migration
 * 20260730000009, drift-pinned by lib/__tests__/moderation.test.ts. The console
 * badges read from here so an aging badge and the worker deadline agree.
 */
export const REPORT_SLA_HOURS: Record<string, number> = {
  'child-safety': 24,
  ncii: 48,
  threats: 24,
  violence: 24,
  'self-harm': 24,
  'doxxing-privacy': 48,
  hate: 72,
  harassment: 72,
  impersonation: 72,
  'fraud-scam': 72,
  copyright: 240,
  spam: 168,
  other: 168,
};

/** Reasons that open an urgent case with an immediate takedown. */
export const URGENT_REPORT_REASONS: readonly string[] = ['child-safety', 'ncii'];

/** Short human label for a report reason (queue display). */
export function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    'child-safety': 'Child safety (24h SLA)',
    ncii: 'NCII (48h SLA)',
    threats: 'Threats',
    violence: 'Violence',
    'self-harm': 'Suicide or self-harm',
    hate: 'Hate speech',
    harassment: 'Harassment',
    impersonation: 'Impersonation',
    'doxxing-privacy': 'Private information',
    'fraud-scam': 'Fraud or scam',
    copyright: 'Copyright',
    spam: 'Spam',
    other: 'Other',
  };
  return map[reason] ?? reason;
}

/**
 * Deadline badge for a report from its reason and creation time. Unknown reasons
 * fall back to the tightest routed deadline, matching nw_report_sla_hours: an
 * unrouted safety report must not sit longer than a routed one.
 */
export function reportSlaLabel(
  reason: string,
  createdAtIso: string,
  nowMs: number,
): { label: string; overdue: boolean; hours: number } {
  const hours = REPORT_SLA_HOURS[reason] ?? Math.min(...Object.values(REPORT_SLA_HOURS));
  const created = Date.parse(createdAtIso);
  if (Number.isNaN(created)) return { label: `${hours}h SLA`, overdue: false, hours };
  const deadline = created + hours * 60 * 60 * 1000;
  const { label, overdue } = nciiDeadlineLabel(new Date(deadline).toISOString(), nowMs);
  return { label: `${label} of ${hours}h`, overdue, hours };
}

/** Human label for an urgent case lane. */
export function caseClassLabel(caseClass: string): string {
  const map: Record<string, string> = {
    ncii: 'NCII / TAKE IT DOWN (48h)',
    'child-safety': 'Child safety (24h)',
  };
  return map[caseClass] ?? caseClass;
}
