import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import {
  Box,
  CircleUserRound,
  Globe,
  MessageCircle,
  Rss,
  Users,
} from 'lucide-react-native';
import { useAppThemeColors } from '../providers/AppThemeProvider';

function TabIcon({
  Icon,
  color,
  size,
  active,
  accentWash,
}: {
  Icon: typeof Box;
  color: string;
  size: number;
  active?: boolean;
  accentWash: string;
}) {
  if (active) {
    return (
      <View style={[styles.activeIconWrap, { backgroundColor: accentWash }]}>
        <Icon size={size} color={color} strokeWidth={1.75} />
      </View>
    );
  }
  return <Icon size={size} color={color} strokeWidth={1.75} />;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const c = useAppThemeColors();
  const accentWash = c.glass;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: c.surface,
            borderTopColor: c.border,
            height: 56 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarAccessibilityLabel: 'Feed, tab, 1 of 5',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Rss} color={color} size={size} active={focused} accentWash={accentWash} />
          ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: 'Communities',
          tabBarAccessibilityLabel: 'Communities, tab, 2 of 5',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Users} color={color} size={size} active={focused} accentWash={accentWash} />
          ),
        }}
      />
      <Tabs.Screen
        name="public"
        options={{
          title: 'Public',
          tabBarAccessibilityLabel: 'Public, tab, 3 of 5',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Globe} color={color} size={size} active={focused} accentWash={accentWash} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarAccessibilityLabel: 'Messages, tab, 4 of 5',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={MessageCircle} color={color} size={size} active={focused} accentWash={accentWash} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarAccessibilityLabel: 'Me, tab, 5 of 5',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={CircleUserRound} color={color} size={size} active={focused} accentWash={accentWash} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="friends"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="add-friend"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="add-in-person"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="about-status"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="transport-diagnostics"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="node"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="share"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="identity"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="channel/[communityId]/[channelId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="room/[communityId]/[channelId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="call"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="calls"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="dm/[conversationId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="community/join"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="community/[communityId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="community/[communityId]/settings"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="community/[communityId]/layout-editor"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="community/[communityId]/pages"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="community/[communityId]/page/[canvasId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="community/[communityId]/member/[deviceId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="files/[communityId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="downloads"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="storage"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="storage/add-destination"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="storage/destination/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="storage/backup"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="storage/restore"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="post/[communityId]/[channelId]/[postId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="public/[publicationId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="public/[publicationId]/[channelId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="public/post/[publicationId]/[channelId]/[postId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="library"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="library/[channelId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="library/item/[itemId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="library/play/[itemId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="library/reader/[itemId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="appearance"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="theme-editor"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  activeIconWrap: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
