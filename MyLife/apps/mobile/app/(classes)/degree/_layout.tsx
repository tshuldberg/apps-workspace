import { Stack } from 'expo-router';
import { colors } from '@mylife/ui';

export default function DegreeLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="program/add" options={{ title: 'Add program' }} />
      <Stack.Screen name="program/[id]" options={{ title: 'Program' }} />
      <Stack.Screen
        name="program/edit/[id]"
        options={{ title: 'Edit program' }}
      />
      <Stack.Screen
        name="requirement/add"
        options={{ title: 'Add requirement' }}
      />
      <Stack.Screen name="requirement/[id]" options={{ title: 'Requirement' }} />
      <Stack.Screen
        name="requirement/edit/[id]"
        options={{ title: 'Edit requirement' }}
      />
    </Stack>
  );
}
