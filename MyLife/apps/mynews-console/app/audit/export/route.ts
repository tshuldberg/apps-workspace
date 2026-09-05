import { NextResponse } from 'next/server';

import { verifyAuditExport } from '@/lib/audit-chain';
import { getModeratorSession } from '@/lib/auth';
import { exportAuditChain } from '@/lib/console-queries';
import { hasLevel } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Download the verifiable audit export (plan 48 WP9).
 *
 * A route handler rather than a server action because the deliverable is a FILE:
 * the whole point is that a recipient can verify it offline. It re-runs the
 * TypeScript chain verification and embeds the verdict in the document, so the
 * file is self-describing whether or not anyone reads the console screen.
 *
 * Admin-only, and it never redirects: a route handler that redirected to /login
 * would hand a curl caller an HTML page instead of an honest 401/403.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getModeratorSession();
  if (session.status !== 'ok') {
    return NextResponse.json(
      { error: session.status === 'needs-mfa' ? 'mfa-required' : 'not-authorized' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }
  if (!hasLevel(session.context.role, 'admin')) {
    return NextResponse.json(
      { error: 'insufficient-role' },
      { status: 403, headers: { 'cache-control': 'no-store' } },
    );
  }

  const url = new URL(request.url);
  const fromRaw = Number(url.searchParams.get('from') ?? '0');
  const fromSeq = Number.isFinite(fromRaw) && fromRaw > 0 ? Math.floor(fromRaw) : 0;

  const admin = createAdminClient();
  const doc = await exportAuditChain(admin, { fromSeq, limit: 5000 });
  if (!doc) {
    return NextResponse.json(
      { error: 'export-unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  const verdict = verifyAuditExport(doc);
  const body = JSON.stringify(
    {
      ...doc,
      typescriptVerification: verdict,
      exportedBy: session.context.email,
      verifier:
        'Recompute payloadHash = sha256(payloadText) and rowHash = sha256 over ' +
        'octet-length-prefixed [prevHash, seq, createdAtCanonical, actorRef, actorRole, action, ' +
        'targetKind, targetId, outcome, reason, payloadHash]; each row prevHash must equal the ' +
        'previous rowHash, starting from anchorPrevHash.',
    },
    null,
    2,
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="mynews-console-audit-from-${fromSeq}.json"`,
      'cache-control': 'no-store',
      'x-chain-verified': verdict.ok ? 'ok' : `broken:${verdict.reason}`,
    },
  });
}
