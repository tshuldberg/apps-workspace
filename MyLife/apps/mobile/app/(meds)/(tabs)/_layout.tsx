import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';

export default function MedsTabsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="meds" errorBoundary={false} lockGuard={false}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="medications" options={{ title: 'Medications' }} />
      <Tabs.Screen name="measurement-trends" options={{ title: 'Vitals' }} />
      <Tabs.Screen name="correlation" options={{ title: 'Insights' }} />
      <Tabs.Screen name="settings" options={{ title: 'More' }} />
    </ModuleLayoutWrapper>
  );
}
