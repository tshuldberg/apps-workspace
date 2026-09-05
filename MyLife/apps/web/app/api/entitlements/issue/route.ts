import { NextRequest, NextResponse } from 'next/server';
import {
  parseIssueEntitlementInput,
  issueSignedEntitlement,
} from '@/lib/billing/entitlement-issuer';
import { assertAdminKey } from '@/lib/admin-key';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const signingSecret = process.env.MYLIFE_ENTITLEMENT_SECRET;

  const auth = assertAdminKey({
    provided: request.headers.get('x-entitlement-issuer-key'),
    expected: process.env.MYLIFE_ENTITLEMENT_ISSUER_KEY,
    label: 'entitlement issuer key',
  });
  if (!auth.ok) return auth.response;

  if (!signingSecret) {
    return NextResponse.json(
      { error: 'Entitlement signing secret is not configured.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = parseIssueEntitlementInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const issued = await issueSignedEntitlement(parsed.data, signingSecret);

  return NextResponse.json({
    token: issued.token,
    entitlements: issued.entitlements,
  });
}
