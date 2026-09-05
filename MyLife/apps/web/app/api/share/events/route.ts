import { NextRequest, NextResponse } from 'next/server';
import {
  createShareEvent,
  getShareEvent,
  listShareEventsVisibleToUser,
  type ShareEvent,
  type ShareObjectType,
  type ShareVisibility,
} from '@mylife/books';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { resolveActorIdentity } from '@/app/api/_shared/actor-identity';

export const runtime = 'nodejs';

const OBJECT_TYPES: ShareObjectType[] = ['book_rating', 'book_review', 'list_item', 'generic'];
const VISIBILITIES: ShareVisibility[] = ['private', 'friends', 'public'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isObjectType(value: string): value is ShareObjectType {
  return (OBJECT_TYPES as string[]).includes(value);
}

function isVisibility(value: string): value is ShareVisibility {
  return (VISIBILITIES as string[]).includes(value);
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function stringifyPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload ?? {});
  } catch {
    return '{}';
  }
}

function ensureBooksMigrations(): void {
  ensureModuleMigrations('books');
}

function parsePayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toShareEventResponse(item: ShareEvent | null) {
  if (!item) return null;
  return {
    id: item.id,
    actorUserId: item.actor_user_id,
    objectType: item.object_type,
    objectId: item.object_id,
    visibility: item.visibility,
    payload: parsePayload(item.payload_json),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const viewerIdentity = resolveActorIdentity({
    token: request.nextUrl.searchParams.get('viewerToken')
      ?? request.headers.get('x-actor-identity-token')
      ?? undefined,
    userId: request.nextUrl.searchParams.get('viewerUserId')?.trim(),
    required: true,
  });
  if (!viewerIdentity.ok || !viewerIdentity.userId) {
    return NextResponse.json(
      { error: viewerIdentity.error ?? 'viewer identity is required.' },
      { status: viewerIdentity.status ?? 400 },
    );
  }

  const actorUserId = request.nextUrl.searchParams.get('actorUserId')?.trim() || undefined;
  const objectTypeParam = request.nextUrl.searchParams.get('objectType')?.trim();
  const objectType = objectTypeParam && isObjectType(objectTypeParam)
    ? objectTypeParam
    : undefined;

  if (objectTypeParam && !objectType) {
    return NextResponse.json({ error: 'objectType is invalid.' }, { status: 400 });
  }

  const objectId = request.nextUrl.searchParams.get('objectId')?.trim() || undefined;
  const limit = parseOptionalNumber(request.nextUrl.searchParams.get('limit'));
  const offset = parseOptionalNumber(request.nextUrl.searchParams.get('offset'));

  ensureBooksMigrations();
  const db = getAdapter();

  const items = listShareEventsVisibleToUser(db, {
    viewer_user_id: viewerIdentity.userId,
    actor_user_id: actorUserId,
    object_type: objectType,
    object_id: objectId,
    limit,
    offset,
  });

  return NextResponse.json({ items: items.map((item) => toShareEventResponse(item)) });
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

  const actorIdentity = resolveActorIdentity({
    token: body.actorToken ?? request.headers.get('x-actor-identity-token') ?? undefined,
    userId: body.actorUserId,
    required: true,
  });
  if (!actorIdentity.ok || !actorIdentity.userId) {
    return NextResponse.json(
      { error: actorIdentity.error ?? 'actor identity is required.' },
      { status: actorIdentity.status ?? 400 },
    );
  }

  const actorUserId = actorIdentity.userId;
  const objectTypeValue = parseOptionalString(body.objectType);
  const objectId = parseOptionalString(body.objectId);
  const visibilityValue = parseOptionalString(body.visibility);

  if (!actorUserId || !objectTypeValue || !objectId || !visibilityValue) {
    return NextResponse.json(
      { error: 'actorUserId, objectType, objectId, and visibility are required.' },
      { status: 400 },
    );
  }

  if (!isObjectType(objectTypeValue)) {
    return NextResponse.json({ error: 'objectType is invalid.' }, { status: 400 });
  }

  if (!isVisibility(visibilityValue)) {
    return NextResponse.json({ error: 'visibility is invalid.' }, { status: 400 });
  }

  const id = parseOptionalString(body.id) ?? crypto.randomUUID();
  const payloadJson = stringifyPayload(body.payload);

  ensureBooksMigrations();
  const db = getAdapter();

  try {
    createShareEvent(db, id, {
      actor_user_id: actorUserId,
      object_type: objectTypeValue,
      object_id: objectId,
      visibility: visibilityValue,
      payload_json: payloadJson,
    });
  } catch (error) {
    console.error('Failed to create share event:', error);
    return NextResponse.json(
      { error: 'Failed to create share event.' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      item: toShareEventResponse(getShareEvent(db, id)),
    },
    { status: 201 },
  );
}
