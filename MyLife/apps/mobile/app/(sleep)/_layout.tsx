import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function SleepLayout() {
  return (
    <ModuleLayoutWrapper moduleId="sleep">
      <Tabs.Screen name="index" options={{ title: 'Sleep Log' }} />
      <Tabs.Screen name="dreams" options={{ title: 'Dreams' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="log" options={{ href: null, title: 'Log Sleep' }} />
      <Tabs.Screen
        name="entry/[id]"
        options={{ href: null, title: 'Sleep Entry' }}
      />
      <Tabs.Screen
        name="entry/edit/[id]"
        options={{ href: null, title: 'Edit Sleep Log' }}
      />
      <Tabs.Screen name="dream/log" options={{ href: null, title: 'Log Dream' }} />
      <Tabs.Screen
        name="dream/patterns"
        options={{ href: null, title: 'Dream Patterns' }}
      />
      <Tabs.Screen
        name="dream/dictionary"
        options={{ href: null, title: 'Dream Dictionary' }}
      />
      <Tabs.Screen
        name="dream/[id]"
        options={{ href: null, title: 'Dream' }}
      />
      <Tabs.Screen
        name="factors/log"
        options={{ href: null, title: 'Sleep Factors' }}
      />
      <Tabs.Screen
        name="science/chronotype"
        options={{ href: null, title: 'Chronotype' }}
      />
      <Tabs.Screen
        name="science/jet-lag"
        options={{ href: null, title: 'Jet Lag' }}
      />
      <Tabs.Screen
        name="science/shift-work"
        options={{ href: null, title: 'Shift Work' }}
      />
      <Tabs.Screen
        name="review/[year]"
        options={{ href: null, title: 'Year Review' }}
      />
      <Tabs.Screen
        name="review/share"
        options={{ href: null, title: 'Share Sleep Card' }}
      />
      <Tabs.Screen
        name="nap/log"
        options={{ href: null, title: 'Log Nap' }}
      />
      <Tabs.Screen
        name="nap/history"
        options={{ href: null, title: 'Nap History' }}
      />
      <Tabs.Screen
        name="hygiene"
        options={{ href: null, title: 'Sleep Hygiene' }}
      />
    </ModuleLayoutWrapper>
  );
}
