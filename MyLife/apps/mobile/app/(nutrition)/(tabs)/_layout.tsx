import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';

export default function NutritionTabsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="nutrition" errorBoundary={false} lockGuard={false}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="diary" options={{ title: 'Diary' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="trends" options={{ title: 'Trends' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </ModuleLayoutWrapper>
  );
}
