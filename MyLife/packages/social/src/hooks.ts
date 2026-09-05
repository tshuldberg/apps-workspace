'use client';

/**
 * @mylife/social -- React hooks for consuming social state.
 *
 * Follows the same useSyncExternalStore pattern as @mylife/sync hooks.
 * All hooks require a SocialClient instance (provided via setSocialClient).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SocialClient } from './client';
import type {
  SocialProfile,
  FriendLink,
  Friendship,
  Activity,
  Follow,
  Challenge,
  ChallengeMember,
  LeaderboardEntry,
  LeaderboardTimeframe,
  Kudos,
  KudosEmoji,
  Comment,
  Group,
} from './types';
import {
  getSocialClient,
  getClientVersion,
} from './client-store';

// ── Generic Async Hook Helper ─────────────────────────────────────────

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

function useAsyncSocial<T>(
  fetcher: (client: SocialClient) => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
  deps: unknown[] = [],
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: true,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetch = useCallback(() => {
    const client = getSocialClient();
    if (!client) {
      setState({ data: null, error: 'Social client not initialized', isLoading: false });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    fetcherRef.current(client).then((result) => {
      if (result.ok) {
        setState({ data: result.data, error: null, isLoading: false });
      } else {
        setState({ data: null, error: result.error, isLoading: false });
      }
    });
  }, [getClientVersion(), ...deps]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { ...state, refetch: fetch };
}

// ── Profile Hooks ─────────────────────────────────────────────────────

/** Get the current user's social profile. */
export function useMyProfile() {
  return useAsyncSocial<SocialProfile | null>(
    (client) => client.getMyProfile(),
  );
}

/** Check if the current user has a social profile. */
export function useHasProfile() {
  return useAsyncSocial<boolean>(
    (client) => client.hasProfile(),
  );
}

/** Look up a profile by handle. */
export function useProfile(handle: string) {
  return useAsyncSocial<SocialProfile | null>(
    (client) => client.getProfileByHandle(handle),
    [handle],
  );
}

/** Search profiles. */
export function useProfileSearch(query: string) {
  return useAsyncSocial<SocialProfile[]>(
    (client) => client.searchProfiles(query),
    [query],
  );
}

/** Resolve multiple profiles in one request. */
export function useProfilesByIds(profileIds: string[]) {
  const profileKey = [...new Set(profileIds)].sort().join('|');

  return useAsyncSocial<SocialProfile[]>(
    (client) => client.getProfilesByIds(profileIds),
    [profileKey],
  );
}

// ── Secure Friend Links ──────────────────────────────────────────────

/** Get friend links created or redeemed by the current user. */
export function useMyFriendLinks() {
  return useAsyncSocial<FriendLink[]>(
    (client) => client.getMyFriendLinks(),
  );
}

/** Get the current user's confirmed friendships. */
export function useMyFriendships() {
  return useAsyncSocial<Friendship[]>(
    (client) => client.getMyFriendships(),
  );
}

/** Resolve the current user's friends as social profiles. */
export function useMyFriends() {
  return useAsyncSocial<SocialProfile[]>(
    (client) => client.getMyFriends(),
  );
}

// ── Follow Hooks ──────────────────────────────────────────────────────

/** Get followers of a profile. */
export function useFollowers(profileId: string, opts?: { limit?: number; offset?: number }) {
  return useAsyncSocial<SocialProfile[]>(
    (client) => client.getFollowers(profileId, opts),
    [profileId, opts?.limit, opts?.offset],
  );
}

/** Get profiles that a user follows. */
export function useFollowing(profileId: string, opts?: { limit?: number; offset?: number }) {
  return useAsyncSocial<SocialProfile[]>(
    (client) => client.getFollowing(profileId, opts),
    [profileId, opts?.limit, opts?.offset],
  );
}

/** Get pending follow requests for the current user. */
export function usePendingFollowRequests() {
  return useAsyncSocial<Follow[]>(
    (client) => client.getPendingFollowRequests(),
  );
}

// ── Activity Feed Hooks ───────────────────────────────────────────────

