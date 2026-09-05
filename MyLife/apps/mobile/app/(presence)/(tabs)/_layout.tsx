import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import {
  MaterialSymbol,
  PR_ACCENT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
} from '@mylife/presence';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';

function SettingsButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel="Open presence settings"
    >
      <MaterialSymbol name="settings" size={20} color={PR_TEXT_SECONDARY} />
    </Pressable>
  );
}

function DiscoverChip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.discoverChip}
      accessibilityRole="button"
      accessibilityLabel="Discover MyPresence"
    >
      <Text style={styles.discoverChipText}>Discover</Text>
    </Pressable>
  );
}

export default function PresenceTabsLayout() {
  const router = useRouter();
  const openSettings = () =>
    router.push('/(presence)/(tabs)/settings' as never);
  const openDiscover = () => router.push('/(presence)/hub' as never);

  return (
    <ModuleLayoutWrapper moduleId="presence" errorBoundary={false} lockGuard={false}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerRight: () => (
            <>
              <DiscoverChip onPress={openDiscover} />
              <SettingsButton onPress={openSettings} />
            </>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          headerRight: () => <SettingsButton onPress={openSettings} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          headerRight: () => <SettingsButton onPress={openSettings} />,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
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
  discoverChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PR_ACCENT,
  },
  discoverChipText: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: '#03151A',
  },
});
