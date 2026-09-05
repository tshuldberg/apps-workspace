import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function NotesLayout() {
  return (
    <ModuleLayoutWrapper moduleId="notes">
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="folders" options={{ title: 'Folders' }} />
      <Tabs.Screen name="graph" options={{ title: 'Graph' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="note-editor" options={{ href: null, title: 'Editor' }} />
      <Tabs.Screen name="note-preview" options={{ href: null, title: 'Preview' }} />
      <Tabs.Screen name="daily" options={{ href: null, title: 'Daily Note' }} />
      <Tabs.Screen name="templates" options={{ href: null, title: 'Templates' }} />
      <Tabs.Screen name="databases" options={{ href: null, title: 'Databases' }} />
      <Tabs.Screen name="plugins" options={{ href: null, title: 'Plugins' }} />
      <Tabs.Screen name="canvas-list" options={{ href: null, title: 'Canvas' }} />
      <Tabs.Screen name="canvas" options={{ href: null, title: 'Canvas Editor' }} />
      <Tabs.Screen name="clipper" options={{ href: null, title: 'Web Clipper' }} />
      <Tabs.Screen name="discovery" options={{ href: null, title: 'Discovery' }} />
      <Tabs.Screen name="analytics" options={{ href: null, title: 'Analytics' }} />
      <Tabs.Screen name="ai-assistant" options={{ href: null, title: 'AI Assistant' }} />
    </ModuleLayoutWrapper>
  );
}
