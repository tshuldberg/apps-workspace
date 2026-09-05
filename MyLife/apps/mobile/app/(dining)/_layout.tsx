import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function DiningLayout() {
  return (
    <ModuleLayoutWrapper moduleId="dining">
      <Tabs.Screen name="index" options={{ title: 'Restaurants' }} />
      <Tabs.Screen name="visits" options={{ title: 'Visits' }} />
      <Tabs.Screen name="reservations" options={{ title: 'Reservations' }} />
      <Tabs.Screen name="wishlist" options={{ title: 'Wishlist' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      {/* Hidden sub-routes */}
      <Tabs.Screen name="restaurant/[id]" options={{ href: null }} />
      <Tabs.Screen name="restaurant/add" options={{ href: null }} />
      <Tabs.Screen name="restaurant/edit/[id]" options={{ href: null }} />
      <Tabs.Screen name="visit/[id]" options={{ href: null }} />
      <Tabs.Screen name="visit/add" options={{ href: null }} />
      <Tabs.Screen name="dish/[id]" options={{ href: null }} />
      <Tabs.Screen name="dish/add" options={{ href: null }} />
      <Tabs.Screen name="wine/[id]" options={{ href: null }} />
      <Tabs.Screen name="wine/add" options={{ href: null }} />
      <Tabs.Screen name="reservation/[id]" options={{ href: null }} />
      <Tabs.Screen name="reservation/add" options={{ href: null }} />
      <Tabs.Screen name="reservation/import" options={{ href: null }} />
      <Tabs.Screen name="year-review" options={{ href: null }} />
      <Tabs.Screen name="import" options={{ href: null }} />
    </ModuleLayoutWrapper>
  );
}
