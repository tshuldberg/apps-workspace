/**
 * Social feed query builder and helpers.
 * Constructs feed data from social post arrays.
 * Actual Supabase queries are in the host app layer; this module provides
 * pure-function feed logic for sorting, pagination, and enrichment.
 */

import type { SocialPost, SocialPostEnriched, WorkoutSummaryCard } from '../types';

/**
 * Sort posts by createdAt descending (newest first).
 * No algorithmic ranking -- strictly chronological.
 */
export function sortFeedChronological(posts: SocialPost[]): SocialPost[] {
  return [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Paginate a feed: return a slice of posts starting at the cursor index.
 */
export function paginateFeed(
  posts: SocialPost[],
  offset: number,
  limit: number,
): SocialPost[] {
  return posts.slice(offset, offset + limit);
}

/**
 * Check if a post's content has visible data after privacy filtering.
 * A post is "empty" if all shareable fields are hidden.
 */
export function isPostVisible(content: WorkoutSummaryCard): boolean {
  return (
    content.title !== 'Workout' ||
    content.durationMinutes > 0 ||
    content.exerciseCount > 0 ||
    content.totalSets > 0 ||
    content.prsHit.length > 0
  );
}

/**
 * Enrich a social post with like/comment counts and author info.
 * In production, these counts come from Supabase aggregation queries.
 * This helper builds the enriched type from raw components.
 */
export function enrichPost(
  post: SocialPost,
  likeCount: number,
  commentCount: number,
  isLikedByMe: boolean,
  authorName: string,
  authorAvatarUrl: string | null,
): SocialPostEnriched {
  return {
    ...post,
    likeCount,
    commentCount,
    isLikedByMe,
    authorName,
    authorAvatarUrl,
  };
}

/** Default page size for feed queries. */
export const FEED_PAGE_SIZE = 50;
