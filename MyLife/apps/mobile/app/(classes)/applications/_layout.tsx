import { Stack } from 'expo-router';
import { colors } from '@mylife/ui';

export default function ApplicationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="add" options={{ title: 'Add application' }} />
      <Stack.Screen name="[id]" options={{ title: 'Application' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit application' }} />
    </Stack>
  );
}
