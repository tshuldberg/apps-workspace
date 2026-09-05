import { NextRequest, NextResponse } from 'next/server';
import {
  createFriendInvite,
  getFriendInvite,
  listIncomingFriendInvites,
  listOutgoingFriendInvites,
  upsertFriendProfile,
  type FriendInvite,
  type FriendInviteStatus,
} from '@mylife/db';
import { getAdapter } from '@/lib/db';
import { resolveActorIdentity } from '@/app/api/_shared/actor-identity';

export const runtime = 'nodejs';

const INVITE_STATUSES: FriendInviteStatus[] = ['pending', 'accepted', 'revoked', 'declined'];

function isInviteStatus(value: string): value is FriendInviteStatus {
  return (INVITE_STATUSES as string[]).includes(value);
}

function parseStatuses(value: string | null): FriendInviteStatus[] {
  if (!value) return ['pending'];

  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is FriendInviteStatus => isInviteStatus(item));

  return parsed.length > 0 ? parsed : ['pending'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseProfileCandidate(value: unknown): {
  userId: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
} | null {
  if (!isRecord(value)) return null;

  const userId = parseOptionalString(value.userId);
  const displayName = parseOptionalString(value.displayName);
  if (!userId || !displayName) return null;

  if (displayName.length > 100) return null;

  const handle = parseOptionalString(value.handle);
  if (handle && handle.length > 50) return null;

  const avatarUrl = parseOptionalString(value.avatarUrl);
  if (avatarUrl) {
    if (avatarUrl.length > 2048 || !isValidUrl(avatarUrl)) return null;
  }

  return {
    userId,
    displayName,
    handle,
    avatarUrl,
  };
}

function toInviteResponse(invite: FriendInvite | null | undefined) {
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

  const direction = request.nextUrl.searchParams.get('direction') ?? 'both';
  const statuses = parseStatuses(request.nextUrl.searchParams.get('status'));

  const db = getAdapter();

  const incoming = direction === 'incoming' || direction === 'both'
    ? listIncomingFriendInvites(db, userId, statuses)
    : [];

  const outgoing = direction === 'outgoing' || direction === 'both'
    ? listOutgoingFriendInvites(db, userId, statuses)
    : [];

  return NextResponse.json({
    userId,
    incoming: incoming.map((invite) => toInviteResponse(invite)),
    outgoing: outgoing.map((invite) => toInviteResponse(invite)),
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Body must be an object.' }, { status: 400 });
  }

  const fromIdentity = resolveActorIdentity({
    token: body.actorToken ?? request.headers.get('x-actor-identity-token') ?? undefined,
    userId: body.fromUserId,
    required: true,
  });
  if (!fromIdentity.ok || !fromIdentity.userId) {
    return NextResponse.json(
      { error: fromIdentity.error ?? 'from user identity is required.' },
      { status: fromIdentity.status ?? 400 },
    );
  }

  const fromUserId = fromIdentity.userId;
  const toUserId = parseOptionalString(body.toUserId);

  if (!fromUserId || !toUserId) {
    return NextResponse.json({ error: 'fromUserId and toUserId are required.' }, { status: 400 });
  }

  if (fromUserId === toUserId) {
    return NextResponse.json({ error: 'Cannot invite yourself.' }, { status: 400 });
  }

  const inviteId = parseOptionalString(body.id) ?? crypto.randomUUID();
  const message = parseOptionalString(body.message);
  const fromProfile = parseProfileCandidate(body.fromProfile);
  const toProfile = parseProfileCandidate(body.toProfile);

  if (body.fromProfile != null && !fromProfile) {
    return NextResponse.json(
      { error: 'Invalid fromProfile. Check field lengths and URL format.' },
      { status: 400 },
    );
  }
  if (body.toProfile != null && !toProfile) {
    return NextResponse.json(
      { error: 'Invalid toProfile. Check field lengths and URL format.' },
      { status: 400 },
    );
  }

  const db = getAdapter();

  if (fromProfile) {
    upsertFriendProfile(db, {
      user_id: fromProfile.userId,
      display_name: fromProfile.displayName,
      handle: fromProfile.handle,
      avatar_url: fromProfile.avatarUrl,
    });
  }

  if (toProfile) {
    upsertFriendProfile(db, {
      user_id: toProfile.userId,
      display_name: toProfile.displayName,
      handle: toProfile.handle,
      avatar_url: toProfile.avatarUrl,
    });
  }

  try {
    createFriendInvite(db, {
      id: inviteId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      message,
    });
  } catch (error) {
    console.error('Failed to create friend invite:', error);
    return NextResponse.json(
      { error: 'Failed to create invite.' },
      { status: 400 },
    );
  }

  const invite = getFriendInvite(db, inviteId);

  return NextResponse.json({
    ok: true,
    invite: toInviteResponse(invite),
  }, { status: 201 });
}
