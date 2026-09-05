import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Trophy, UtensilsCrossed, Globe, MapPin } from 'lucide-react-native';
import { BCSectionHeader } from '@mylife/bestchef/ui';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef/ui';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';

type LeaderboardKind = 'allTime' | 'dish' | 'cuisine' | 'region';

interface TileConfig {
  kind: LeaderboardKind;
  titleKey: string;
  sample: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
}

const TILES: TileConfig[] = [
  {
    kind: 'allTime',
    titleKey: 'All Time',
    sample: 'Greatest of all time',
    Icon: Trophy,
  },
  {
    kind: 'dish',
    titleKey: 'By Dish',
    sample: 'Pad Thai \u00b7 Ramen \u00b7 Tacos',
    Icon: UtensilsCrossed,
  },
  {
    kind: 'cuisine',
    titleKey: 'By Cuisine',
    sample: 'Italian \u00b7 Thai \u00b7 Mexican',
    Icon: Globe,
  },
  {
    kind: 'region',
    titleKey: 'By Region',
    sample: 'California \u00b7 Tokyo \u00b7 Paris',
    Icon: MapPin,
  },
];

export function LeaderboardShortcuts() {
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useI18n();

  return (
    <View style={styles.section}>
      <BCSectionHeader
        title={t('Leaderboards')}
        subtitle={t('Climb the Top 100')}
      />
      <View style={styles.grid}>
        {TILES.map(({ kind, titleKey, sample, Icon }) => (
          <Pressable
            key={kind}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: tc.surfaceElevated, borderColor: tc.border },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push(`/(tabs)/leaderboard?kind=${kind}`)}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${HERO_GRADIENT.from}2E` }]}>
              <Icon size={16} color={HERO_GRADIENT.from} strokeWidth={2.5} />
            </View>
            <View style={styles.tileBody}>
              <Text style={[styles.tileTitle, { color: tc.text }]}>
                {t(titleKey as Parameters<typeof t>[0])}
              </Text>
              <Text style={[styles.tileSample, { color: tc.textSecondary }]} numberOfLines={1}>
                {sample}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 18,
  },
  tile: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: { gap: 2 },
  tileTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
  },
  tileSample: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
  },
});
