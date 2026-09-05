import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function CreateLayout() {
  return (
    <ModuleLayoutWrapper moduleId="create">
      <Tabs.Screen name="index" options={{ title: 'Projects' }} />
      <Tabs.Screen
        name="project/add"
        options={{ href: null, title: 'Add Project' }}
      />
      <Tabs.Screen
        name="project/[id]"
        options={{ href: null, title: 'Project' }}
      />
      <Tabs.Screen
        name="project/edit/[id]"
        options={{ href: null, title: 'Edit Project' }}
      />
      <Tabs.Screen
        name="project/log-progress"
        options={{ href: null, title: 'Log Progress' }}
      />
      <Tabs.Screen name="practice" options={{ title: 'Practice' }} />
      <Tabs.Screen name="skills" options={{ title: 'Skills' }} />
      <Tabs.Screen name="portfolio" options={{ title: 'Portfolio' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </ModuleLayoutWrapper>
  );
}
