import { ActivityIndicator, View } from 'react-native';
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
import { JAKARTA_FONTS, RECIPES_ACCENT } from '@mylife/bestchef';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function RecipesLayout() {
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
        <ActivityIndicator color={RECIPES_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleLayoutWrapper moduleId="recipes">
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="recipes-tab" options={{ title: 'Recipes' }} />
      <Tabs.Screen name="meal-plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="shopping-lists" options={{ title: 'Shop' }} />
      <Tabs.Screen name="pantry" options={{ title: 'Pantry' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
      <Tabs.Screen name="recipe/[id]" options={{ href: null, title: 'Recipe' }} />
      <Tabs.Screen name="add-recipe" options={{ href: null, title: 'Add Recipe' }} />
      <Tabs.Screen name="cooking-mode" options={{ href: null, title: 'Cooking Mode' }} />
      <Tabs.Screen name="import-source" options={{ href: null, title: 'Import Recipe' }} />
      <Tabs.Screen name="import-review" options={{ href: null, title: 'Review Import' }} />
      <Tabs.Screen name="import-photo" options={{ href: null, title: 'Photo Import' }} />
      <Tabs.Screen name="import-video" options={{ href: null, title: 'Video Import' }} />
      <Tabs.Screen name="shopping-list" options={{ href: null, title: 'Shopping List' }} />
      <Tabs.Screen name="collections" options={{ href: null, title: 'Collections' }} />
      <Tabs.Screen name="dish-browser" options={{ href: null, title: 'Browse Dishes' }} />
      <Tabs.Screen name="dish/[id]" options={{ href: null, title: 'Dish Detail' }} />
      <Tabs.Screen name="submit" options={{ href: null, title: 'Submit Recipe' }} />
      <Tabs.Screen name="leaderboard" options={{ href: null, title: 'Leaderboard' }} />
      <Tabs.Screen name="chef-profile" options={{ href: null, title: 'Chef Profile' }} />
      <Tabs.Screen name="chef-discover" options={{ href: null, title: 'Discover Chefs' }} />
      <Tabs.Screen name="my-chef-profile" options={{ href: null, title: 'My Chef Profile' }} />
      <Tabs.Screen name="report-modal" options={{ href: null, title: 'Report' }} />
      <Tabs.Screen name="community-notes" options={{ href: null, title: 'Community Notes' }} />
      <Tabs.Screen name="comments" options={{ href: null, title: 'Comments' }} />
      <Tabs.Screen name="remix" options={{ href: null, title: 'Remix Recipe' }} />
      <Tabs.Screen name="recipe-lineage" options={{ href: null, title: 'Recipe Lineage' }} />
      <Tabs.Screen name="tip" options={{ href: null, title: 'Tip' }} />
      <Tabs.Screen name="creator-dashboard" options={{ href: null, title: 'Creator Dashboard' }} />
      <Tabs.Screen name="subscription-tiers" options={{ href: null, title: 'Subscription Tiers' }} />
      <Tabs.Screen name="creator-posts" options={{ href: null, title: 'Posts' }} />
      <Tabs.Screen name="creator-apply" options={{ href: null, title: 'Creator Application' }} />
      <Tabs.Screen name="order-ingredients" options={{ href: null, title: 'Order Ingredients' }} />
      <Tabs.Screen name="challenges" options={{ href: null, title: 'Challenges' }} />
    </ModuleLayoutWrapper>
  );
}
