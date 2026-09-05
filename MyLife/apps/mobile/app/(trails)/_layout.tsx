import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { TR_ACCENT, TR_FONTS, TR_SURFACES, TR_TEXT } from '@mylife/trails';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';

export default function TrailsLayout() {
  const [fontsLoaded] = useFonts({
    [TR_FONTS.regular]: PlusJakartaSans_400Regular,
    [TR_FONTS.medium]: PlusJakartaSans_500Medium,
    [TR_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [TR_FONTS.bold]: PlusJakartaSans_700Bold,
    [TR_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={TR_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyTrails">
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: TR_SURFACES.base },
          headerStyle: { backgroundColor: TR_SURFACES.base },
          headerTintColor: TR_TEXT,
          headerTitleStyle: { fontFamily: TR_FONTS.semiBold },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="record"
          options={{
            title: 'Record',
            headerShown: false,
          }}
        />
        <Stack.Screen name="trail/[id]" options={{ title: 'Trail' }} />
        <Stack.Screen
          name="recording/[id]"
          options={{
            title: 'Recording',
            headerShown: false,
          }}
        />
        <Stack.Screen name="elevation-profile" options={{ title: 'Elevation' }} />
        <Stack.Screen name="offline-regions" options={{ title: 'Offline Maps' }} />
        <Stack.Screen name="alert-settings" options={{ title: 'Alert Settings' }} />
        <Stack.Screen name="segment/[id]" options={{ title: 'Segment' }} />
        <Stack.Screen name="packing" options={{ title: 'Packing Lists' }} />
        <Stack.Screen name="packing-checklist/[id]" options={{ title: 'Checklist' }} />
        <Stack.Screen name="trips" options={{ title: 'Trips' }} />
        <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
        <Stack.Screen name="discover" options={{ title: 'Discover Trails' }} />
        <Stack.Screen
          name="route-builder"
          options={{
            title: 'Route Builder',
            headerShown: false,
          }}
        />
        <Stack.Screen name="write-review" options={{ title: 'Write Review' }} />
        <Stack.Screen name="gear" options={{ title: 'Gear' }} />
        <Stack.Screen name="weather" options={{ title: 'Weather' }} />
        <Stack.Screen name="segments" options={{ title: 'Segments' }} />
        <Stack.Screen name="reviews" options={{ title: 'Reviews' }} />
        <Stack.Screen name="export" options={{ title: 'Export' }} />
        <Stack.Screen name="photos" options={{ title: 'Photos' }} />
        <Stack.Screen name="calories" options={{ title: 'Calories' }} />
        <Stack.Screen name="waypoint/[id]" options={{ title: 'Waypoint' }} />
      </Stack>
    </ModuleErrorBoundary>
  );
}

const styles = {
  loader: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: TR_SURFACES.base,
  },
};
