import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { colors } from '@mylife/ui';
import { JAKARTA_FONTS, GARDEN_ACCENT } from '@mylife/garden';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function GardenLayout() {
  const [fontsLoaded] = useFonts({
    [JAKARTA_FONTS.regular]: PlusJakartaSans_400Regular,
    [JAKARTA_FONTS.medium]: PlusJakartaSans_500Medium,
    [JAKARTA_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [JAKARTA_FONTS.bold]: PlusJakartaSans_700Bold,
    [JAKARTA_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={GARDEN_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleLayoutWrapper moduleId="garden">
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="plants" options={{ title: 'Plants' }} />
      <Tabs.Screen name="watering" options={{ title: 'Watering' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="journal" options={{ href: null, title: 'Journal' }} />
      <Tabs.Screen name="plant/[id]" options={{ href: null, title: 'Plant' }} />
      <Tabs.Screen name="add-plant" options={{ href: null, title: 'Add Plant' }} />
      <Tabs.Screen name="zones" options={{ href: null, title: 'Zones' }} />
      <Tabs.Screen name="zone/[id]" options={{ href: null, title: 'Zone' }} />
      <Tabs.Screen name="diagnose" options={{ href: null, title: 'Diagnose' }} />
      <Tabs.Screen name="diagnosis/[id]" options={{ href: null, title: 'Diagnosis' }} />
      <Tabs.Screen name="companions" options={{ href: null, title: 'Companion Guide' }} />
      <Tabs.Screen name="companion-matrix" options={{ href: null, title: 'Companion Matrix' }} />
      <Tabs.Screen name="companion-check" options={{ href: null, title: 'Compatibility' }} />
      <Tabs.Screen name="layouts" options={{ href: null, title: 'Layouts' }} />
      <Tabs.Screen name="layout/[id]" options={{ href: null, title: 'Layout' }} />
      <Tabs.Screen name="propagations" options={{ href: null, title: 'Propagations' }} />
      <Tabs.Screen name="propagation/[id]" options={{ href: null, title: 'Propagation' }} />
      <Tabs.Screen name="frost" options={{ href: null, title: 'Weather & Frost' }} />
      <Tabs.Screen name="harvests" options={{ href: null, title: 'Harvests' }} />
      <Tabs.Screen name="harvest/add" options={{ href: null, title: 'Log Harvest' }} />
      <Tabs.Screen name="wishlist" options={{ href: null, title: 'Wish List' }} />
      <Tabs.Screen name="seeds" options={{ href: null, title: 'Seeds' }} />
      <Tabs.Screen name="light-meter" options={{ href: null, title: 'Light Levels' }} />
      <Tabs.Screen name="identify" options={{ href: null, title: 'Identify' }} />
      <Tabs.Screen name="seasonal" options={{ href: null, title: 'Calendar' }} />
      <Tabs.Screen name="photos" options={{ href: null, title: 'Garden Photos' }} />
      <Tabs.Screen name="export" options={{ href: null, title: 'Export Data' }} />
    </ModuleLayoutWrapper>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
