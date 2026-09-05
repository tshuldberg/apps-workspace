import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function VoiceLayout() {
  return (
    <ModuleLayoutWrapper moduleId="voice">
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
    </ModuleLayoutWrapper>
  );
}
