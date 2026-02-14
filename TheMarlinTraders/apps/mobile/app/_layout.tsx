import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import {
  registerForPushNotifications,
  setupNotificationListeners,
} from '../services/push'
import { colors } from '../constants/theme'

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotifications()
    const cleanup = setupNotificationListeners()
    return cleanup
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navyBlack },
          headerTintColor: colors.textPrimary,
          contentStyle: { backgroundColor: colors.navyBlack },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  )
}
