import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Award, LineChart, UtensilsCrossed } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@mylife/ui';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';

export type ProfileTab = 'recipes' | 'badges' | 'activity';

interface TabDef {
  id: ProfileTab;
  labelKey: 'Recipes' | 'Badges' | 'Activity';
  Icon: typeof UtensilsCrossed;
}

const TABS: TabDef[] = [
  { id: 'recipes', labelKey: 'Recipes', Icon: UtensilsCrossed },
  { id: 'badges', labelKey: 'Badges', Icon: Award },
  { id: 'activity', labelKey: 'Activity', Icon: LineChart },
];

interface Props {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

export function ProfileSubTabs({ active, onChange }: Props) {
  const tc = useThemeColors();
  const { t } = useI18n();

  // One animated opacity value per tab for a 200ms fade on selection
  const opacityRefs = useRef<Record<ProfileTab, Animated.Value>>({
    recipes: new Animated.Value(active === 'recipes' ? 1 : 0),
    badges: new Animated.Value(active === 'badges' ? 1 : 0),
    activity: new Animated.Value(active === 'activity' ? 1 : 0),
  }).current;

  function handlePress(tab: ProfileTab) {
    if (tab === active) return;
    const prev = active;
    onChange(tab);
    Animated.parallel([
      Animated.timing(opacityRefs[prev], { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityRefs[tab], { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: tc.surfaceElevated },
      ]}
    >
      {TABS.map(({ id, labelKey, Icon }) => {
        const isActive = active === id;
        return (
          <Pressable
            key={id}
            style={styles.pill}
            onPress={() => handlePress(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            {/* Gradient fill layer — fades in/out */}
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.gradientWrapper, { opacity: opacityRefs[id] }]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <Icon
              size={12}
              strokeWidth={2.2}
              color={isActive ? '#FFFFFF' : tc.textSecondary}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? '#FFFFFF' : tc.textSecondary },
              ]}
            >
              {t(labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 2,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  gradientWrapper: {
    borderRadius: 10,
  },
  label: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
  },
});
