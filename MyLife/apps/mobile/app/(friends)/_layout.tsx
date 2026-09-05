import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function FriendsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="friends">
      <Tabs.Screen name="index" options={{ title: 'People' }} />
      <Tabs.Screen name="hangouts" options={{ title: 'Hangouts' }} />
      <Tabs.Screen name="birthdays" options={{ title: 'Birthdays' }} />
      <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="person-detail" options={{ href: null }} />
      <Tabs.Screen name="add-person" options={{ href: null }} />
      <Tabs.Screen name="edit-person" options={{ href: null }} />
      <Tabs.Screen name="log-hangout" options={{ href: null }} />
      <Tabs.Screen name="hangout-detail" options={{ href: null }} />
      <Tabs.Screen name="gift-tracker" options={{ href: null }} />
      <Tabs.Screen name="add-gift" options={{ href: null }} />
      <Tabs.Screen name="add-gift-idea" options={{ href: null }} />
      <Tabs.Screen name="journal" options={{ href: null }} />
      <Tabs.Screen name="add-journal" options={{ href: null }} />
      <Tabs.Screen name="add-memory" options={{ href: null }} />
      <Tabs.Screen name="memory-detail" options={{ href: null }} />
      <Tabs.Screen name="timeline" options={{ href: null }} />
      <Tabs.Screen name="health" options={{ href: null }} />
      <Tabs.Screen name="insights" options={{ href: null }} />
      <Tabs.Screen name="insights-quality" options={{ href: null }} />
      <Tabs.Screen name="life-events" options={{ href: null }} />
      <Tabs.Screen name="add-life-event" options={{ href: null }} />
      <Tabs.Screen name="people-by-city" options={{ href: null }} />
      <Tabs.Screen name="circles-list" options={{ href: null }} />
      <Tabs.Screen name="circle-detail" options={{ href: null }} />
      <Tabs.Screen name="add-circle" options={{ href: null }} />
    </ModuleLayoutWrapper>
  );
}
