import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function SportsLayout() {
  return (
    <ModuleLayoutWrapper moduleId="sports">
      <Tabs.Screen name="index" options={{ title: 'Scores' }} />
      <Tabs.Screen name="teams" options={{ title: 'Teams' }} />
      <Tabs.Screen name="betting" options={{ title: 'Betting' }} />
      <Tabs.Screen name="fantasy" options={{ title: 'Fantasy' }} />
      <Tabs.Screen name="play" options={{ title: 'Play' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="team/[id]" options={{ href: null }} />
      <Tabs.Screen name="standings" options={{ href: null, title: 'Standings' }} />
      <Tabs.Screen name="schedule" options={{ href: null, title: 'Schedule' }} />
      <Tabs.Screen name="game/[id]" options={{ href: null, title: 'Game' }} />
      <Tabs.Screen name="history" options={{ href: null, title: 'History' }} />
      <Tabs.Screen name="bet/log" options={{ href: null, title: 'Log bet' }} />
      <Tabs.Screen name="bet/parlay" options={{ href: null, title: 'Build parlay' }} />
      <Tabs.Screen name="bet/[id]" options={{ href: null, title: 'Bet' }} />
      <Tabs.Screen name="betting/history" options={{ href: null, title: 'Bet history' }} />
      <Tabs.Screen name="betting/analytics" options={{ href: null, title: 'Analytics' }} />
      <Tabs.Screen name="betting/limits" options={{ href: null, title: 'Betting limits' }} />
      <Tabs.Screen name="betting/futures" options={{ href: null, title: 'Futures' }} />
      <Tabs.Screen name="betting/props" options={{ href: null, title: 'Props' }} />
      <Tabs.Screen name="fantasy/add" options={{ href: null, title: 'Add league' }} />
      <Tabs.Screen name="fantasy/[id]" options={{ href: null, title: 'League' }} />
      <Tabs.Screen name="play/log" options={{ href: null, title: 'Log session' }} />
      <Tabs.Screen name="play/[id]" options={{ href: null, title: 'Session' }} />
      <Tabs.Screen name="play/leagues" options={{ href: null, title: 'Rec leagues' }} />
      <Tabs.Screen name="play/leagues/add" options={{ href: null, title: 'Add league' }} />
      <Tabs.Screen name="play/leagues/[id]" options={{ href: null, title: 'League' }} />
      <Tabs.Screen name="events" options={{ href: null, title: 'Events' }} />
      <Tabs.Screen name="events/log" options={{ href: null, title: 'Log attendance' }} />
      <Tabs.Screen name="events/[id]" options={{ href: null, title: 'Attendance' }} />
      <Tabs.Screen name="events/venues" options={{ href: null, title: 'Venues' }} />
      <Tabs.Screen name="events/venues/[id]" options={{ href: null, title: 'Venue' }} />
      <Tabs.Screen name="events/memorabilia" options={{ href: null, title: 'Memorabilia' }} />
      <Tabs.Screen name="events/memorabilia/add" options={{ href: null, title: 'Add item' }} />
      <Tabs.Screen name="events/memorabilia/[id]" options={{ href: null, title: 'Item' }} />
      <Tabs.Screen name="events/watch-party" options={{ href: null, title: 'Watch parties' }} />
    </ModuleLayoutWrapper>
  );
}
