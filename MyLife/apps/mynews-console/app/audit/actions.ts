'use server';

import { redirect } from 'next/navigation';

import { requireLevel, requireModerator } from '@/lib/auth';
import { verifyAuditExport } from '@/lib/audit-chain';
import { exportAuditChain } from '@/lib/console-queries';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Immutable audit export (plan 48 WP9).
 *
 * The export is verified TWICE before it is handed over: once in SQL
 * (nw_console_audit_verify, inside the export RPC) and once here in TypeScript
 * from the exported bytes alone. The second check is the one that matters, because
 * it does not trust the database that produced the document: it recomputes every
 * payload hash from the exported payload text and every row hash from the
 * octet-length-prefixed fields, and follows prev_hash from the anchor forward.
 *
 * The verdict travels INSIDE the file. A tampered export cannot be laundered by
 * dropping the verification, because a recipient runs the same check.
 */
export async function exportAudit(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  if (!requireLevel(moderator, 'admin')) redirect('/audit?error=insufficient_role');

  const fromRaw = Number(String(formData.get('fromSeq') ?? '0'));
  const fromSeq = Number.isFinite(fromRaw) && fromRaw > 0 ? Math.floor(fromRaw) : 0;

  const admin = createAdminClient();
  const doc = await exportAuditChain(admin, { fromSeq, limit: 5000 });
  if (!doc) redirect('/audit?error=rpc_failed');

  const verdict = verifyAuditExport(doc);
  const params = new URLSearchParams({
    exported: String(doc.rows.length),
    from: String(fromSeq),
    verified: verdict.ok ? 'ok' : 'broken',
  });
  if (!verdict.ok) {
    params.set('reason', verdict.reason);
    if (verdict.badSeq !== null) params.set('badSeq', String(verdict.badSeq));
  }
  // The document itself is fetched by the download route, which re-runs the same
  // verification; this redirect reports the verdict so a broken chain is loud in
  // the UI rather than only inside a downloaded file.
  redirect(`/audit?${params.toString()}`);
}
