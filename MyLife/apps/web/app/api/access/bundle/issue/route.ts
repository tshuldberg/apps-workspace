import { NextRequest, NextResponse } from 'next/server';
import { issueSignedBundleDownloadUrl } from '@/lib/access/bundle';
import { parseBody, BundleIssueSchema } from '@/lib/api-validation';
import { assertAdminKey } from '@/lib/admin-key';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = assertAdminKey({
    provided: request.headers.get('x-bundle-issuer-key'),
    expected: process.env.MYLIFE_BUNDLE_ISSUER_KEY,
    label: 'bundle issuer key',
  });
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, BundleIssueSchema);
  if (!parsed.ok) return parsed.response;

  const { bundleId, eventId, purchaserRef, expiresInSeconds } = parsed.data;

  const issued = issueSignedBundleDownloadUrl({
    bundleId,
    eventId,
    purchaserRef,
    requestBaseUrl: request.nextUrl.origin,
    expiresInSeconds,
  });

  if (!issued.ok) {
    return NextResponse.json({ error: 'Failed to issue bundle URL.', reason: issued.reason }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    downloadUrl: issued.url,
    expiresAt: issued.expiresAt,
    token: issued.token,
  });
}
