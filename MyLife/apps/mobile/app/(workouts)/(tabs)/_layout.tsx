import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialSymbol, WK_ACCENT_LIGHT } from '@mylife/workouts';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';

type IconSpec = { name: string; onPress: () => void; color?: string };

function HeaderIconButton({ name, onPress, color = 'rgba(228, 225, 233, 0.74)' }: IconSpec) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel={name.replace(/_/g, ' ')}
    >
      <MaterialSymbol name={name} size={20} color={color} />
    </Pressable>
  );
}

export default function WorkoutsTabsLayout() {
  const router = useRouter();

  return (
    <ModuleLayoutWrapper moduleId="workouts" errorBoundary={false} lockGuard={false}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerRight: () => (
            <>
              <HeaderIconButton
                name="search"
                onPress={() => router.push('/(workouts)/explore' as never)}
              />
              <HeaderIconButton
                name="notifications"
                onPress={() => router.push('/(workouts)/insights' as never)}
              />
            </>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          headerRight: () => (
            <HeaderIconButton
              name="notifications"
              onPress={() => router.push('/(workouts)/insights' as never)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          headerRight: () => (
            <HeaderIconButton
              name="add_circle"
              color={WK_ACCENT_LIGHT}
              onPress={() => router.push('/(workouts)/builder' as never)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          headerRight: () => (
            <>
              <HeaderIconButton
                name="search"
                onPress={() => router.push('/(workouts)/history' as never)}
              />
              <HeaderIconButton
                name="notifications"
                onPress={() => router.push('/(workouts)/insights' as never)}
              />
            </>
          ),
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Profile' }} />
    </ModuleLayoutWrapper>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
