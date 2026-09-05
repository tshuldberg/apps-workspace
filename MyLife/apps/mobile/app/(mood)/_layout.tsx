import { ActivityIndicator, View } from 'react-native';
import { Tabs } from 'expo-router';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { colors } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/mood';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

const MOOD_ACCENT = colors.modules.mood;

export default function MoodLayout() {
  const [fontsLoaded] = useFonts({
    [JAKARTA_FONTS.regular]: PlusJakartaSans_400Regular,
    [JAKARTA_FONTS.medium]: PlusJakartaSans_500Medium,
    [JAKARTA_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [JAKARTA_FONTS.bold]: PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={MOOD_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleLayoutWrapper moduleId="mood">
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="breathing" options={{ title: 'Breathe' }} />
      <Tabs.Screen name="pet" options={{ title: 'Pet' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="log-mood" options={{ href: null, title: 'Log Mood' }} />
      <Tabs.Screen name="day-detail" options={{ href: null, title: 'Day Detail' }} />
      <Tabs.Screen name="experiments" options={{ href: null, title: 'Experiments' }} />
      <Tabs.Screen name="experiment-designer" options={{ href: null, title: 'New Experiment' }} />
      <Tabs.Screen name="experiment-results" options={{ href: null, title: 'Experiment Results' }} />
      <Tabs.Screen name="history" options={{ href: null, title: 'History' }} />
      <Tabs.Screen name="lock-screen" options={{ href: null, title: '' }} />
      <Tabs.Screen name="lock-settings" options={{ href: null, title: 'Privacy Lock' }} />
      <Tabs.Screen name="insights-feed" options={{ href: null, title: 'Insight Detail' }} />
      <Tabs.Screen name="year-pixels" options={{ href: null, title: 'Year in Pixels' }} />
      <Tabs.Screen name="weekly-report" options={{ href: null, title: 'Weekly Report' }} />
      <Tabs.Screen name="suggestions" options={{ href: null, title: 'Suggestions' }} />
      <Tabs.Screen name="top-emotions" options={{ href: null, title: 'Top Emotions' }} />
      <Tabs.Screen name="onboarding" options={{ href: null, title: 'Welcome to MyMood' }} />
      <Tabs.Screen name="meditation" options={{ href: null, title: 'Meditation' }} />
      <Tabs.Screen name="meditation-session" options={{ href: null, title: 'Meditation Session' }} />
      <Tabs.Screen name="focus" options={{ href: null, title: 'Focus Sounds' }} />
      <Tabs.Screen name="focus-session" options={{ href: null, title: 'Focus Session' }} />
      <Tabs.Screen name="sos" options={{ href: null, title: 'SOS' }} />
      <Tabs.Screen name="emergency-contacts" options={{ href: null, title: 'Emergency Contacts' }} />
    </ModuleLayoutWrapper>
  );
}
