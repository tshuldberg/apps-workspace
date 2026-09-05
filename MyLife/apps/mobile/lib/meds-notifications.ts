import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const MEDS_CHANNEL_ID = 'mymeds-reminders';
let handlerConfigured = false;

export function configureMedsNotificationHandler() {
  if (handlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  handlerConfigured = true;
}

export async function ensureMedsNotificationChannelAsync() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(MEDS_CHANNEL_ID, {
    name: 'MyMeds Reminders',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#06B6D4',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
}

export async function getMedsNotificationPermissionStatusAsync() {
  configureMedsNotificationHandler();
  const permission = await Notifications.getPermissionsAsync();
  return permission.status;
}

export async function requestMedsNotificationPermissionAsync() {
  configureMedsNotificationHandler();
  await ensureMedsNotificationChannelAsync();
  const permission = await Notifications.requestPermissionsAsync();
  return permission.status;
}

export async function sendMedsTestNotificationAsync(
  title: string = 'MyMeds test notification',
  body: string = 'Reminders are ready to keep your schedule on track.',
) {
  configureMedsNotificationHandler();
  await ensureMedsNotificationChannelAsync();

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      repeats: false,
    },
  });
}

export async function scheduleMedsReminderNotificationAsync(input: {
  title: string;
  body: string;
  scheduledFor: Date;
}) {
  configureMedsNotificationHandler();
  await ensureMedsNotificationChannelAsync();

  const seconds = Math.ceil((input.scheduledFor.getTime() - Date.now()) / 1000);
  if (seconds <= 0) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
    },
  });
}
