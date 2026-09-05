import { Tabs, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { MaterialSymbol, type ForumsMaterialSymbolName } from '@mylife/forums';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';

type IconSpec = {
  name: ForumsMaterialSymbolName;
  onPress: () => void;
  label: string;
};

function HeaderIconButton({ name, onPress, label }: IconSpec) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialSymbol name={name} size={20} color="rgba(228, 225, 233, 0.74)" />
    </Pressable>
  );
}

export default function ForumsTabsLayout() {
  const router = useRouter();

  const openActivity = () => router.push('/(forums)/activity-feed' as never);

  return (
    <ModuleLayoutWrapper moduleId="forums" errorBoundary={false} lockGuard={false}>
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          headerRight: () => (
            <>
              <HeaderIconButton
                name="notifications"
                label="Open activity"
                onPress={openActivity}
              />
              <HeaderIconButton
                name="more_vert"
                label="Feed actions"
                onPress={() =>
                  Alert.alert('Feed actions', 'Choose a shortcut.', [
                    { text: 'Activity', onPress: openActivity },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                }
              />
            </>
          ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: 'Communities',
          headerRight: () => (
            <>
              <HeaderIconButton
                name="add"
                label="Create community"
                onPress={() => router.push('/(forums)/create-community' as never)}
              />
              <HeaderIconButton
                name="more_vert"
                label="Community tools"
                onPress={() =>
                  Alert.alert('Community tools', 'Use the create flow or open a community.')
                }
              />
            </>
          ),
        }}
      />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
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
