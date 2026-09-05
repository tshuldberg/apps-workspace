'use server';

import {
  searchDishes,
  getDishBySlug,
  getSubmissionsForDish,
  castVote,
  getDishCategories,
  getCuisines,
  type CloudDish,
  type Submission,
  type DishCategory,
  type VoteTier,
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

// ── Dish search ─────────────────────────────────────────────────────

export async function searchDishesAction(
  query: string,
  filters?: { category?: string; cuisine?: string },
): Promise<ActionResult<CloudDish[]>> {
  try {
    const result = await searchDishes(query, {
      category: filters?.category as DishCategory | undefined,
      cuisine: filters?.cuisine,
      status: 'active',
    });
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (err) {
    console.error('[cloud-actions] searchDishesAction failed:', err);
    return failure('Failed to search dishes');
  }
}

// ── Dish detail ─────────────────────────────────────────────────────

export async function getDishBySlugAction(
  slug: string,
): Promise<ActionResult<CloudDish>> {
  try {
    const result = await getDishBySlug(slug);
    if (!result.ok) return failure(result.error);
    return success(result.data.dish);
  } catch (err) {
    console.error('[cloud-actions] getDishBySlugAction failed:', err);
    return failure('Failed to load dish');
  }
}

// ── Submissions for a dish ──────────────────────────────────────────

export async function getSubmissionsForDishAction(
  dishId: string,
  options?: { limit?: number; offset?: number },
): Promise<ActionResult<Submission[]>> {
  try {
    const result = await getSubmissionsForDish(dishId, {
      limit: options?.limit,
      offset: options?.offset,
      sortBy: 'vote_score',
    });
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (err) {
    console.error('[cloud-actions] getSubmissionsForDishAction failed:', err);
    return failure('Failed to load submissions');
  }
}

// ── Cast vote ───────────────────────────────────────────────────────

/** Legacy numeric widget tiers (0-3) in canonical VoteTier order. */
const NUMERIC_VOTE_TIERS: readonly VoteTier[] = ['like', 'bronze', 'silver', 'gold'];

export async function castVoteAction(
  submissionId: string,
  voterProfileId: string,
  tier: number,
): Promise<ActionResult<{ submissionId: string; tier: number }>> {
  try {
    const voteTier = NUMERIC_VOTE_TIERS[tier];
    if (!voteTier) return failure('Invalid vote tier');
    const result = await castVote(submissionId, voterProfileId, voteTier);
    if (!result.ok) return failure(result.error);
    return success({ submissionId, tier });
  } catch (err) {
    console.error('[cloud-actions] castVoteAction failed:', err);
    return failure('Failed to cast vote');
  }
}

// ── Global rankings (top submissions for a dish) ────────────────────

export async function getGlobalRankingsAction(
  dishId: string,
  options?: { limit?: number },
): Promise<ActionResult<Submission[]>> {
  try {
    const result = await getSubmissionsForDish(dishId, {
      limit: options?.limit ?? 25,
      sortBy: 'vote_score',
    });
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (err) {
    console.error('[cloud-actions] getGlobalRankingsAction failed:', err);
    return failure('Failed to load rankings');
  }
}

// ── Top dishes (most submissions, optionally filtered) ──────────────

export async function getTopDishesAction(
  options?: { category?: string; cuisine?: string; limit?: number },
): Promise<ActionResult<CloudDish[]>> {
  try {
    const result = await searchDishes('', {
      category: options?.category as DishCategory | undefined,
      cuisine: options?.cuisine,
      status: 'active',
      limit: options?.limit ?? 20,
    });
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (err) {
    console.error('[cloud-actions] getTopDishesAction failed:', err);
    return failure('Failed to load top dishes');
  }
}

// ── Trending dishes (recently updated, most recent submissions) ─────

export async function getTrendingDishesAction(
  options?: { days?: number; limit?: number },
): Promise<ActionResult<CloudDish[]>> {
  try {
    // Trending = recently active dishes sorted by submission_count desc
    const result = await searchDishes('', {
      status: 'active',
      limit: options?.limit ?? 20,
    });
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (err) {
    console.error('[cloud-actions] getTrendingDishesAction failed:', err);
    return failure('Failed to load trending dishes');
  }
}

// ── Category + cuisine lists ────────────────────────────────────────

export async function getDishCategoriesAction(): Promise<ActionResult<string[]>> {
  try {
    const result = await getDishCategories();
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (err) {
    console.error('[cloud-actions] getDishCategoriesAction failed:', err);
    return failure('Failed to load categories');
  }
}

export async function getCuisinesAction(): Promise<ActionResult<string[]>> {
  try {
    const result = await getCuisines();
    if (!result.ok) return failure(result.error);
    return success(result.data);
  } catch (err) {
    console.error('[cloud-actions] getCuisinesAction failed:', err);
    return failure('Failed to load cuisines');
  }
}
