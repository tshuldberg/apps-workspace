import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function WordsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="words">
      <Tabs.Screen name="index" options={{ title: 'Lookup' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="word/[id]" options={{ href: null, title: 'Word' }} />
      <Tabs.Screen name="saved/[id]" options={{ href: null, title: 'Saved Word' }} />
      <Tabs.Screen name="helper" options={{ href: null, title: 'Helper' }} />
      <Tabs.Screen name="languages" options={{ href: null, title: 'Languages' }} />
      <Tabs.Screen name="list/[id]" options={{ href: null, title: 'List' }} />
    </ModuleLayoutWrapper>
  );
}
