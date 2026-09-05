import { Stack } from 'expo-router';
import { colors } from '@mylife/ui';

export default function LifelongLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="courses" options={{ title: 'Courses' }} />
      <Stack.Screen name="certifications" options={{ title: 'Certifications' }} />
      <Stack.Screen name="goals" options={{ title: 'Learning goals' }} />
      <Stack.Screen name="course/[id]" options={{ title: 'Course' }} />
      <Stack.Screen name="course/add" options={{ title: 'Add course' }} />
      <Stack.Screen name="cert/[id]" options={{ title: 'Credential' }} />
      <Stack.Screen name="cert/add" options={{ title: 'Add credential' }} />
      <Stack.Screen name="goal/[id]" options={{ title: 'Goal' }} />
      <Stack.Screen name="goal/add" options={{ title: 'Add goal' }} />
    </Stack>
  );
}
