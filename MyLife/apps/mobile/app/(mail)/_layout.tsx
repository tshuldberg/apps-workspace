import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function MailLayout() {
  return (
    <ModuleLayoutWrapper moduleId="mail">
      <Tabs.Screen name="index" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="folders" options={{ title: 'Folders' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="onboarding" options={{ href: null, title: 'Welcome' }} />
      <Tabs.Screen name="thread/[id]" options={{ href: null, title: 'Thread' }} />
      <Tabs.Screen name="message/[id]" options={{ href: null, title: 'Message' }} />
      <Tabs.Screen name="compose-message" options={{ href: null, title: 'Compose' }} />
      <Tabs.Screen name="contacts/index" options={{ href: null, title: 'Contacts' }} />
      <Tabs.Screen name="contacts/[id]" options={{ href: null, title: 'Contact' }} />
      <Tabs.Screen name="accounts/index" options={{ href: null, title: 'Accounts' }} />
      <Tabs.Screen name="accounts/add" options={{ href: null, title: 'Add Account' }} />
      <Tabs.Screen name="filters/index" options={{ href: null, title: 'Filters' }} />
      <Tabs.Screen name="filters/edit" options={{ href: null, title: 'Edit Filter' }} />
      <Tabs.Screen name="calendar-events" options={{ href: null, title: 'Calendar Events' }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
      <Tabs.Screen name="encryption/index" options={{ href: null, title: 'Encryption' }} />
      <Tabs.Screen name="encryption/add" options={{ href: null, title: 'Add Key' }} />
      <Tabs.Screen name="templates" options={{ href: null, title: 'Templates' }} />
      <Tabs.Screen name="schedule-send" options={{ href: null, title: 'Schedule Send' }} />
    </ModuleLayoutWrapper>
  );
}
