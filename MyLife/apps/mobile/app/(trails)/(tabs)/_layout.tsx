import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';

export default function TrailsTabsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="trails" errorBoundary={false} lockGuard={false}>
      <Tabs.Screen name="index" options={{ title: 'Map' }} />
      <Tabs.Screen name="trails" options={{ title: 'Trails' }} />
      <Tabs.Screen name="recordings" options={{ title: 'Recordings' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </ModuleLayoutWrapper>
  );
}
