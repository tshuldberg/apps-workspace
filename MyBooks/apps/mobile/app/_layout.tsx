import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@mybooks/ui';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: 'Inter', fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="book/[id]" options={{ title: 'Book Detail' }} />
        <Stack.Screen name="book/add" options={{ title: 'Add Book' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan Barcode', presentation: 'modal' }} />
        <Stack.Screen name="shelf/[id]" options={{ title: 'Shelf' }} />
        <Stack.Screen name="year-review" options={{ title: 'Year in Review', presentation: 'modal' }} />
      </Stack>
    </>
  );
}
