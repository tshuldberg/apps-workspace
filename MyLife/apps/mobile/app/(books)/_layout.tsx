import { ActivityIndicator, View } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/books';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { icons } from 'lucide-react-native';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

const HomeIcon = icons.House;
const LibraryIcon = icons.Library;
const SearchIcon = icons.Search;
const BarChartIcon = icons.ChartBar;
const BookOpenIcon = icons.BookOpen;

export default function BooksLayout() {
  const [fontsLoaded] = useFonts({
    [JAKARTA_FONTS.regular]: PlusJakartaSans_400Regular,
    [JAKARTA_FONTS.medium]: PlusJakartaSans_500Medium,
    [JAKARTA_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [JAKARTA_FONTS.bold]: PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.modules.books} />
      </View>
    );
  }

  return (
    <ModuleLayoutWrapper moduleId="books">
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <HomeIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => <LibraryIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <SearchIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size }) => <BarChartIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, size }) => <BookOpenIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="reader/index" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="book/[id]" options={{ href: null }} />
      <Tabs.Screen name="book/add" options={{ href: null }} />
      <Tabs.Screen name="reader/[id]" options={{ href: null }} />
      <Tabs.Screen name="shelf/[id]" options={{ href: null }} />
      <Tabs.Screen name="scan" options={{ href: null }} />
      <Tabs.Screen name="year-review" options={{ href: null }} />
      <Tabs.Screen name="discover" options={{ href: null }} />
      <Tabs.Screen name="challenges" options={{ href: null }} />
      <Tabs.Screen name="clubs" options={{ href: null }} />
      <Tabs.Screen name="club/[id]" options={{ href: null }} />
      <Tabs.Screen name="badges" options={{ href: null }} />
      <Tabs.Screen name="journal/[id]" options={{ href: null }} />
      <Tabs.Screen name="journal/new" options={{ href: null }} />
      <Tabs.Screen name="insights" options={{ href: null }} />
      <Tabs.Screen name="quotes" options={{ href: null }} />
      <Tabs.Screen name="quotes/new" options={{ href: null }} />
      <Tabs.Screen name="share" options={{ href: null }} />
      <Tabs.Screen name="recommendations" options={{ href: null }} />
      <Tabs.Screen name="series" options={{ href: null }} />
      <Tabs.Screen name="series/[id]" options={{ href: null }} />
      <Tabs.Screen name="social" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen name="whats-new" options={{ href: null }} />
      <Tabs.Screen name="onboarding" options={{ href: null }} />
      <Tabs.Screen name="import" options={{ href: null }} />
      <Tabs.Screen name="rate-books" options={{ href: null }} />
      <Tabs.Screen name="friends-challenge" options={{ href: null }} />
    </ModuleLayoutWrapper>
  );
}
