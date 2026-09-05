import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function SubsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="subs">
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="subscriptions" options={{ title: 'Subs' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="add-sub" options={{ href: null, title: 'Add Subscription' }} />
      <Tabs.Screen name="[id]" options={{ href: null, title: 'Subscription' }} />
      <Tabs.Screen name="detect" options={{ href: null, title: 'Find Subscriptions' }} />
      <Tabs.Screen name="cost-report" options={{ href: null, title: 'Cost Report' }} />
      <Tabs.Screen name="compare" options={{ href: null, title: 'Compare Prices' }} />
    </ModuleLayoutWrapper>
  );
}
