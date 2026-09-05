// Public-tier report client (Plan 39 P10/P11, screen S12). WEB twin of
// apps/meerkat/app/(root)/data/public-report.ts. Files a signed abuse report on a public post
// or reply to the FIRST-PARTY operator intake (the Commons node's open /report route), which the
// operator console (Track D) triages. The report is signed by the reporter's PUBLIC PERSONA key, never
// the device key (NC-P2): filing a report never leaks the device identity into a public-tier request.
//
// HONESTY: no configured persona service / commons feed => 'not_configured' and the sheet stays off. A
// report is "sent" only when the node's intake returns ok; every failure is an honest reason. The author
// is never told who reported (the report goes to the operator, not the author).

import type { DatabaseAdapter } from '@mylife/db';
import {
  createPublicAbuseReportWithKey,
  extractPersonaPrivateKeyHex,
  type PublicReportReason,
  type PublicReportTargetKind,
  type SignedPublicAbuseReport,
} from '@mylife/sync';
import type { CommonsFeedConfig } from './public-feed';
import { isCommonsFeedConfigured } from './public-feed';
import { getStoredPersona } from './persona-core';

/** The S12 report categories, in mockup order, mapped to the fixed §9 taxonomy. */
export interface PublicReportCategory {
  id: PublicReportReason;
  label: string;
  /** Sub-label for the CSAM lane (fast-tracked to the NCMEC pipeline). */
  hint?: string;
}

export const PUBLIC_REPORT_CATEGORIES: readonly PublicReportCategory[] = [
  { id: 'spam', label: 'Spam or scam' },
  { id: 'harassment', label: 'Harassment or hate' },
  { id: 'violence', label: 'Violence or dangerous acts' },
  { id: 'csam', label: 'Sexual content involving minors', hint: 'Fast-tracked, reported to authorities where required' },
  { id: 'illegal', label: 'Copyright (DMCA)' },
];

/** Verbatim S12 copy, parity-locked against the mobile twin. */
export const REPORT_SHEET_TITLE = 'Report this post';
export const REPORT_SHEET_SUBTITLE = "Goes to Meerkat trust & safety. The author isn't told who reported.";
export const REPORT_SHEET_SUBMIT = 'Submit report';

export type SubmitReportReason =
  | 'not_configured'
  | 'no_persona'
  | 'topic_not_wired'
  | 'key_unavailable'
  | 'unreachable'
  | 'rejected';

export type SubmitReportResult = { ok: true } | { ok: false; reason: SubmitReportReason };

export interface SubmitPublicReportInput {
  /** The Commons channel the reported post lives in (locates the publication + node). */
  channelId: string;
  targetKind: PublicReportTargetKind;
  /** The reported post/reply id. */
  targetId: string;
  reason: PublicReportReason;
}

export interface SubmitPublicReportDeps {
  db: DatabaseAdapter;
  feedConfig: CommonsFeedConfig;
  fetchImpl?: typeof fetch;
}

/**
 * Sign and submit a public report. Persona-signed (NC-P2). Returns ok only when the node's intake
 * accepts it; honest reason otherwise. Fail-closed everywhere.
 */
export async function submitPublicReport(
  deps: SubmitPublicReportDeps,
  input: SubmitPublicReportInput,
): Promise<SubmitReportResult> {
  const { db, feedConfig } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;
  if (!isCommonsFeedConfigured(feedConfig)) return { ok: false, reason: 'not_configured' };
  const persona = getStoredPersona(db);
  if (!persona) return { ok: false, reason: 'no_persona' };
  const source = feedConfig.topics.find((t) => t.channelId === input.channelId);
  if (!source) return { ok: false, reason: 'topic_not_wired' };

  let signed: SignedPublicAbuseReport;
  try {
    const privateKeyHex = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
    signed = createPublicAbuseReportWithKey(
      { publicKeyHex: persona.personaPubkey, privateKeyHex },
      { publicationId: source.publicationId, targetKind: input.targetKind, targetId: input.targetId, reason: input.reason },
    );
  } catch {
    return { ok: false, reason: 'key_unavailable' };
  }

  const base = feedConfig.nodeUrl.replace(/\/$/, '');
  const url = `${base}/public/${encodeURIComponent(source.publicationId)}/report`;
  let status: number;
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signed),
    });
    status = res.status;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (status === 200) return { ok: true };
  return { ok: false, reason: 'rejected' };
}
