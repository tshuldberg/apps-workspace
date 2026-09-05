import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function CarLayout() {
  return (
    <ModuleLayoutWrapper moduleId="car">
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="garage" options={{ title: 'Vehicles' }} />
      <Tabs.Screen name="fuel" options={{ title: 'Fuel' }} />
      <Tabs.Screen name="maintenance" options={{ title: 'Service' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="reminders" options={{ href: null, title: 'Maintenance Alerts' }} />
      <Tabs.Screen name="expenses" options={{ href: null, title: 'Cost Analytics' }} />
      <Tabs.Screen name="trips" options={{ href: null, title: 'Trips' }} />
      <Tabs.Screen name="service-history" options={{ href: null, title: 'Service History' }} />
      <Tabs.Screen name="service/add" options={{ href: null, title: 'Add Service' }} />
      <Tabs.Screen name="fuel/add" options={{ href: null, title: 'Add Fuel' }} />
      <Tabs.Screen name="trip/add" options={{ href: null, title: 'Log Trip' }} />
      <Tabs.Screen name="document/add" options={{ href: null, title: 'Add Document' }} />
      <Tabs.Screen name="parking" options={{ href: null, title: 'Parking Saver' }} />
      <Tabs.Screen name="vin" options={{ href: null, title: 'VIN Decoder' }} />
      <Tabs.Screen name="obd" options={{ href: null, title: 'OBD-II' }} />
      <Tabs.Screen name="vehicle/add" options={{ href: null, title: 'Add Vehicle' }} />
      <Tabs.Screen name="vehicle/[id]" options={{ href: null }} />
      <Tabs.Screen name="diagnostics" options={{ href: null, title: 'Diagnostics' }} />
      <Tabs.Screen name="diagnostics/[id]" options={{ href: null, title: 'Snapshot' }} />
      <Tabs.Screen name="live-data" options={{ href: null, title: 'Live Data' }} />
      <Tabs.Screen name="vin-decoder" options={{ href: null, title: 'VIN Decoder' }} />
      <Tabs.Screen name="gps-dashboard" options={{ href: null, title: 'GPS Trips' }} />
      <Tabs.Screen name="tires" options={{ href: null, title: 'Tires' }} />
      <Tabs.Screen name="documents" options={{ href: null, title: 'Documents' }} />
      <Tabs.Screen name="parking-history" options={{ href: null, title: 'Parking' }} />
      <Tabs.Screen name="cost-analytics" options={{ href: null, title: 'Cost Analytics' }} />
      <Tabs.Screen name="fuel-prices" options={{ href: null, title: 'Fuel Prices' }} />
    </ModuleLayoutWrapper>
  );
}
