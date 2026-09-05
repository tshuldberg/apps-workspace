import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function FlashLayout() {
  return (
    <ModuleLayoutWrapper moduleId="flash">
      <Tabs.Screen name="study" options={{ title: 'Study' }} />
      <Tabs.Screen name="decks" options={{ title: 'Decks' }} />
      <Tabs.Screen name="browser" options={{ title: 'Browse' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="schedule" options={{ href: null, title: 'Schedule' }} />
      <Tabs.Screen name="signals" options={{ href: null, title: 'Study Signals' }} />
      <Tabs.Screen name="import-export" options={{ href: null, title: 'Import/Export' }} />
      <Tabs.Screen name="forgetting-curve" options={{ href: null, title: 'Forgetting Curve' }} />
      <Tabs.Screen name="session-analytics" options={{ href: null, title: 'Sessions' }} />
      <Tabs.Screen name="card-stats" options={{ href: null, title: 'Card Stats' }} />
      <Tabs.Screen name="card-types" options={{ href: null, title: 'Card Types' }} />
      <Tabs.Screen name="match-game" options={{ href: null, title: 'Match Game' }} />
    </ModuleLayoutWrapper>
  );
}
