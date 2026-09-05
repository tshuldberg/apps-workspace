import { NextRequest, NextResponse } from 'next/server';
import { listFriendsForUser, removeFriendship } from '@mylife/db';
import { getAdapter } from '@/lib/db';
import { resolveActorIdentity } from '@/app/api/_shared/actor-identity';
import { parseBody, FriendDeleteSchema } from '@/lib/api-validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const identity = resolveActorIdentity({
    token: request.nextUrl.searchParams.get('actorToken')
      ?? request.headers.get('x-actor-identity-token')
      ?? undefined,
    userId: request.nextUrl.searchParams.get('userId')?.trim(),
    required: true,
  });
  if (!identity.ok || !identity.userId) {
    return NextResponse.json(
      { error: identity.error ?? 'user identity is required.' },
      { status: identity.status ?? 400 },
    );
  }
  const userId = identity.userId;

  const db = getAdapter();
  const friends = listFriendsForUser(db, userId);

  return NextResponse.json({
    userId,
    friends: friends.map((friend) => ({
      userId: friend.user_id,
      friendUserId: friend.friend_user_id,
      status: friend.status,
      sourceInviteId: friend.source_invite_id,
      createdAt: friend.created_at,
      updatedAt: friend.updated_at,
      displayName: friend.display_name,
      handle: friend.handle,
      avatarUrl: friend.avatar_url,
    })),
  });
}

export async function DELETE(request: NextRequest) {
  const parsed = await parseBody(request, FriendDeleteSchema);
  if (!parsed.ok) return parsed.response;

  const identity = resolveActorIdentity({
    token: parsed.data.actorToken ?? request.headers.get('x-actor-identity-token') ?? undefined,
    userId: parsed.data.userId,
    required: true,
  });
  if (!identity.ok || !identity.userId) {
    return NextResponse.json(
      { error: identity.error ?? 'user identity is required.' },
      { status: identity.status ?? 400 },
    );
  }

  const userId = identity.userId;
  const friendUserId = parsed.data.friendUserId;

  const db = getAdapter();
  removeFriendship(db, userId, friendUserId);

  return NextResponse.json({
    ok: true,
    userId,
    friendUserId,
  });
}
