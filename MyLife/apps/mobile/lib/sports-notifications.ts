/**
 * MySports native notification dispatcher.
 *
 * Lives in the mobile app layer (not in @mylife/sports) so the sports
 * module package stays free of expo-notifications / react-native
 * imports. The pure rule engine (`@mylife/sports`
 * `notification-rules.ts`) stays side-effect free; this file is the ONLY
 * place that turns `NotificationIntent` values into real OS notifications
 * and writes `sp_notifications_log` rows.
 *
 * Foreground-only constraint (honest MVP):
 *  - `scheduleGameStart` uses `scheduleNotificationAsync` with a trigger
 *    5 minutes before kickoff, so game-start alerts fire even if the app
 *    is closed or backgrounded.
 *  - `dispatchLiveIntents` uses `scheduleNotificationAsync` with a 1s
 *    trigger, which only fires while the scoreboard is actively polling.
 *    P2-A ships no background fetch and no push, so close-game / final /
 *    OT / rival-loss alerts only arrive while the user has the app
 *    foregrounded.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import {
  recordNotification,
  type Game,
  type NotificationIntent,
  type NotificationLogEntry,
  type Team,
} from '@mylife/sports';

const SPORTS_CHANNEL_ID = 'mysports-scores';
let handlerConfigured = false;

export type SportsPermissionStatus = 'granted' | 'denied' | 'undetermined';

// ---------------------------------------------------------------------------
// Platform setup
// ---------------------------------------------------------------------------

export function configureSportsNotificationHandler(): void {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

export async function ensureSportsNotificationChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SPORTS_CHANNEL_ID, {
    name: 'MySports Scores',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#16A34A',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

function normalizeStatus(status: string): SportsPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getSportsNotificationPermissionStatus(): Promise<SportsPermissionStatus> {
  configureSportsNotificationHandler();
  const res = await Notifications.getPermissionsAsync();
  return normalizeStatus(res.status);
}

export async function requestSportsNotificationPermission(): Promise<SportsPermissionStatus> {
  configureSportsNotificationHandler();
  await ensureSportsNotificationChannelAsync();
  const res = await Notifications.requestPermissionsAsync();
  return normalizeStatus(res.status);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function logEntryFromIntent(
  intent: NotificationIntent,
  firedAt: number,
): NotificationLogEntry {
  return {
    id: `${intent.teamId}:${intent.gameId}:${intent.eventType}`,
    team_id: intent.teamId,
    game_id: intent.gameId,
    event_type: intent.eventType,
    fired_at: firedAt,
    title: intent.title,
    body: intent.body,
    payload_json: null,
  };
}

/**
 * Schedule a local notification 5 minutes before kickoff. Idempotent via
 * `recordNotification` dedupe -- calling twice for the same game is a
 * no-op. Returns the expo-notifications identifier, or null when the
 * notification was already scheduled or the kickoff is too close/past.
 */
export async function scheduleGameStart(
  db: DatabaseAdapter,
  team: Team,
  game: Game,
): Promise<string | null> {
  if (team.notify_start !== 1) return null;

  const opponentName =
    game.home.id === team.id ? game.away.name : game.home.name;
  const intent: NotificationIntent = {
    teamId: team.id,
    gameId: game.id,
    eventType: 'start',
    title: `${team.name} is about to play`,
    body: `vs ${opponentName} -- kicks off soon.`,
  };
  const { inserted } = recordNotification(
    db,
    logEntryFromIntent(intent, Date.now()),
  );
  if (!inserted) return null;

  const triggerSeconds = Math.ceil(
    (game.startAt - 5 * 60 * 1000 - Date.now()) / 1000,
  );
  if (triggerSeconds <= 0) return null;

  configureSportsNotificationHandler();
  await ensureSportsNotificationChannelAsync();

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: intent.title,
        body: intent.body,
        sound: 'default',
        data: {
          sportsGameId: game.id,
          sportsTeamId: team.id,
          eventType: 'start',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: triggerSeconds,
        repeats: false,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[MySports] scheduleGameStart failed', err);
    return null;
  }
}

/**
 * Fire a set of live NotificationIntents immediately. Each intent is
 * deduped through sp_notifications_log. Returns the number actually
 * presented. Only fires while the app is foregrounded (P2-A MVP
 * constraint -- no background fetch).
 */
export async function dispatchLiveIntents(
  db: DatabaseAdapter,
  intents: readonly NotificationIntent[],
): Promise<number> {
  if (intents.length === 0) return 0;
  configureSportsNotificationHandler();
  await ensureSportsNotificationChannelAsync();

  let fired = 0;
  for (const intent of intents) {
    const { inserted } = recordNotification(
      db,
      logEntryFromIntent(intent, Date.now()),
    );
    if (!inserted) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: intent.title,
          body: intent.body,
          sound: 'default',
          data: {
            sportsGameId: intent.gameId,
            sportsTeamId: intent.teamId,
            eventType: intent.eventType,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
          repeats: false,
        },
      });
      fired += 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MySports] dispatchLiveIntents failed', err);
    }
  }
  return fired;
}
