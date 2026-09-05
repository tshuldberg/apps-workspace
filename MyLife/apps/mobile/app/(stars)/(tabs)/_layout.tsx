import { Tabs } from 'expo-router';
import { ST_SURFACES } from '@mylife/stars';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';

export default function StarsTabsLayout() {
  return (
    <ModuleLayoutWrapper
      moduleId="stars"
      errorBoundary={false}
      lockGuard={false}
      screenOptions={{ sceneStyle: { backgroundColor: ST_SURFACES.base } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="sky" options={{ title: 'Sky' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="settings" options={{ title: 'More' }} />
    </ModuleLayoutWrapper>
  );
}
