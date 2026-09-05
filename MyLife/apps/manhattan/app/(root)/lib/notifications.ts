// Plan reminders (Phase 4). App-level expo-notifications adapter; the pure
// trigger math lives in @mylife/manhattan (planReminderTrigger/reminderId).
// Notifications are scheduled locally and keyed by a deterministic id so a plan
// edit reschedules and a delete cancels cleanly. Bundle-verified only here;
// real delivery + permission prompts need an EAS dev build on a device.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { planReminderTrigger, reminderId, type PlanRow } from '@mylife/manhattan';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL = 'manhattan-plan-reminders';

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted || current.status === 'granted';
  if (!granted && current.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted || requested.status === 'granted';
  }
  if (granted && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Plan reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return granted;
}

type PlanReminderInput = Pick<PlanRow, 'id' | 'title' | 'start_at' | 'reminder_minutes'>;

/**
 * Schedule (or reschedule) the reminder for a plan. Always cancels any existing
 * reminder for the plan first, so this is safe to call on every create/edit. A
 * no-op when the plan has no reminder or the trigger is already in the past.
 */
export async function schedulePlanReminder(plan: PlanReminderInput): Promise<void> {
  const id = reminderId(plan.id);
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});

  const reminder = planReminderTrigger(plan);
  if (!reminder) return;

  const granted = await ensurePermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: reminder.title,
      body: reminder.body,
      data: { planId: plan.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(reminder.triggerAt),
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
    },
  });
}

/** Cancel a plan's reminder. Idempotent. */
export async function cancelPlanReminder(planId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(reminderId(planId)).catch(() => {});
}
