import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function SurfLayout() {
  return (
    <ModuleLayoutWrapper moduleId="surf">
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="spots" options={{ title: 'Spots' }} />
      <Tabs.Screen name="sessions" options={{ title: 'Sessions' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="account" options={{ href: null, title: 'Account' }} />
      <Tabs.Screen name="favorites" options={{ href: null, title: 'Favorites' }} />
      <Tabs.Screen name="feed" options={{ href: null, title: 'Feed' }} />
      <Tabs.Screen name="regions" options={{ href: null, title: 'Regions' }} />
      <Tabs.Screen name="spot/[id]" options={{ href: null, title: 'Spot' }} />
      <Tabs.Screen name="rating-detail" options={{ href: null, title: 'Rating Breakdown' }} />
      <Tabs.Screen name="alerts" options={{ href: null, title: 'Alerts' }} />
      <Tabs.Screen name="crew" options={{ href: null, title: 'Crew' }} />
      <Tabs.Screen name="wave-detect" options={{ href: null, title: 'Waves' }} />
      <Tabs.Screen name="trail" options={{ href: null, title: 'Trails' }} />
      <Tabs.Screen name="buoys" options={{ href: null, title: 'Buoys' }} />
      <Tabs.Screen name="tides" options={{ href: null, title: 'Tides' }} />
    </ModuleLayoutWrapper>
  );
}
