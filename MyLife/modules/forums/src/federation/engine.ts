/**
 * Federation engine: ActivityPub transforms, queue processing, rate limiting.
 */

import {
  getRetryDelay,
  isDeadActivity,
  shouldRateLimit,
  buildActorUri,
  buildCommunityUri,
  parseWebFingerResource,
  buildWebFingerResponse,
  MAX_ACTIVITIES_PER_HOUR,
  type ActivityType,
} from '../models/federation';

// Re-export helpers
export {
  getRetryDelay,
  isDeadActivity,
  shouldRateLimit,
  buildActorUri,
  buildCommunityUri,
  parseWebFingerResource,
  buildWebFingerResponse,
  MAX_ACTIVITIES_PER_HOUR,
};

// ── ActivityPub Transforms ──────────────────────────────────────────

interface ThreadData {
  id: string;
  title: string;
  body: string;
  authorUri: string;
  communityUri: string;
  createdAt: string;
  updatedAt: string;
}

interface ReplyData {
  id: string;
  body: string;
  authorUri: string;
  threadUri: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transform a local thread into an ActivityPub Page object.
 */
export function threadToActivityPub(
  thread: ThreadData,
  domain: string,
): Record<string, unknown> {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Page',
    id: `https://${domain}/ap/thread/${thread.id}`,
    name: thread.title,
    content: thread.body,
    attributedTo: thread.authorUri,
    audience: thread.communityUri,
    published: thread.createdAt,
    updated: thread.updatedAt,
  };
}

/**
 * Transform a local reply into an ActivityPub Note object.
 */
export function replyToActivityPub(
  reply: ReplyData,
  domain: string,
): Record<string, unknown> {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Note',
    id: `https://${domain}/ap/reply/${reply.id}`,
    content: reply.body,
    attributedTo: reply.authorUri,
    inReplyTo: reply.threadUri,
    published: reply.createdAt,
    updated: reply.updatedAt,
  };
}

/**
 * Wrap an object in a Create activity.
 */
export function wrapInActivity(
  activityType: ActivityType,
  actorUri: string,
  object: Record<string, unknown>,
): Record<string, unknown> {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: activityType,
    actor: actorUri,
    object,
    published: new Date().toISOString(),
  };
}

// ── ActivityPub Inbound Parsing ─────────────────────────────────────

interface ParsedActivity {
  type: string;
  actorUri: string;
  objectType: string | null;
  objectId: string | null;
  content: string | null;
  inReplyTo: string | null;
}

export function parseIncomingActivity(activity: Record<string, unknown>): ParsedActivity | null {
  const type = activity.type as string;
  const actorUri = (activity.actor as string) ?? '';
  if (!type || !actorUri) return null;

  const obj = activity.object as Record<string, unknown> | string | undefined;
  let objectType: string | null = null;
  let objectId: string | null = null;
  let content: string | null = null;
  let inReplyTo: string | null = null;

  if (typeof obj === 'string') {
    objectId = obj;
  } else if (obj && typeof obj === 'object') {
    objectType = (obj.type as string) ?? null;
    objectId = (obj.id as string) ?? null;
    content = (obj.content as string) ?? (obj.name as string) ?? null;
    inReplyTo = (obj.inReplyTo as string) ?? null;
  }

  return { type, actorUri, objectType, objectId, content, inReplyTo };
}

// ── NodeInfo ────────────────────────────────────────────────────────

export function buildNodeInfoResponse(
  domain: string,
  userCount: number,
  communityCount: number,
  threadCount: number,
): Record<string, unknown> {
  return {
    version: '2.0',
    software: {
      name: 'myforums',
      version: '0.1.0',
    },
    protocols: ['activitypub'],
    usage: {
      users: { total: userCount },
      localPosts: threadCount,
      localCommunities: communityCount,
    },
    openRegistrations: true,
    metadata: {
      domain,
    },
  };
}

// ── HTTP Signature Helpers (stubs for v1) ───────────────────────────

export function buildSignatureHeader(
  keyId: string,
  headers: string[],
  signature: string,
): string {
  return `keyId="${keyId}",headers="${headers.join(' ')}",signature="${signature}"`;
}

export function parseSignatureHeader(
  header: string,
): { keyId: string; headers: string[]; signature: string } | null {
  const keyIdMatch = header.match(/keyId="([^"]+)"/);
  const headersMatch = header.match(/headers="([^"]+)"/);
  const sigMatch = header.match(/signature="([^"]+)"/);

  if (!keyIdMatch || !headersMatch || !sigMatch) return null;
  return {
    keyId: keyIdMatch[1],
    headers: headersMatch[1].split(' '),
    signature: sigMatch[1],
  };
}
