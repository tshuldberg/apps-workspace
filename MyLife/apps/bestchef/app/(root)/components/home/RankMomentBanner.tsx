/**
 * In-app rank-change trophy moment (plan 33 Phase 5.5).
 *
 * When an unread rank_up / rank_milestone notification exists, the home
 * tab celebrates it inline instead of leaving it buried in the bell.
 * Dismissing (or opening) the moment marks the notification read, so it
 * shows exactly once per rank change and pairs with Phase 4 push later.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { TrendingUp, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getNotificationFeed,
  markNotificationRead,
  HERO_GRADIENT,
  JAKARTA_FONTS,
  type NotificationViewModel,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useBestChefCloud } from '../../providers/BestChefCloudProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { renderNotificationCopy } from '../../i18n/notification-copy';

const RANK_KINDS = new Set(['rank_up', 'rank_milestone']);

export function RankMomentBanner() {
  const cloud = useBestChefCloud();
  const router = useRouter();
  const { t, tp } = useI18n();
  const [moment, setMoment] = useState<NotificationViewModel | null>(null);

  // Focus-scoped so a rank change landing mid-session still celebrates
  // the next time the user returns to Home.
  useFocusEffect(
    useCallback(() => {
      if (!cloud.isReady || !cloud.userId || !cloud.supabase) return;
      const supabase = cloud.supabase;
      const userId = cloud.userId;
      let cancelled = false;
      void getNotificationFeed(supabase, { userId, limit: 20 })
        .then((result) => {
          if (cancelled || !result.ok) return;
          const fresh = result.data.find((n) => !n.isRead && RANK_KINDS.has(n.kind));
          if (fresh) setMoment(fresh);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }, [cloud.isReady, cloud.supabase, cloud.userId]),
  );

  if (!moment) return null;

  const copy = renderNotificationCopy(moment, t, tp);

  const settle = () => {
    setMoment(null);
    if (cloud.supabase) void markNotificationRead(cloud.supabase, { id: moment.id }).catch(() => {});
  };

  const open = () => {
    settle();
    if (moment.targetRoute) {
      router.push(moment.targetRoute as never);
    } else {
      router.push('/(tabs)/leaderboard' as never);
    }
  };

  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={copy.title}>
      <LinearGradient
        colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.banner}
      >
        <View style={styles.iconWrap}>
          <TrendingUp size={20} color="#fff" strokeWidth={2.5} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>{copy.title}</Text>
          {copy.body ? (
            <Text style={styles.subtitle} numberOfLines={1}>{copy.body}</Text>
          ) : null}
        </View>
        <Pressable
          hitSlop={10}
          onPress={settle}
          accessibilityRole="button"
          accessibilityLabel={t('Dismiss')}
        >
          <X size={18} color="rgba(255,255,255,0.85)" strokeWidth={2.5} />
        </Pressable>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14, color: '#fff' },
  subtitle: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
});
