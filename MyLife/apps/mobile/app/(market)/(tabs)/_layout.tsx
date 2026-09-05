import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';

export default function MarketTabsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="market" errorBoundary={false} lockGuard={false}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
      <Tabs.Screen name="sell" options={{ title: 'Sell' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </ModuleLayoutWrapper>
  );
}
