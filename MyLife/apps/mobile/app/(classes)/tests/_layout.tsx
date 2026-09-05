import { Stack } from 'expo-router';
import { colors } from '@mylife/ui';

export default function TestsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="add" options={{ title: 'Add test' }} />
      <Stack.Screen name="[id]" options={{ title: 'Test' }} />
    </Stack>
  );
}
