import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@mylife/ui';
import { Card } from '@mylife/bestchef/ui';
import { getFollowerCount, getFollowingCount } from '@mylife/bestchef';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useBestChefCloud } from '../../providers/BestChefCloudProvider';
import { useI18n } from '../../i18n/I18nProvider';

interface StatCellProps {
  value: string;
  label: string;
  loading?: boolean;
  onPress?: () => void;
  tc: ReturnType<typeof useThemeColors>;
}

function StatCell({ value, label, loading, onPress, tc }: StatCellProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && onPress ? { opacity: 0.7 } : undefined]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tc.textSecondary} style={styles.shimmer} />
      ) : (
        <Text style={[styles.cellValue, { color: tc.text }]}>{value}</Text>
      )}
      <Text style={[styles.cellLabel, { color: tc.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

interface ProfileStatsRowProps {
  recipesCount: number;
  profileId: string | null;
  isPublic?: boolean;
}

export function ProfileStatsRow({ recipesCount, profileId, isPublic = true }: ProfileStatsRowProps) {
  const router = useRouter();
  const tc = useThemeColors();
  const { supabase } = useBestChefCloud();
  const { t, formatNumber } = useI18n();
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    void getFollowerCount(profileId).then((result) => {
      if (!cancelled && result.ok) setFollowerCount(result.data);
    });

    void getFollowingCount(profileId).then((result) => {
      if (!cancelled && result.ok) setFollowingCount(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [profileId, supabase]);

  const dividerColor = `${tc.textSecondary}2E`;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <StatCell
          value={formatNumber(recipesCount)}
          label={t('Recipes')}
          tc={tc}
        />
        {isPublic ? (
          <>
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <StatCell
              value={followerCount !== null ? formatNumber(followerCount) : '—'}
              label={t('Followers')}
              loading={followerCount === null && !!profileId}
              onPress={() => router.push('/profile/followers')}
              tc={tc}
            />
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <StatCell
              value={followingCount !== null ? formatNumber(followingCount) : '—'}
              label={t('Following')}
              loading={followingCount === null && !!profileId}
              onPress={() => router.push('/profile/following')}
              tc={tc}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 16,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  cellValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
  },
  cellLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  shimmer: {
    height: 24,
  },
  divider: {
    width: 1,
    height: 32,
    alignSelf: 'center',
  },
});
