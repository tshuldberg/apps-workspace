/**
 * Report taxonomy: severity rank, SLA routing, urgent lane, and display copy
 * (plan 48 WP8).
 *
 * This lives outside `data/` on purpose. The numbers here are the same numbers
 * the SQL seed, the edge mirror, and the moderator console carry, so every
 * surface has to be able to import them. `data/report.ts` pulls the cloud port
 * and the submission orchestrator, which a Server Component or the console
 * cannot import; this module is type-only at the boundary and therefore safe
 * from the RSC-safe `@mylife/mynews/engines` subpath.
 *
 * Twins that must change together:
 *   supabase/migrations/20260730000009_mynews_screening_taxonomy.sql
 *     (nw_report_severity_rank, nw_report_sla seed)
 *   supabase/functions/_shared/mynews-store.ts
 *     (REPORT_SEVERITY_RANK, EDGE_REPORT_SLA_HOURS, EDGE_REPORT_URGENT_REASONS)
 *   apps/mynews-console/lib/moderation.ts (REPORT_SLA_HOURS)
 * Drift pins: modules/mynews/src/data/report.test.ts,
 * modules/mynews/src/data/screening-taxonomy-migration.test.ts,
 * apps/mynews-console/lib/__tests__/screening-sla.test.ts.
 */

import type { ReportReason } from './models';

/**
 * Canonical severity rank. Higher outranks lower; a report may be escalated in
 * place to a strictly higher reason, which is what makes intake idempotent
 * without losing a more serious later claim.
 *
 * WP1's seven ranks are unchanged. The six WP8 reasons enter at the tier the
 * plan dictates: child-safety at the NCII tier (it shares the urgent case lane),
 * threats with violence, self-harm just below, hate and doxxing with the
 * harassment tier, and fraud with copyright.
 */
export const REPORT_SEVERITY_RANK = {
  'child-safety': 100,
  ncii: 100,
  threats: 80,
  violence: 80,
  'self-harm': 70,
  hate: 60,
  harassment: 60,
  impersonation: 60,
  'doxxing-privacy': 60,
  copyright: 40,
  'fraud-scam': 40,
  spam: 20,
  other: 20,
} as const satisfies Readonly<Record<ReportReason, number>>;

/**
 * SLA routing: hours from report to required disposition, per reason. The urgent
 * lane derives its case deadline from these numbers and the console renders
 * aging badges from them, so a change here is a change to the operational
 * commitment, not a display tweak.
 */
export const REPORT_SLA_HOURS = {
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
} as const satisfies Readonly<Record<ReportReason, number>>;

/**
 * Reasons that open an urgent case with its own clock, an immediate takedown,
 * and a dedicated console queue. NCII carries the TAKE IT DOWN Act 48 hour duty;
 * child-safety shares the lane at 24 hours.
 */
export const REPORT_URGENT_REASONS = ['child-safety', 'ncii'] as const satisfies
  readonly ReportReason[];

export type UrgentReportReason = (typeof REPORT_URGENT_REASONS)[number];

export function isUrgentReportReason(reason: ReportReason): reason is UrgentReportReason {
  return (REPORT_URGENT_REASONS as readonly string[]).includes(reason);
}

/** Deadline for a report, from its reason and creation time. */
export function reportDeadlineAtMs(reason: ReportReason, createdAtMs: number): number {
  return createdAtMs + REPORT_SLA_HOURS[reason] * 3_600_000;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  'child-safety': 'Child safety',
  ncii: 'Non-consensual intimate imagery',
  threats: 'Threats of violence',
  violence: 'Violent content',
  'self-harm': 'Suicide or self-harm',
  hate: 'Hate speech',
  harassment: 'Harassment or bullying',
  impersonation: 'Impersonation',
  'doxxing-privacy': 'Private information or doxxing',
  'fraud-scam': 'Fraud or scam',
  copyright: 'Copyright infringement',
  spam: 'Spam',
  other: 'Something else',
};

/**
 * One-line help under each reason in the report sheets. Reporters pick better
 * reasons when the list explains what each one is for, and reason accuracy is
 * what makes the severity rank and the SLA routing worth anything.
 */
export const REPORT_REASON_HINTS: Record<ReportReason, string> = {
  'child-safety': 'Sexualizes a minor, or targets or endangers a child.',
  ncii: 'Intimate images shared without the consent of the person shown.',
  threats: 'Threatens to harm a specific person or group.',
  violence: 'Glorifies or incites violence, or shows graphic harm.',
  'self-harm': 'Encourages suicide or self-injury, or describes methods.',
  hate: 'Attacks or dehumanizes people over who they are.',
  harassment: 'Targets someone with repeated or degrading abuse.',
  impersonation: 'Pretends to be another person, outlet, or organization.',
  'doxxing-privacy': 'Publishes private details such as an address or phone number.',
  'fraud-scam': 'Tries to take money, credentials, or crypto keys.',
  copyright: 'Uses copyrighted work without permission.',
  spam: 'Bulk, repetitive, or promotional content.',
  other: 'Something else that breaks the rules.',
};
