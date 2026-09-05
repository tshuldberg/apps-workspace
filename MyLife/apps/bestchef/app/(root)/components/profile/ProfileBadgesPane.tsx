import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@mylife/ui';
import { getAllBadgesForChef, JAKARTA_FONTS } from '@mylife/bestchef';
import type { ChefBadgeDisplay } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../../providers/AppThemeProvider';
import { useBestChefCloud } from '../../providers/BestChefCloudProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { localizedBadgeName, localizedBadgeDescription } from '../../i18n/badge-labels';

interface Props {
  chefId: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function BadgeCard({ badge }: { badge: ChefBadgeDisplay }) {
  const tc = useThemeColors();
  const { t } = useI18n();
  const earned = badge.earned;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tc.surfaceElevated, borderColor: tc.border },
        !earned && styles.cardLocked,
      ]}
    >
      <View style={styles.circleContainer}>
        {earned ? (
          <LinearGradient
            colors={[hexToRgba(badge.tint, 0.4), hexToRgba(badge.tint, 0.15)]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.circle}
          >
            <Text style={[styles.icon, { color: badge.tint }]}>{badge.icon}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.circle, { backgroundColor: tc.surface }]}>
            <Text style={[styles.icon, { color: tc.textSecondary, opacity: 0.5 }]}>{badge.icon}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.name, { color: earned ? tc.text : tc.textSecondary }]} numberOfLines={2}>
        {localizedBadgeName(t, badge.id, badge.name)}
      </Text>
      <Text style={[styles.description, { color: tc.textSecondary }]} numberOfLines={2}>
        {localizedBadgeDescription(t, badge.id, badge.description)}
      </Text>

      {!earned && (
        <View style={[styles.lockedPill, { backgroundColor: tc.surfaceElevated }]}>
          <Text style={[styles.lockedText, { color: tc.textSecondary }]}>{t('Locked')}</Text>
        </View>
      )}
    </View>
  );
}

function SkeletonCard() {
  const tc = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: tc.surfaceElevated, borderColor: tc.border }]}>
      <View style={[styles.circle, { backgroundColor: tc.surface }]} />
      <View style={[styles.skeletonLine, { backgroundColor: tc.surface, width: '60%' }]} />
      <View style={[styles.skeletonLine, { backgroundColor: tc.surface, width: '80%' }]} />
    </View>
  );
}

export function ProfileBadgesPane({ chefId }: Props) {
  const tc = useThemeColors();
  const theme = useTheme();
  const cloud = useBestChefCloud();
  const { t } = useI18n();
  const [badges, setBadges] = useState<ChefBadgeDisplay[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cloud.supabase) return;
    let cancelled = false;
    setLoading(true);
    void getAllBadgesForChef(cloud.supabase, chefId)
      .then((result) => {
        if (!cancelled && result.ok) setBadges(result.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cloud.supabase, chefId]);

  if (loading) {
    return (
      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    );
  }

  if (badges.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
        <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No badges yet')}</Text>
        <Text style={[styles.emptyMessage, { color: tc.textSecondary }]}>
          {t('Submit recipes and engage with the community to earn badges.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {badges.map((badge) => (
        <BadgeCard key={badge.id} badge={badge} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%' as unknown as number,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  cardLocked: { opacity: 0.7 },
  circleContainer: { marginBottom: 2 },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: { fontSize: 26, fontWeight: '700' },
  name: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 17,
  },
  description: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  lockedPill: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  lockedText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 5,
  },
  emptyCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16, marginTop: 4 },
  emptyMessage: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center' },
});
