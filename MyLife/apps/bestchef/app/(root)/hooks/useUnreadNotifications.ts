import { useCallback, useEffect, useRef, useState } from 'react';
import { getUnreadCount, subscribeNotificationFeed } from '@mylife/bestchef';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';

const POLL_INTERVAL_MS = 30_000;

export interface UseUnreadNotificationsResult {
  count: number;
  refresh: () => void;
}

export function useUnreadNotifications(): UseUnreadNotificationsResult {
  const { userId, supabase } = useBestChefCloud();
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  // Keep ref in sync so realtime callbacks see the current value without
  // triggering a full re-subscribe.
  countRef.current = count;

  const refresh = useCallback(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    void getUnreadCount(null, { userId }).then((result) => {
      if (result.ok) {
        setCount(result.data);
      }
    });
  }, [userId]);

  useEffect(() => {
    if (!userId || !supabase) {
      setCount(0);
      return;
    }

    // Initial fetch
    refresh();

    // Realtime subscription + polling fallback (handled inside subscribeNotificationFeed)
    const unsubscribe = subscribeNotificationFeed({
      supabase,
      userId,
      onInsert: () => {
        setCount((prev) => prev + 1);
      },
      onUpdate: (notif) => {
        // A mark-read update: refresh the authoritative count from the server.
        // We don't try to guess the delta here because batch mark-all-read
        // can flip many rows at once.
        if (notif.isRead) {
          refresh();
        }
      },
    });

    // 30-second poll fallback as an extra safety net when realtime is active
    // but we want to stay consistent across long sessions.
    const pollTimer = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      unsubscribe();
      clearInterval(pollTimer);
    };
  }, [userId, supabase, refresh]);

  return { count, refresh };
}
