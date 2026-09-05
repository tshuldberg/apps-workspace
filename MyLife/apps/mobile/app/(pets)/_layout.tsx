import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function PetsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="pets">
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="pets" options={{ title: 'Pets' }} />
      <Tabs.Screen name="health" options={{ title: 'Health' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="reminders" options={{ href: null, title: 'Care Alerts' }} />
      <Tabs.Screen name="pet/add" options={{ href: null, title: 'Add Pet' }} />
      <Tabs.Screen name="pet/[id]" options={{ href: null, title: 'Pet Profile' }} />
      <Tabs.Screen name="vaccinations" options={{ href: null, title: 'Vaccinations' }} />
      <Tabs.Screen name="medications" options={{ href: null, title: 'Medications' }} />
      <Tabs.Screen name="weight" options={{ href: null, title: 'Weight Trends' }} />
      <Tabs.Screen name="feeding" options={{ href: null, title: 'Feeding' }} />
      <Tabs.Screen name="vet-history" options={{ href: null, title: 'Vet History' }} />
      <Tabs.Screen name="expenses" options={{ href: null, title: 'Expenses' }} />
      <Tabs.Screen name="emergency" options={{ href: null, title: 'Emergency' }} />
      <Tabs.Screen name="poster" options={{ href: null, title: 'Lost Pet Poster' }} />
      <Tabs.Screen name="age-calc" options={{ href: null, title: 'Age Calculator' }} />
    </ModuleLayoutWrapper>
  );
}
