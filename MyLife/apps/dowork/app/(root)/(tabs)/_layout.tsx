import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Dumbbell, Home, LineChart, Settings, Search, Users } from 'lucide-react-native';
import { useAppThemeColors } from '../providers/AppThemeProvider';
import { DW_ACCENT, DW_SURFACES } from '../theme/tokens';

type TabIconProps = {
  Icon: typeof Home;
  color: string;
  size: number;
  active?: boolean;
};

function TabIcon({ Icon, color, size, active }: TabIconProps) {
  if (active) {
    return (
      <View style={[styles.activeIconWrap, { backgroundColor: `${DW_ACCENT}1F` }]}>
        <Icon size={size} color={color} strokeWidth={2.4} />
      </View>
    );
  }
  return <Icon size={size} color={color} strokeWidth={2} />;
}

export default function TabLayout() {
  const tc = useAppThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: DW_ACCENT,
        tabBarInactiveTintColor: tc.textTertiary,
        tabBarStyle: [styles.tabBar, { backgroundColor: DW_SURFACES.lowest }],
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Home} color={color} size={size} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Search} color={color} size={size} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Dumbbell} color={color} size={size} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="trainers"
        options={{
          title: 'Trainers',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Users} color={color} size={size} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={LineChart} color={color} size={size} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Settings} color={color} size={size} active={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0,
    elevation: 0,
    height: 90,
    paddingBottom: 28,
    paddingTop: 10,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  activeIconWrap: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
