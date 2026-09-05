import { NextRequest, NextResponse } from 'next/server';
import { declineFriendInvite, getFriendInvite } from '@mylife/db';
import { getAdapter } from '@/lib/db';
import { resolveActorIdentity } from '@/app/api/_shared/actor-identity';

export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toInviteResponse(invite: ReturnType<typeof getFriendInvite>) {
  if (!invite) return null;
  return {
    id: invite.id,
    fromUserId: invite.from_user_id,
    toUserId: invite.to_user_id,
    status: invite.status,
    message: invite.message,
    createdAt: invite.created_at,
    updatedAt: invite.updated_at,
    respondedAt: invite.responded_at,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ inviteId: string }> },
) {
  const { inviteId } = await context.params;
  if (!inviteId) {
    return NextResponse.json({ error: 'inviteId is required.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Body must be an object.' }, { status: 400 });
  }

  const identity = resolveActorIdentity({
    token: body.actorToken ?? request.headers.get('x-actor-identity-token') ?? undefined,
    userId: body.actorUserId,
    required: true,
  });
  if (!identity.ok || !identity.userId) {
    return NextResponse.json(
      { error: identity.error ?? 'Invalid actor identity.' },
      { status: identity.status ?? 400 },
    );
  }

  const actorUserId = identity.userId;
  const db = getAdapter();
  const declined = declineFriendInvite(db, inviteId, actorUserId);
  if (!declined) {
    return NextResponse.json({ error: 'Invite cannot be declined.' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    invite: toInviteResponse(getFriendInvite(db, inviteId)),
  });
}
