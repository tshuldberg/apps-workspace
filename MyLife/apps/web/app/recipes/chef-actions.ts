'use server';

import {
  getBestChefClient,
  getChefProfile,
  getChefProfileByHandle,
  searchChefs,
  getTopChefs,
  getChefSubmissions,
  getSignatureDishes,
  getCuisineBreakdown,
  type ChefProfileData,
  type SignatureDish,
  type ChefBadgeWithDef,
  type CuisineBreakdownEntry,
  type Submission,
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

// ── Serialization helpers ───────────────────────────────────────────

/** Strip non-serializable Date objects from ChefProfileData for RSC. */
function serializeProfile(p: ChefProfileData): Record<string, unknown> {
  return {
    profileId: p.profileId,
    handle: p.handle,
    displayName: p.displayName,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    followerCount: p.followerCount,
    followingCount: p.followingCount,
    totalSubmissions: p.totalSubmissions,
    totalVotesReceived: p.totalVotesReceived,
    dishesWon: p.dishesWon,
    avgScore: p.avgScore,
    topCuisine: p.topCuisine,
    activeSince: p.activeSince,
    signatureDishes: p.signatureDishes.map(serializeSignatureDish),
    badges: p.badges.map(serializeBadge),
  };
}

function serializeSignatureDish(d: SignatureDish): Record<string, unknown> {
  return {
    submissionId: d.submissionId,
    dishId: d.dishId,
    dishName: d.dishName,
    cuisine: d.cuisine,
    voteScore: d.voteScore,
    rank: d.rank,
    photoUrl: d.photoUrl,
  };
}

function serializeBadge(b: ChefBadgeWithDef): Record<string, unknown> {
  return {
    id: b.id,
    badgeId: b.badgeId,
    earnedAt: b.earnedAt.toISOString(),
    name: b.name,
    description: b.description,
    icon: b.icon,
    tier: b.tier,
  };
}

function serializeSubmission(s: Submission): Record<string, unknown> {
  return {
    id: s.id,
    dishId: s.dishId,
    recipeSnapshotId: s.recipeSnapshotId,
    profileId: s.profileId,
    photoUrl: s.photoUrl,
    photoVerified: s.photoVerified,
    chefLocation: s.chefLocation,
    chefOrigin: s.chefOrigin,
    countryCode: s.countryCode,
    voteScore: s.voteScore,
    rank: s.rank,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function serializeCuisine(c: CuisineBreakdownEntry): Record<string, unknown> {
  return {
    cuisine: c.cuisine,
    count: c.count,
    avgScore: c.avgScore,
  };
}

// ── Chef profile ────────────────────────────────────────────────────

export async function getChefProfileAction(
  profileId: string,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const result = await getChefProfile(profileId);
    if (!result.ok) return failure(result.error);
    return success(serializeProfile(result.data));
  } catch (e) {
    console.error('[chef-actions] getChefProfileAction failed:', e);
    return failure('Failed to load chef profile');
  }
}

// ── Chef profile by handle ──────────────────────────────────────────

export async function getChefProfileByHandleAction(
  handle: string,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const result = await getChefProfileByHandle(handle);
    if (!result.ok) return failure(result.error);
    return success(serializeProfile(result.data));
  } catch (e) {
    console.error('[chef-actions] getChefProfileByHandleAction failed:', e);
    return failure('Failed to load chef profile');
  }
}

// ── Search chefs ────────────────────────────────────────────────────

export async function searchChefsAction(
  query: string,
  options?: { cuisine?: string; limit?: number },
): Promise<ActionResult<Record<string, unknown>[]>> {
  try {
    const result = await searchChefs(query, options);
    if (!result.ok) return failure(result.error);
    return success(result.data.map(serializeProfile));
  } catch (e) {
    console.error('[chef-actions] searchChefsAction failed:', e);
    return failure('Failed to search chefs');
  }
}

// ── Top chefs ───────────────────────────────────────────────────────

export async function getTopChefsAction(
  options?: { cuisine?: string; limit?: number },
): Promise<ActionResult<Record<string, unknown>[]>> {
  try {
    const result = await getTopChefs(options);
    if (!result.ok) return failure(result.error);
    return success(result.data.map(serializeProfile));
  } catch (e) {
    console.error('[chef-actions] getTopChefsAction failed:', e);
    return failure('Failed to load top chefs');
  }
}

// ── Chef submissions ────────────────────────────────────────────────

export async function getChefSubmissionsAction(
  profileId: string,
  options?: { limit?: number; offset?: number },
): Promise<ActionResult<Record<string, unknown>[]>> {
  try {
    const result = await getChefSubmissions(profileId, options);
    if (!result.ok) return failure(result.error);
    return success(result.data.map(serializeSubmission));
  } catch (e) {
    console.error('[chef-actions] getChefSubmissionsAction failed:', e);
    return failure('Failed to load chef submissions');
  }
}

// ── Signature dishes ────────────────────────────────────────────────

export async function getSignatureDishesAction(
  profileId: string,
): Promise<ActionResult<Record<string, unknown>[]>> {
  try {
    const result = await getSignatureDishes(getBestChefClient(), { chefId: profileId });
    if (!result.ok) return failure(result.error);
    return success(result.data.map(serializeSignatureDish));
  } catch (e) {
    console.error('[chef-actions] getSignatureDishesAction failed:', e);
    return failure('Failed to load signature dishes');
  }
}

// ── Chef badges ─────────────────────────────────────────────────────

export async function getChefBadgesAction(
  profileId: string,
): Promise<ActionResult<Record<string, unknown>[]>> {
  try {
    const result = await getChefProfile(profileId);
    if (!result.ok) return failure(result.error);
    return success(result.data.badges.map(serializeBadge));
  } catch (e) {
    console.error('[chef-actions] getChefBadgesAction failed:', e);
    return failure('Failed to load chef badges');
  }
}

// ── Cuisine breakdown ───────────────────────────────────────────────

export async function getCuisineBreakdownAction(
  profileId: string,
): Promise<ActionResult<Record<string, unknown>[]>> {
  try {
    const result = await getCuisineBreakdown(profileId);
    if (!result.ok) return failure(result.error);
    return success(result.data.map(serializeCuisine));
  } catch (e) {
    console.error('[chef-actions] getCuisineBreakdownAction failed:', e);
    return failure('Failed to load cuisine breakdown');
  }
}
