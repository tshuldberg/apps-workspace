import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@mylife/ui';
import { Card } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS, getChefBestRank, getChefAggregateStats } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';

interface Stats {
  bestRank: number | null;
  totalUpvotes: number;
  totalReviewed: number;
  avgScore: number;
}

interface Props {
  chefId: string;
}

export function ChefStatsCard({ chefId }: Props) {
  const tc = useThemeColors();
  const { t, formatNumber } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getChefBestRank(chefId),
      getChefAggregateStats(chefId),
    ]).then(([rankResult, aggResult]) => {
      if (cancelled) return;
      setStats({
        bestRank: rankResult.ok ? rankResult.data : null,
        totalUpvotes: aggResult.ok ? aggResult.data.totalUpvotes : 0,
        totalReviewed: aggResult.ok ? aggResult.data.totalReviewed : 0,
        avgScore: aggResult.ok ? aggResult.data.avgScore : 0,
      });
    }).catch(() => {
      if (!cancelled) setStats({ bestRank: null, totalUpvotes: 0, totalReviewed: 0, avgScore: 0 });
    });
    return () => { cancelled = true; };
  }, [chefId]);

  const cells: Array<{ value: string; label: string }> = [
    {
      value: stats?.bestRank != null ? `#${stats.bestRank}` : '—',
      label: t('Best Rank'),
    },
    {
      value: stats ? formatNumber(stats.totalUpvotes) : '—',
      label: t('Total Upvotes'),
    },
    {
      value: stats ? formatNumber(stats.totalReviewed) : '—',
      label: t('Total Reviewed'),
    },
    {
      value: stats ? stats.avgScore.toFixed(1) : '—',
      label: t('Avg Score'),
    },
  ];

  return (
    <Card>
      <View style={styles.row}>
        {cells.map((cell, i) => (
          <View key={cell.label} style={styles.cellWrap}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: tc.border ?? 'rgba(255,255,255,0.08)' }]} />}
            <View style={styles.cell}>
              <Text style={[styles.value, { color: tc.text }]}>{cell.value}</Text>
              <Text style={[styles.label, { color: tc.textSecondary }]}>{cell.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cellWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 32,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  value: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
  },
  label: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});
