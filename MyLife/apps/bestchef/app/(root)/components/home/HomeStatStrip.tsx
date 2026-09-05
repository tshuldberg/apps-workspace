import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatPill } from '@mylife/bestchef/ui';
import { HERO_GRADIENT, GOLD_GRADIENT } from '@mylife/bestchef';
import { Flame, Trophy, CheckSquare } from 'lucide-react-native';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { useCookStreak, useChefRank, useReviewedCount } from '../../hooks/useHomeStats';

const SUCCESS_GREEN = '#22C55E';

function formatStatValue(value: number | null, loading: boolean, prefix = ''): string {
  if (loading) return '--';
  if (value === null) return '--';
  return `${prefix}${value}`;
}

export function HomeStatStrip() {
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useI18n();

  const streak = useCookStreak();
  const rank = useChefRank();
  const reviewed = useReviewedCount();

  return (
    <View style={styles.row}>
      <StatPill
        icon={<Flame size={16} color={HERO_GRADIENT.from} fill={HERO_GRADIENT.from} />}
        tint={HERO_GRADIENT.from}
        value={formatStatValue(streak.value, streak.loading)}
        caption={t('Day streak')}
      />

      <Pressable
        style={styles.pillPressable}
        onPress={() => router.push('/(tabs)/leaderboard')}
        hitSlop={4}
      >
        <StatPill
          icon={<Trophy size={16} color={GOLD_GRADIENT.from} fill={GOLD_GRADIENT.from} />}
          tint={GOLD_GRADIENT.from}
          value={formatStatValue(rank.value, rank.loading, '#')}
          caption={t('Your rank')}
          style={styles.pillFlex}
        />
      </Pressable>

      <Pressable
        style={styles.pillPressable}
        onPress={() => router.push('/(tabs)/profile')}
        hitSlop={4}
      >
        <StatPill
          icon={<CheckSquare size={16} color={SUCCESS_GREEN} fill="transparent" />}
          tint={SUCCESS_GREEN}
          value={formatStatValue(reviewed.value, reviewed.loading)}
          caption={t('Reviews')}
          style={styles.pillFlex}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  pillPressable: {
    flex: 1,
  },
  pillFlex: {
    flex: 1,
  },
});
