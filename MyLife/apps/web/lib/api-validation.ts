import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns the parsed data on success or a 400 NextResponse on failure.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Validation failed.', issues },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: result.data };
}

// -- Schemas for API routes --

export const EntitlementRevokeSchema = z.object({
  signature: z.string().trim().min(1, 'signature is required'),
  reason: z.string().optional(),
  sourceEventId: z.string().optional(),
});

export const ActorIssueSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
});

export const BundleIssueSchema = z.object({
  bundleId: z.string().min(1, 'bundleId is required'),
  eventId: z.string().min(1, 'eventId is required'),
  purchaserRef: z.string().optional(),
  expiresInSeconds: z.number().positive().optional(),
});

export const FriendDeleteSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  friendUserId: z.string().trim().min(1, 'friendUserId is required'),
  actorToken: z.string().optional(),
});

export const ShareEventCreateSchema = z.object({
  id: z.string().trim().optional(),
  actorUserId: z.string().trim().optional(),
  actorToken: z.string().optional(),
  objectType: z.enum(['book_rating', 'book_review', 'list_item', 'generic']),
  objectId: z.string().trim().min(1, 'objectId is required'),
  visibility: z.enum(['private', 'friends', 'public']),
  payload: z.unknown().optional(),
});
