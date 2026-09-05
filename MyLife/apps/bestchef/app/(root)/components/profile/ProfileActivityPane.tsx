import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Text } from '@mylife/ui';
import { getProfileActivity, JAKARTA_FONTS } from '@mylife/bestchef';
import type { ActivityEntry } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { relativeTimeParts } from '../../utils/relative-time';
import { renderActivityCopy } from '../../i18n/notification-copy';

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

function ActivityRow({ entry, isLast }: { entry: ActivityEntry; isLast: boolean }) {
  const tc = useThemeColors();
  const router = useRouter();
  const { t, tp, language, formatRelativeTime } = useI18n();
  const rel = relativeTimeParts(entry.occurredAt);
  // Typed entries (kind+params) render in the app language; legacy entries
  // fall back to the server-baked copy (plan 33 Phase 2.1).
  const copy = renderActivityCopy(entry, t, (isoDate) => {
    try {
      return new Date(isoDate).toLocaleDateString(language, { month: 'short', day: 'numeric' });
    } catch {
      return isoDate;
    }
  }, tp);

  function handlePress() {
    if (entry.targetRoute) {
      router.push(entry.targetRoute as Parameters<typeof router.push>[0]);
    }
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && entry.targetRoute ? { opacity: 0.75 } : {}]}
        onPress={handlePress}
        accessibilityRole={entry.targetRoute ? 'button' : 'none'}
        disabled={!entry.targetRoute}
      >
        <View style={[styles.iconCircle, { backgroundColor: hexToRgba(entry.tint, 0.16) }]}>
          <Text style={[styles.iconText, { color: entry.tint }]}>{entry.icon}</Text>
        </View>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: tc.text }]} numberOfLines={1}>
            {copy.title}
          </Text>
          <Text style={[styles.subtitle, { color: tc.textSecondary }]} numberOfLines={1}>
            {copy.subtitle}
          </Text>
        </View>
        <Text style={[styles.timeAgo, { color: tc.textSecondary }]}>
          {rel.isNow ? t('now') : formatRelativeTime(rel.value, rel.unit)}
        </Text>
      </Pressable>
      {!isLast && <View style={[styles.divider, { backgroundColor: tc.border }]} />}
    </>
  );
}

function SkeletonRow({ isLast }: { isLast: boolean }) {
  const tc = useThemeColors();
  return (
    <>
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: tc.surface }]} />
        <View style={styles.textBlock}>
          <View style={[styles.skeletonTitle, { backgroundColor: tc.surface }]} />
          <View style={[styles.skeletonSubtitle, { backgroundColor: tc.surface }]} />
        </View>
      </View>
      {!isLast && <View style={[styles.divider, { backgroundColor: tc.border }]} />}
    </>
  );
}

export function ProfileActivityPane({ chefId }: Props) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getProfileActivity({ chefId, limit: 20 })
      .then((result) => {
        if (!cancelled && result.ok) setEntries(result.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [chefId]);

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonRow key={i} isLast={i === 3} />
        ))}
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
        <Sparkles size={28} color={tc.textTertiary} strokeWidth={1.5} />
        <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No activity yet')}</Text>
        <Text style={[styles.emptyMessage, { color: tc.textSecondary }]}>
          {t('Your recent achievements will show up here')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
      {entries.map((entry, idx) => (
        <ActivityRow key={entry.id} entry={entry} isLast={idx === entries.length - 1} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 14,
    fontWeight: '700',
  },
  textBlock: { flex: 1, gap: 2 },
  title: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
  },
  timeAgo: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    lineHeight: 14,
    flexShrink: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  skeletonTitle: { height: 12, borderRadius: 6, width: '55%' },
  skeletonSubtitle: { height: 10, borderRadius: 5, width: '75%' },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16, marginTop: 4 },
  emptyMessage: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center' },
});
