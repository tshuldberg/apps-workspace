'use server';

import {
  sendTip,
  getSubscriptionTiers,
  subscribe,
  isSubscribed,
  getPostsByAuthor,
  getChefStats,
  applyForCreator,
  getApplication,
  type SubscriptionTier,
  type Post,
  type CreatorApplication,
  type ChefStats,
  type PaymentsUnavailableResult,
} from '@mylife/bestchef';

// ── Result wrapper ──────────────────────────────────────────────────

interface ActionResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

function success<T>(data: T): ActionResult<T> {
  return { ok: true, data, error: null };
}

function failure<T>(error: string): ActionResult<T> {
  return { ok: false, data: null, error };
}

interface PaymentActionFailure {
  ok: false;
  data: null;
  error: string;
  status: 'error';
  reason: null;
}

interface PaymentUnavailableActionResult {
  ok: false;
  data: null;
  error: string;
  status: PaymentsUnavailableResult['status'];
  reason: PaymentsUnavailableResult['reason'];
}

type PaymentActionResult = PaymentActionFailure | PaymentUnavailableActionResult;

function paymentFailure(error: string): PaymentActionFailure {
  return { ok: false, data: null, error, status: 'error', reason: null };
}

function paymentUnavailable(
  result: PaymentsUnavailableResult,
  error: string,
): PaymentUnavailableActionResult {
  return {
    ok: false,
    data: null,
    error,
    status: result.status,
    reason: result.reason,
  };
}

// ── Serialization helpers ───────────────────────────────────────────

function serializeTier(t: SubscriptionTier): Record<string, unknown> {
  return {
    id: t.id,
    chefId: t.chefId,
    name: t.name,
    description: t.description,
    priceCents: t.priceCents,
    benefits: t.benefits,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt.toISOString(),
  };
}

function serializePost(p: Post): Record<string, unknown> {
  return {
    id: p.id,
    authorId: p.authorId,
    title: p.title,
    body: p.body,
    postType: p.postType,
    visibility: p.visibility,
    requiredTierId: p.requiredTierId,
    coverImageUrl: p.coverImageUrl,
    linkedSubmissionId: p.linkedSubmissionId,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function serializeApplication(a: CreatorApplication): Record<string, unknown> {
  return {
    id: a.id,
    profileId: a.profileId,
    platformLinks: a.platformLinks,
    bio: a.bio,
    specialties: a.specialties,
    status: a.status,
    reviewedAt: a.reviewedAt?.toISOString() ?? null,
    reviewerNote: a.reviewerNote,
    createdAt: a.createdAt.toISOString(),
  };
}

// ── Tip actions ─────────────────────────────────────────────────────

export async function sendTipAction(
  tipperId: string,
  chefId: string,
  amountCents: number,
  options?: { submissionId?: string; currency?: string },
): Promise<PaymentActionResult> {
  try {
    const result = await sendTip(tipperId, chefId, amountCents, options);
    if (result.status === 'unavailable') {
      return paymentUnavailable(result, 'Tipping is not available at launch');
    }
    return paymentFailure('Tipping is unavailable');
  } catch (e) {
    console.error('[creator-actions] sendTipAction failed:', e);
    return paymentFailure('Unable to confirm tipping availability');
  }
}

// ── Subscription actions ────────────────────────────────────────────

export async function getSubscriptionTiersAction(
  chefId: string,
): Promise<ActionResult<Record<string, unknown>[]>> {
  try {
    const result = await getSubscriptionTiers(chefId);
    if (!result.ok) return failure(result.error);
    return success(result.data.map(serializeTier));
  } catch (e) {
    console.error('[creator-actions] getSubscriptionTiersAction failed:', e);
    return failure('Failed to load subscription tiers');
  }
}

export async function subscribeAction(
  subscriberId: string,
  chefId: string,
  tierId: string,
): Promise<PaymentActionResult> {
  try {
    const result = await subscribe(subscriberId, chefId, tierId);
    if (result.status === 'unavailable') {
      return paymentUnavailable(
        result,
        'Paid chef subscriptions are not available at launch',
      );
    }
    return paymentFailure('Paid chef subscriptions are unavailable');
  } catch (e) {
    console.error('[creator-actions] subscribeAction failed:', e);
    return paymentFailure('Unable to confirm subscription availability');
  }
}

export async function isSubscribedAction(
  subscriberId: string,
  chefId: string,
): Promise<ActionResult<boolean>> {
  try {
    const result = await isSubscribed(subscriberId, chefId);
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (e) {
    console.error('[creator-actions] isSubscribedAction failed:', e);
    return failure('Failed to check subscription status');
  }
}

// ── Post actions ────────────────────────────────────────────────────

export async function getPostsByAuthorAction(
  authorId: string,
  options?: { postType?: string; limit?: number; offset?: number },
): Promise<ActionResult<Record<string, unknown>[]>> {
  try {
    const result = await getPostsByAuthor(authorId, {
      postType: options?.postType as Post['postType'] | undefined,
      limit: options?.limit,
      offset: options?.offset,
    });
    if (!result.ok) return failure(result.error);
    return success(result.data.map(serializePost));
  } catch (e) {
    console.error('[creator-actions] getPostsByAuthorAction failed:', e);
    return failure('Failed to load posts');
  }
}

// ── Creator analytics actions ───────────────────────────────────────

export async function getCreatorAnalyticsAction(
  profileId: string,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const statsResult = await getChefStats(profileId);

    const stats: ChefStats = statsResult.ok
      ? statsResult.data
      : { totalSubmissions: 0, totalVotesReceived: 0, dishesWon: 0, avgScore: 0, topCuisine: null, activeSince: '' };

    return success({
      totalSubmissions: stats.totalSubmissions,
      totalVotesReceived: stats.totalVotesReceived,
      dishesWon: stats.dishesWon,
      avgScore: stats.avgScore,
      topCuisine: stats.topCuisine,
      activeSince: stats.activeSince,
    });
  } catch (e) {
    console.error('[creator-actions] getCreatorAnalyticsAction failed:', e);
    return failure('Failed to load creator analytics');
  }
}

// ── Creator application actions ─────────────────────────────────────

export async function applyForCreatorAction(
  profileId: string,
  platformLinks: unknown,
  bio: string,
  specialties: string[],
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const result = await applyForCreator(profileId, platformLinks, bio, specialties);
    if (!result.ok) return failure(result.error);
    return success(serializeApplication(result.data));
  } catch (e) {
    console.error('[creator-actions] applyForCreatorAction failed:', e);
    return failure('Failed to submit application');
  }
}

export async function getApplicationAction(
  profileId: string,
): Promise<ActionResult<Record<string, unknown> | null>> {
  try {
    const result = await getApplication(profileId);
    if (!result.ok) return failure(result.error);
    if (!result.data) return success(null);
    return success(serializeApplication(result.data));
  } catch (e) {
    console.error('[creator-actions] getApplicationAction failed:', e);
    return failure('Failed to load application');
  }
}
