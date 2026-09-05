import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function FastLayout() {
  return (
    <ModuleLayoutWrapper moduleId="fast">
      <Tabs.Screen name="index" options={{ title: 'Timer' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="caffeine" options={{ href: null, title: 'Caffeine' }} />
      <Tabs.Screen name="weight" options={{ href: null, title: 'Weight' }} />
    </ModuleLayoutWrapper>
  );
}
