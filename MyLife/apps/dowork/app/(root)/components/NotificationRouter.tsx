// Notification tap router.
//
// Wires the expo-notifications response listeners and routes a tapped
// notification into the right screen using the payload dowork-notify sends
// (new_video -> player, form_check / form_feedback -> the form-check review).
// Rendering is null; it only owns side effects. Cold-start taps are read once
// via getLastNotificationResponseAsync so a launch-from-notification lands on
// the right screen. All routing goes through resolveNotificationRoute, which
// rejects malformed payloads, so a crafted notification cannot navigate
// somewhere unexpected.
//
// Readiness gate (RT-9): this component already mounts under DatabaseProvider,
// so DB + migrations are settled before any route fires. But the cold-start
// target (the player, for a new_video tap) needs a live Supabase client, and
// DoWorkCloudProvider brings that up asynchronously (anonymous session +
// createClient). Routing the launch tap before the cloud is ready lands a fully
// online user on the player's "needs a cloud connection" error. So the
// cold-start route is deferred until useDoWorkCloud().isReady. Warm taps arrive
// while the app is already running (cloud long since ready), so they route
// immediately with no gate.

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { resolveNotificationRoute } from '../data/push';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';

// Foreground presentation: still show the banner while the app is open so a
// coach mid-session sees a form check land.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function extractData(response: Notifications.NotificationResponse | null): unknown {
  return response?.notification?.request?.content?.data ?? null;
}

export function NotificationRouter() {
  const router = useRouter();
  const { isReady } = useDoWorkCloud();
  const handledColdStart = useRef(false);

  // Cold start: launched by tapping a notification. Deferred until the cloud is
  // ready so the target screen (e.g. the player) mounts with a live Supabase
  // client instead of failing on a not-yet-initialized one (RT-9). Guarded by
  // handledColdStart so it only routes once even though the effect re-runs as
  // isReady flips true.
  useEffect(() => {
    if (!isReady || handledColdStart.current) return;
    let active = true;

    void (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (!active || handledColdStart.current) return;
        const route = resolveNotificationRoute(extractData(last));
        if (route) {
          handledColdStart.current = true;
          router.push(route as never);
        }
      } catch {
        // No launch response available; nothing to route.
      }
    })();

    return () => {
      active = false;
    };
  }, [router, isReady]);

  // Warm taps while the app is running. The cloud is long since ready by the
  // time a running app receives a tap, so these route immediately.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = resolveNotificationRoute(extractData(response));
      if (route) router.push(route as never);
    });
    return () => subscription.remove();
  }, [router]);

  return null;
}
