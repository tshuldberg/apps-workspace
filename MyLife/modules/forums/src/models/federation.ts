import { z } from 'zod';

// ── Federated Instances ─────────────────────────────────────────────

export const FederatedInstanceSchema = z.object({
  id: z.string().uuid(),
  domain: z.string().min(1),
  displayName: z.string().nullable(),
  software: z.string().nullable(),
  softwareVersion: z.string().nullable(),
  description: z.string().nullable(),
  inboxUrl: z.string().url(),
  outboxUrl: z.string().url().nullable(),
  sharedInboxUrl: z.string().url().nullable(),
  publicKey: z.string(),
  isBlocked: z.boolean().default(false),
  isAllowlisted: z.boolean().default(false),
  lastSeenAt: z.string().datetime(),
  firstSeenAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type FederatedInstance = z.infer<typeof FederatedInstanceSchema>;

// ── Federated Actors ────────────────────────────────────────────────

export const FederatedActorSchema = z.object({
  id: z.string().uuid(),
  instanceId: z.string().uuid(),
  actorUri: z.string().url(),
  username: z.string(),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  inboxUrl: z.string().url(),
  outboxUrl: z.string().url().nullable(),
  publicKey: z.string(),
  lastFetchedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type FederatedActor = z.infer<typeof FederatedActorSchema>;

// ── ActivityPub Types ───────────────────────────────────────────────

export const ActivityTypeSchema = z.enum([
  'Create', 'Update', 'Delete', 'Like', 'Undo',
  'Follow', 'Accept', 'Reject', 'Announce',
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const FederationQueueStatusSchema = z.enum([
  'pending', 'processing', 'delivered', 'failed', 'dead',
]);
export type FederationQueueStatus = z.infer<typeof FederationQueueStatusSchema>;

export const FederationQueueItemSchema = z.object({
  id: z.string().uuid(),
  activityType: ActivityTypeSchema,
  actorUri: z.string(),
  objectJson: z.record(z.unknown()),
  targetInbox: z.string().url(),
  status: FederationQueueStatusSchema,
  attempts: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().default(5),
  lastAttemptAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type FederationQueueItem = z.infer<typeof FederationQueueItemSchema>;

// ── Federation Helpers ──────────────────────────────────────────────

export const RETRY_INTERVALS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];
export const MAX_ACTIVITIES_PER_HOUR = 100;

export function getRetryDelay(attempt: number): number {
  return RETRY_INTERVALS_MS[Math.min(attempt, RETRY_INTERVALS_MS.length - 1)];
}

export function isDeadActivity(attempts: number, maxAttempts: number): boolean {
  return attempts >= maxAttempts;
}

export function shouldRateLimit(
  activityCount: number,
  maxPerHour: number = MAX_ACTIVITIES_PER_HOUR,
): boolean {
  return activityCount >= maxPerHour;
}

export function buildActorUri(domain: string, username: string): string {
  return `https://${domain}/ap/user/${username}`;
}

export function buildCommunityUri(domain: string, communityName: string): string {
  return `https://${domain}/ap/community/${communityName}`;
}

export function parseWebFingerResource(resource: string): { username: string; domain: string } | null {
  const match = resource.match(/^acct:([^@]+)@(.+)$/);
  if (!match) return null;
  return { username: match[1], domain: match[2] };
}

export function buildWebFingerResponse(
  username: string,
  domain: string,
): Record<string, unknown> {
  const actorUri = buildActorUri(domain, username);
  return {
    subject: `acct:${username}@${domain}`,
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUri,
      },
    ],
  };
}
