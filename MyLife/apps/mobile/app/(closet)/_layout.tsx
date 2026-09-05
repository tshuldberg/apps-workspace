import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function ClosetLayout() {
  return (
    <ModuleLayoutWrapper moduleId="closet">
      <Tabs.Screen name="wardrobe" options={{ title: 'Wardrobe' }} />
      <Tabs.Screen name="outfits" options={{ title: 'Outfits' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="color-analysis" options={{ href: null, title: 'Color Analysis' }} />
      <Tabs.Screen name="cpw" options={{ href: null, title: 'Cost Per Wear' }} />
      <Tabs.Screen name="rotation" options={{ href: null, title: 'Seasonal Rotation' }} />
      <Tabs.Screen name="suggestions" options={{ href: null, title: 'Outfit Suggestions' }} />
      <Tabs.Screen name="wishlist" options={{ href: null, title: 'Wishlist' }} />
      <Tabs.Screen name="weather-score" options={{ href: null, title: 'Weather Score' }} />
      <Tabs.Screen name="trends" options={{ href: null, title: 'Trends' }} />
    </ModuleLayoutWrapper>
  );
}
