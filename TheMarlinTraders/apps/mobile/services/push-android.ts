import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { colors } from '../constants/theme'

/**
 * Android notification channel definitions.
 * FCM requires notification channels on Android 8.0+ (API 26+).
 * Each channel controls priority, sound, vibration, and LED color.
 */

interface NotificationChannel {
  id: string
  name: string
  description: string
  importance: Notifications.AndroidImportance
  vibrationPattern: number[]
  lightColor: string
  sound: string | null
  enableLights: boolean
  enableVibrate: boolean
}

const CHANNELS: NotificationChannel[] = [
  {
    id: 'alerts',
    name: 'Price Alerts',
    description: 'High-priority notifications for triggered price alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.tradingGreen,
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
  },
  {
    id: 'trades',
    name: 'Trade Updates',
    description: 'Order fills, cancellations, and trade confirmations',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lightColor: colors.accent,
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
  },
  {
    id: 'general',
    name: 'General',
    description: 'Market news, feature updates, and account notifications',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [],
    lightColor: colors.accent,
    sound: null,
    enableLights: false,
    enableVibrate: false,
  },
]

/**
 * Maps notification data types to their corresponding Android channel ID.
 */
const TYPE_TO_CHANNEL: Record<string, string> = {
  alert_triggered: 'alerts',
  price_alert: 'alerts',
  order_filled: 'trades',
  order_cancelled: 'trades',
  order_rejected: 'trades',
  trade_confirmation: 'trades',
  market_news: 'general',
  account_update: 'general',
  feature_announcement: 'general',
}

/**
 * Registers all Android notification channels with the system.
 * Should be called once during app initialization on Android.
 * No-ops on iOS.
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return

  for (const channel of CHANNELS) {
    await Notifications.setNotificationChannelAsync(channel.id, {
      name: channel.name,
      description: channel.description,
      importance: channel.importance,
      vibrationPattern: channel.vibrationPattern,
      lightColor: channel.lightColor,
      sound: channel.sound ?? undefined,
      enableLights: channel.enableLights,
      enableVibrate: channel.enableVibrate,
    })
  }
}

/**
 * Deletes the legacy 'default' channel created by the base push.ts module.
 * Call after setupAndroidNotificationChannels() to clean up.
 */
export async function removeLegacyDefaultChannel(): Promise<void> {
  if (Platform.OS !== 'android') return

  try {
    await Notifications.deleteNotificationChannelAsync('default')
  } catch {
    // Channel may not exist, that's fine
  }
}

/**
 * Returns the appropriate Android channel ID for a given notification data type.
 * Falls back to 'general' for unknown types.
 */
export function getChannelForType(type: string): string {
  return TYPE_TO_CHANNEL[type] ?? 'general'
}

/**
 * Android-specific notification handler that routes notifications
 * to the correct channel based on the notification data type.
 */
export function getAndroidNotificationHandler() {
  return {
    handleNotification: async (notification: Notifications.Notification) => {
      const data = notification.request.content.data as
        | Record<string, string>
        | undefined

      const type = data?.type ?? 'general'
      const channelId = getChannelForType(type)
      const isHighPriority = channelId === 'alerts'

      return {
        shouldShowAlert: true,
        shouldPlaySound: isHighPriority,
        shouldSetBadge: true,
        priority: isHighPriority
          ? Notifications.AndroidNotificationPriority.HIGH
          : Notifications.AndroidNotificationPriority.DEFAULT,
      }
    },
  }
}

/**
 * Deep link routing map for notification types.
 * Maps notification data types to their target screens.
 */
interface DeepLinkTarget {
  pathname: string
  paramKey?: string
}

const DEEP_LINK_MAP: Record<string, DeepLinkTarget> = {
  alert_triggered: { pathname: '/(tabs)/chart', paramKey: 'symbol' },
  price_alert: { pathname: '/(tabs)/alerts' },
  order_filled: { pathname: '/(tabs)/portfolio' },
  order_cancelled: { pathname: '/(tabs)/portfolio' },
  trade_confirmation: { pathname: '/(tabs)/portfolio' },
}

/**
 * Handles deep linking from Android notification taps.
 * Navigates to the appropriate screen based on notification data.
 */
export function handleAndroidNotificationDeepLink(
  data: Record<string, string> | undefined,
): void {
  if (!data?.type) return

  const target = DEEP_LINK_MAP[data.type]
  if (!target) return

  if (target.paramKey && data[target.paramKey]) {
    router.push({
      pathname: target.pathname as `/${string}`,
      params: { [target.paramKey]: data[target.paramKey] },
    })
  } else {
    router.push(target.pathname as `/${string}`)
  }
}

/**
 * Sets up Android-specific notification response listener.
 * Handles deep linking when the user taps a notification.
 * Returns a cleanup function.
 */
export function setupAndroidNotificationDeepLinks(): () => void {
  if (Platform.OS !== 'android') return () => {}

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as
        | Record<string, string>
        | undefined

      handleAndroidNotificationDeepLink(data)
    },
  )

  return () => subscription.remove()
}

/**
 * Schedules a local notification on Android with the correct channel.
 * Useful for testing or local alert triggers.
 */
export async function scheduleAndroidLocalNotification(
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<string> {
  const channelId = getChannelForType(data.type ?? 'general')

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      color: colors.accent,
      ...(Platform.OS === 'android' ? { channelId } : {}),
    },
    trigger: null,
  })
}
