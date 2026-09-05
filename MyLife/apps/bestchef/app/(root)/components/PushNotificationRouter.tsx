// Push notification router + registration keeper (audit H13).
//
// Owns three side effects, renders null:
//   1. Foreground presentation handler (show the banner while the app is open).
//   2. Tap routing: a tapped push deep-links via buildTargetRoute using the
//      data payload the fanout worker sends (targetType + targetId). Cold-start
//      taps are read once via getLastNotificationResponseAsync so a launch-from-
//      notification lands on the right screen. Routing goes through
//      buildTargetRoute, which rejects unknown target types, so a crafted push
//      cannot navigate somewhere unexpected.
//   3. Silent registration keep-alive: when the user is signed in AND already
//      granted notifications, refresh the token (and its stored locale) without
//      ever prompting. This never resurrects a registration the user turned off
//      (it only refreshes when permission is already granted), and it keeps the
//      token row's locale in sync when the user changes language.

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { buildTargetRoute } from '@mylife/bestchef';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { useI18n } from '../i18n/I18nProvider';
import { refreshPushTokenIfEnabled } from '../data/push';

// Foreground presentation: still show the banner while the app is open so a
// user mid-session sees a rank change or moderation notice land.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Mirror of @mylife/bestchef's NotificationTargetType (not re-exported from the
// package barrel). buildTargetRoute accepts this closed set; the guard rejects
// anything else so a crafted payload can never reach navigation.
type TargetType = 'submission' | 'chef' | 'dish' | 'badge' | 'challenge' | 'comment' | 'appeal';

const KNOWN_TARGET_TYPES: TargetType[] = [
  'submission',
  'chef',
  'dish',
  'badge',
  'challenge',
  'comment',
  'appeal',
];

function isTargetType(value: unknown): value is TargetType {
  return typeof value === 'string' && (KNOWN_TARGET_TYPES as string[]).includes(value);
}

// Resolve the in-app route from the push data payload. Prefer re-deriving via
// buildTargetRoute (the route contract) over trusting the payload's convenience
// targetRoute string, so a malformed payload can never navigate off-contract.
function resolveRoute(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const targetType = isTargetType(record.targetType) ? record.targetType : null;
  const targetId = typeof record.targetId === 'string' && record.targetId.trim() ? record.targetId : null;
  return buildTargetRoute(targetType, targetId);
}

function extractData(response: Notifications.NotificationResponse | null): unknown {
  return response?.notification?.request?.content?.data ?? null;
}

export function PushNotificationRouter() {
  const router = useRouter();
  const cloud = useBestChefCloud();
  const { language } = useI18n();
  const handledColdStart = useRef(false);

  // Tap routing (cold start + warm).
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (!active || handledColdStart.current) return;
        const route = resolveRoute(extractData(last));
        if (route) {
          handledColdStart.current = true;
          router.push(route as never);
        }
      } catch {
        // No launch response available; nothing to route.
      }
    })();

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = resolveRoute(extractData(response));
      if (route) router.push(route as never);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  // Silent registration keep-alive: refresh the token + stored locale whenever
  // the signed-in user or their language changes, but only if push is already
  // enabled (never prompts, never resurrects a disabled registration).
  useEffect(() => {
    if (!cloud.isReady || !cloud.supabase || !cloud.userId) return;
    void refreshPushTokenIfEnabled(cloud.supabase, cloud.userId, language);
  }, [cloud.isReady, cloud.supabase, cloud.userId, language]);

  return null;
}
