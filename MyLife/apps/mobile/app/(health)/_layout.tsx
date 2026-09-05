import { Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { JAKARTA_FONTS } from '@mylife/health';
import { colors } from '@mylife/ui';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function HealthLayout() {
  const [fontsLoaded] = useFonts({
    [JAKARTA_FONTS.regular]: PlusJakartaSans_400Regular,
    [JAKARTA_FONTS.medium]: PlusJakartaSans_500Medium,
    [JAKARTA_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [JAKARTA_FONTS.bold]: PlusJakartaSans_700Bold,
    [JAKARTA_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color="#EF4444" />
      </View>
    );
  }

  return (
    <ModuleLayoutWrapper moduleId="health">
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="vitals" options={{ title: 'Vitals' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="sleep" options={{ title: 'Sleep' }} />
      <Tabs.Screen name="mind" options={{ title: 'Mind' }} />
      <Tabs.Screen name="fasting" options={{ href: null, title: 'Fasting' }} />
      <Tabs.Screen name="insights" options={{ href: null, title: 'Insights' }} />
      <Tabs.Screen name="vault" options={{ href: null, title: 'Vault' }} />
      <Tabs.Screen name="add-med" options={{ href: null, title: 'Add Medication' }} />
      <Tabs.Screen name="med-detail" options={{ href: null, title: 'Medication Detail' }} />
      <Tabs.Screen name="mood-check-in" options={{ href: null, title: 'Mood Check-In' }} />
      <Tabs.Screen name="measurement-log" options={{ href: null, title: 'Measurement Log' }} />
      <Tabs.Screen name="emergency-info" options={{ href: null, title: 'Emergency Info' }} />
      <Tabs.Screen name="add-document" options={{ href: null, title: 'Add Document' }} />
      <Tabs.Screen name="document-viewer" options={{ href: null, title: 'Document Viewer' }} />
      <Tabs.Screen name="health-sync-settings" options={{ href: null, title: 'Sync Settings' }} />
      <Tabs.Screen name="export" options={{ href: null, title: 'Export' }} />
      <Tabs.Screen name="goals" options={{ href: null, title: 'Goals' }} />
      <Tabs.Screen name="add-goal" options={{ href: null, title: 'Add Goal' }} />
      <Tabs.Screen name="migration-prompt" options={{ href: null, title: 'Migration' }} />
      <Tabs.Screen name="hrv" options={{ href: null, title: 'HRV' }} />
      <Tabs.Screen name="sleep-stages" options={{ href: null, title: 'Sleep Stages' }} />
      <Tabs.Screen name="breathing" options={{ href: null, title: 'Breathing' }} />
      <Tabs.Screen name="readiness" options={{ href: null, title: 'Readiness' }} />
      <Tabs.Screen name="grounding" options={{ href: null, title: 'Grounding' }} />
      <Tabs.Screen name="smart-alarm" options={{ href: null, title: 'Smart Alarm' }} />
      <Tabs.Screen name="snore" options={{ href: null, title: 'Snore' }} />
      <Tabs.Screen name="body-composition" options={{ href: null, title: 'Body Composition' }} />
      <Tabs.Screen name="cbt" options={{ href: null, title: 'CBT' }} />
      <Tabs.Screen name="vital-detail" options={{ href: null, title: 'Vital Detail' }} />
    </ModuleLayoutWrapper>
  );
}
