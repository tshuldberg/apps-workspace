import { useState, useEffect, useCallback } from 'react';
import {
  assembleFeed,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  blockUser,
  removeFriend,
  getFriendConnections,
  syncShareEvent,
  MAX_FRIENDS,
  type SocialSupabaseClient,
  type FeedResult,
  type FriendConnection,
  type SyncShareEventInput,
} from '@mylife/books';

export function useSocialFeed(supabaseClient?: SocialSupabaseClient) {
  const [feed, setFeed] = useState<FeedResult | null>(null);
  const [friends, setFriends] = useState<FriendConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = !!supabaseClient;

  const refresh = useCallback(async () => {
    if (!supabaseClient) return;
    try {
      setLoading(true);
      setError(null);
      const f = await assembleFeed(supabaseClient);
      setFeed(f);
      const c = await getFriendConnections(supabaseClient);
      setFriends(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [supabaseClient]);

  useEffect(() => {
    if (enabled) {
      refresh();
    }
  }, [enabled, refresh]);

  const sendRequest = useCallback(
    async (responderId: string) => {
      if (!supabaseClient) return;
      try {
        await sendFriendRequest(supabaseClient, responderId);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [supabaseClient, refresh],
  );

  const acceptRequest = useCallback(
    async (connectionId: string) => {
      if (!supabaseClient) return;
      try {
        await acceptFriendRequest(supabaseClient, connectionId);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [supabaseClient, refresh],
  );

  const rejectRequest = useCallback(
    async (connectionId: string) => {
      if (!supabaseClient) return;
      try {
        await rejectFriendRequest(supabaseClient, connectionId);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [supabaseClient, refresh],
  );

  const block = useCallback(
    async (connectionId: string) => {
      if (!supabaseClient) return;
      try {
        await blockUser(supabaseClient, connectionId);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [supabaseClient, refresh],
  );

  const unfriend = useCallback(
    async (connectionId: string) => {
      if (!supabaseClient) return;
      try {
        await removeFriend(supabaseClient, connectionId);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [supabaseClient, refresh],
  );

  const syncEvent = useCallback(
    async (input: SyncShareEventInput) => {
      if (!supabaseClient) return;
      try {
        await syncShareEvent(supabaseClient, input);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [supabaseClient],
  );

  return {
    feed,
    friends,
    loading,
    error,
    enabled,
    maxFriends: MAX_FRIENDS,
    refresh,
    sendRequest,
    acceptRequest,
    rejectRequest,
    block,
    unfriend,
    syncEvent,
  };
}
