import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';

export default function CycleTabsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="cycle" errorBoundary={false} lockGuard={false}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </ModuleLayoutWrapper>
  );
}
