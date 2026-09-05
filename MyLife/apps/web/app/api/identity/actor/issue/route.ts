import { NextRequest, NextResponse } from 'next/server';
import { issueActorIdentityToken } from '@/lib/actor-identity';
import { parseBody, ActorIssueSchema } from '@/lib/api-validation';
import { assertAdminKey } from '@/lib/admin-key';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = assertAdminKey({
    provided: request.headers.get('x-actor-issuer-key'),
    expected: process.env.MYLIFE_ACTOR_ISSUER_KEY,
    label: 'actor issuer key',
  });
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, ActorIssueSchema);
  if (!parsed.ok) return parsed.response;

  const { userId } = parsed.data;

  const token = issueActorIdentityToken(userId);
  if (!token) {
    return NextResponse.json(
      { error: 'Actor identity secret is not configured.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    userId,
    actorToken: token,
    issuedAt: new Date().toISOString(),
  });
}