/** Get the main activity feed (activities from people the user follows). */
export function useActivityFeed(opts?: { limit?: number; offset?: number; moduleId?: string }) {
  return useAsyncSocial<Activity[]>(
    (client) => client.getFeed(opts),
    [opts?.limit, opts?.offset, opts?.moduleId],
  );
}

/** Get activities for a specific profile. */
export function useProfileActivities(profileId: string, opts?: { limit?: number; offset?: number }) {
  return useAsyncSocial<Activity[]>(
    (client) => client.getProfileActivities(profileId, opts),
    [profileId, opts?.limit, opts?.offset],
  );
}

// ── Kudos Hooks ───────────────────────────────────────────────────────

/** Get kudos for a specific activity. */
export function useKudos(activityId: string) {
  return useAsyncSocial<Kudos[]>(
    (client) => client.getActivityKudos(activityId),
    [activityId],
  );
}

/** Resolve which activities the current user has already reacted to. */
export function useMyKudosForActivities(activityIds: string[]) {
  const activityKey = [...new Set(activityIds)].sort().join('|');

  return useAsyncSocial<Record<string, boolean>>(
    (client) => client.getMyKudosForActivities(activityIds),
    [activityKey],
  );
}

/** Mutation hook for giving/removing kudos. */
export function useKudosMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const give = useCallback(async (activityId: string, emoji: KudosEmoji) => {
    const client = getSocialClient();
    if (!client) return;
    setIsLoading(true);
    setError(null);
    const result = await client.giveKudos(activityId, emoji);
    setIsLoading(false);
    if (!result.ok) setError(result.error);
    return result;
  }, []);

  const remove = useCallback(async (activityId: string) => {
    const client = getSocialClient();
    if (!client) return;
    setIsLoading(true);
    setError(null);
    const result = await client.removeKudos(activityId);
    setIsLoading(false);
    if (!result.ok) setError(result.error);
    return result;
  }, []);

  return { give, remove, isLoading, error };
}

// ── Comment Hooks ─────────────────────────────────────────────────────

/** Get comments for a specific activity. */
export function useComments(activityId: string, opts?: { limit?: number; offset?: number }) {
  return useAsyncSocial<Comment[]>(
    (client) => client.getComments(activityId, opts),
    [activityId, opts?.limit, opts?.offset],
  );
}

// ── Challenge Hooks ───────────────────────────────────────────────────

/** Get active/upcoming challenges. */
export function useChallenges(opts?: { limit?: number; offset?: number }) {
  return useAsyncSocial<Challenge[]>(
    (client) => client.getActiveChallenges(opts),
    [opts?.limit, opts?.offset],
  );
}

/** Get the current user's progress in a challenge. */
export function useChallengeProgress(challengeId: string) {
  return useAsyncSocial<ChallengeMember | null>(
    (client) => client.getMyChallengeProgress(challengeId),
    [challengeId],
  );
}

// ── Leaderboard Hooks ─────────────────────────────────────────────────

/** Get leaderboard entries for a given config. */
export function useLeaderboard(configId: string, opts?: { limit?: number; offset?: number }) {
  return useAsyncSocial<LeaderboardEntry[]>(
    (client) => client.getLeaderboard(configId, opts),
    [configId, opts?.limit, opts?.offset],
  );
}

/** Get friends-only leaderboard. */
export function useFriendsLeaderboard(timeframe: LeaderboardTimeframe = 'weekly') {
  return useAsyncSocial<LeaderboardEntry[]>(
    (client) => client.getFriendsLeaderboard(timeframe),
    [timeframe],
  );
}

// ── Group Hooks ───────────────────────────────────────────────────────

/** Get groups the current user belongs to. */
export function useMyGroups() {
  return useAsyncSocial<Group[]>(
    (client) => client.getMyGroups(),
  );
}

/** Discover public groups. */
export function useDiscoverGroups(opts?: { limit?: number; offset?: number }) {
  return useAsyncSocial<Group[]>(
    (client) => client.discoverGroups(opts),
    [opts?.limit, opts?.offset],
  );
}
