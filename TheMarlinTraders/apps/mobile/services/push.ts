import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { router } from 'expo-router'
import { apiClient } from './api-client'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
})

export async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device')
    return false
  }

  const { status: existing } =
    await Notifications.getPermissionsAsync()

  if (existing === 'granted') return true

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function registerForPushNotifications(): Promise<
  string | null
> {
  const granted = await requestPermissions()
  if (!granted) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3b82f6',
    })
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId:
      process.env.EXPO_PUBLIC_PROJECT_ID ?? 'the-marlin-traders',
  })

  const token = tokenData.data

  try {
    await apiClient.post('/api/devices/register', {
      token,
      platform: Platform.OS,
    })
  } catch (error) {
    console.error('Failed to register push token with API:', error)
  }

  return token
}

export function setupNotificationListeners() {
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, string>
          | undefined

        if (!data?.type) return

        switch (data.type) {
          case 'alert_triggered':
            if (data.symbol) {
              router.push({
                pathname: '/(tabs)/chart',
                params: { symbol: data.symbol },
              })
            }
            break

          case 'order_filled':
            router.push('/(tabs)/portfolio')
            break

          default:
            break
        }
      },
    )

  const notificationSubscription =
    Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as
        | Record<string, string>
        | undefined

      if (data?.type === 'alert_triggered' && data.symbol) {
        console.log(`Alert triggered for ${data.symbol}`)
      }
    })

  return () => {
    responseSubscription.remove()
    notificationSubscription.remove()
  }
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as
      | Record<string, string>
      | undefined

    return {
      shouldShowAlert: true,
      shouldPlaySound: data?.type === 'alert_triggered',
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }
  },
})
