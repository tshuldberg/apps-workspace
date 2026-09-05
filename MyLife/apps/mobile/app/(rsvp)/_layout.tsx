import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';
import { RsvpProvider } from '../../components/rsvp/RsvpContext';

export default function RsvpLayout() {
  return (
    <RsvpProvider>
      <ModuleLayoutWrapper moduleId="rsvp">
        <Tabs.Screen name="index" options={{ title: 'Events' }} />
        <Tabs.Screen name="guests" options={{ title: 'Guests' }} />
        <Tabs.Screen name="polls" options={{ title: 'Polls' }} />
        <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        <Tabs.Screen name="event/[id]" options={{ href: null, title: 'Event' }} />
        <Tabs.Screen name="event/new" options={{ href: null, title: 'New Event' }} />
        <Tabs.Screen name="check-in" options={{ href: null, title: 'Check In' }} />
        <Tabs.Screen name="calendar-sync" options={{ href: null, title: 'Calendar Sync' }} />
        <Tabs.Screen name="expenses" options={{ href: null, title: 'Expenses' }} />
        <Tabs.Screen name="templates" options={{ href: null, title: 'Templates' }} />
        <Tabs.Screen name="dietary" options={{ href: null, title: 'Dietary' }} />
        <Tabs.Screen name="recurrence" options={{ href: null, title: 'Recurrence' }} />
        <Tabs.Screen name="location" options={{ href: null, title: 'Location' }} />
        <Tabs.Screen name="invitation-design" options={{ href: null, title: 'Invitation Design' }} />
        <Tabs.Screen name="messaging" options={{ href: null, title: 'Messages' }} />
        <Tabs.Screen name="registry" options={{ href: null, title: 'Gift Registry' }} />
        <Tabs.Screen name="seating" options={{ href: null, title: 'Seating' }} />
      </ModuleLayoutWrapper>
    </RsvpProvider>
  );
}
