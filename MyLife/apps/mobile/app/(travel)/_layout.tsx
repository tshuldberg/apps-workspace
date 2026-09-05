import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function TravelLayout() {
  return (
    <ModuleLayoutWrapper moduleId="travel">
      <Tabs.Screen name="index" options={{ title: 'Trips' }} />
      <Tabs.Screen name="destinations" options={{ title: 'Destinations' }} />
      <Tabs.Screen name="map" options={{ href: null, title: 'Map' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="logistics" options={{ title: 'Logistics' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
      <Tabs.Screen name="trip/create" options={{ href: null, title: 'New Trip' }} />
      <Tabs.Screen name="trip/[id]" options={{ href: null, title: 'Trip' }} />
      <Tabs.Screen
        name="trip/[id]/packing/[listId]"
        options={{ href: null, title: 'Packing' }}
      />
      <Tabs.Screen name="bucket-list" options={{ href: null, title: 'Bucket List' }} />
      <Tabs.Screen name="destination/[id]" options={{ href: null, title: 'Destination' }} />
      <Tabs.Screen name="stats" options={{ href: null, title: 'Stats' }} />
      <Tabs.Screen name="planning" options={{ href: null, title: 'Planning' }} />
      <Tabs.Screen
        name="journal/[entryId]"
        options={{ href: null, title: 'Entry' }}
      />
      <Tabs.Screen name="memories" options={{ href: null, title: 'Memories' }} />
      <Tabs.Screen name="memory/new" options={{ href: null, title: 'New Memory' }} />
      <Tabs.Screen name="memory/[id]" options={{ href: null, title: 'Memory' }} />
      <Tabs.Screen
        name="memory/[id]/edit"
        options={{ href: null, title: 'Edit Memory' }}
      />
    </ModuleLayoutWrapper>
  );
}
