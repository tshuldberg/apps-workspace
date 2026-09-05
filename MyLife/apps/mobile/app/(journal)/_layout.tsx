import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function JournalLayout() {
  return (
    <ModuleLayoutWrapper moduleId="journal">
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="entries" options={{ title: 'Entries' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="notebooks" options={{ title: 'Notebooks' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="new-entry" options={{ href: null, title: 'New Entry' }} />
      <Tabs.Screen name="entry-detail" options={{ href: null, title: 'Entry Detail' }} />
      <Tabs.Screen name="voice-entry" options={{ href: null }} />
      <Tabs.Screen name="cbt" options={{ href: null }} />
      <Tabs.Screen name="therapy-templates" options={{ href: null }} />
      <Tabs.Screen name="ai-prompts" options={{ href: null }} />
      <Tabs.Screen name="philosophy" options={{ href: null }} />
      <Tabs.Screen name="grid" options={{ href: null }} />
      <Tabs.Screen name="vision-board" options={{ href: null }} />
      <Tabs.Screen name="book-builder" options={{ href: null }} />
      <Tabs.Screen name="writing-insights" options={{ href: null }} />
      <Tabs.Screen name="therapy-progress" options={{ href: null }} />
      <Tabs.Screen name="on-this-day" options={{ href: null }} />
    </ModuleLayoutWrapper>
  );
}
