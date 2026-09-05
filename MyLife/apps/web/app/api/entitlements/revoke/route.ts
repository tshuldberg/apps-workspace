import { NextRequest, NextResponse } from 'next/server';
import { revokeHubEntitlement } from '@mylife/db';
import { getAdapter } from '@/lib/db';
import { clearStoredEntitlement, getStoredEntitlement } from '@/lib/entitlements';
import { parseBody, EntitlementRevokeSchema } from '@/lib/api-validation';
import { assertAdminKey } from '@/lib/admin-key';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = assertAdminKey({
    provided: request.headers.get('x-entitlement-revoke-key'),
    expected: process.env.MYLIFE_ENTITLEMENT_REVOKE_KEY ?? process.env.MYLIFE_ENTITLEMENT_ISSUER_KEY,
    label: 'entitlement revoke key',
  });
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, EntitlementRevokeSchema);
  if (!parsed.ok) return parsed.response;

  const { signature, reason, sourceEventId } = parsed.data;

  const db = getAdapter();
  revokeHubEntitlement(db, signature, reason, sourceEventId);

  const current = getStoredEntitlement();
  if (current?.signature === signature) {
    clearStoredEntitlement();
  }

  return NextResponse.json({
    ok: true,
    signature,
  });
}
