import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, BellOff, X } from 'lucide-react-native';
import {
  getNotificationFeed,
  markAllRead as markAllReadApi,
  subscribeNotificationFeed,
  JAKARTA_FONTS,
  RECIPES_TYPOGRAPHY_ROUNDED,
  type NotificationViewModel,
} from '@mylife/bestchef';
import { LiveBadge, FilterChips, type FilterChipOption } from '@mylife/bestchef/ui';
import { useI18n } from './i18n/I18nProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { useAppThemeColors as useThemeColors } from './providers/AppThemeProvider';
import { NotificationRow } from './components/NotificationRow';

const HERO_COLOR = '#22C55E';
const BACKGROUND = '#131318';
const SURFACE_CARD = '#1B1B20';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE_ELEVATED = '#2A292F';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = 'rgba(214, 195, 181, 0.6)';

type NotificationCategory = 'votes' | 'ranks' | 'social' | 'system';
type CategoryFilter = 'all' | NotificationCategory;

const CATEGORY_IDS: CategoryFilter[] = ['all', 'votes', 'ranks', 'social', 'system'];

interface Section {
  label: string;
  items: NotificationViewModel[];
}

function buildSections(feed: NotificationViewModel[]): Section[] {
  const unread = feed.filter((n) => !n.isRead);
  const read = feed.filter((n) => n.isRead);
  const out: Section[] = [];
  if (unread.length > 0) out.push({ label: 'NEW', items: unread });
  if (read.length > 0) out.push({ label: 'EARLIER', items: read });
  return out;
}

function unreadCountForCategory(
  feed: NotificationViewModel[],
  cat: CategoryFilter,
): number {
  const filtered = cat === 'all' ? feed : feed.filter((n) => n.category === cat);
  return filtered.filter((n) => !n.isRead).length;
}

export default function NotificationsScreen() {
  const { t, tp } = useI18n();
  const { userId, supabase } = useBestChefCloud();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const [category, setCategory] = useState<CategoryFilter>('all');
  const [feed, setFeed] = useState<NotificationViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  // Derived feed filtered by category
  const filteredFeed =
    category === 'all' ? feed : feed.filter((n) => n.category === category);

  const totalUnread = feed.filter((n) => !n.isRead).length;
  const sections = buildSections(filteredFeed);

  // Category chip options with unread counts
  const chipOptions: FilterChipOption[] = CATEGORY_IDS.map((id) => {
    const count = unreadCountForCategory(feed, id);
    const label = id === 'all' ? t('All') : t(id.charAt(0).toUpperCase() + id.slice(1) as any);
    return {
      id,
      label: count > 0 ? `${label} ${count}` : label,
    };
  });

  const loadFeed = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const result = await getNotificationFeed(supabase, { userId, limit: 50 });
    if (result.ok) setFeed(result.data);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !userId) return;

    const unsub = subscribeNotificationFeed({
      supabase,
      userId,
      onInsert: (notif) => {
        setLiveConnected(true);
        setFeed((prev) => [notif, ...prev]);
      },
      onUpdate: (notif) => {
        setFeed((prev) =>
          prev.map((n) => (n.id === notif.id ? notif : n)),
        );
      },
      onDelete: (id) => {
        setFeed((prev) => prev.filter((n) => n.id !== id));
      },
    });

    setLiveConnected(true);
    unsubRef.current = unsub;

    return () => {
      setLiveConnected(false);
      unsub();
      unsubRef.current = null;
    };
  }, [supabase, userId]);

  function handleRead(id: string) {
    setFeed((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }

  function handleRemove(id: string) {
    setFeed((prev) => prev.filter((n) => n.id !== id));
  }

  async function handleMarkAllRead() {
    if (!userId || totalUnread === 0) return;
    await markAllReadApi(supabase, { userId });
    setFeed((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  // ── Headline text ──────────────────────────────────────────────────────
  const headlineText =
    totalUnread === 0
      ? t('All caught up')
      : totalUnread === 1
        ? t('1 new notification')
        : t('{count} new notifications', { count: totalUnread });

  const subtitleText =
    totalUnread === 0
      ? 'We\'ll ping you when something cooks up'
      : t('Tap to read, swipe to dismiss');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <Bell size={15} color={HERO_COLOR} strokeWidth={2.5} />
          <Text style={styles.toolbarTitle}>{t('Notifications')}</Text>
        </View>
        <View style={styles.toolbarRight}>
          <Pressable
            onPress={() => { void handleMarkAllRead(); }}
            disabled={totalUnread === 0}
            hitSlop={8}
          >
            <Text
              style={[
                styles.markAllText,
                totalUnread === 0 && { color: TEXT_SECONDARY },
              ]}
            >
              {t('Mark all read')}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <X size={18} color={TEXT_PRIMARY} />
          </Pressable>
        </View>
      </View>

      {/* ── Summary header card ──────────────────────────────────────── */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          {totalUnread > 0
            ? <Bell size={18} color={HERO_COLOR} strokeWidth={2.5} />
            : <BellOff size={18} color={HERO_COLOR} strokeWidth={2} />}
        </View>
        <View style={styles.summaryContent}>
          <View style={styles.summaryHeadlineRow}>
            <Text style={styles.summaryHeadline}>{headlineText}</Text>
            {liveConnected && (
              <LiveBadge label={t('LIVE')} color={HERO_COLOR} />
            )}
          </View>
          <Text style={styles.summarySubtitle}>{subtitleText}</Text>
        </View>
      </View>

      {/* ── Category pill bar ────────────────────────────────────────── */}
      <View style={styles.categoryBar}>
        <FilterChips
          options={chipOptions}
          selected={category}
          onChange={(id) => setCategory(id as CategoryFilter)}
        />
      </View>

      {/* ── List / Empty state ───────────────────────────────────────── */}
      {!loading && filteredFeed.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyCircle}>
            <BellOff size={36} color={HERO_COLOR} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t('Nothing here yet')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('New notifications in this category will show up here.')}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((section) => (
            <View key={section.label} style={styles.section}>
              <Text style={styles.sectionLabel}>{t(section.label as any)}</Text>
              <View style={[styles.sectionCard, { borderColor: GLASS_BORDER }]}>
                {section.items.map((notif, idx) => (
                  <View key={notif.id}>
                    <NotificationRow
                      notification={notif}
                      onRead={handleRead}
                      onRemove={handleRemove}
                    />
                    {idx < section.items.length - 1 && (
                      <View
                        style={[styles.divider, { marginLeft: 70 }]}
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    fontFamily: JAKARTA_FONTS.extraBold,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: HERO_COLOR,
    fontFamily: JAKARTA_FONTS.semiBold,
  },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${HERO_COLOR}2E`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContent: {
    flex: 1,
    gap: 2,
  },
  summaryHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryHeadline: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.fontSize,
    fontWeight: '700',
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.letterSpacing,
    color: TEXT_PRIMARY,
    fontFamily: JAKARTA_FONTS.bold,
  },
  summarySubtitle: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.fontSize,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.letterSpacing,
    color: TEXT_SECONDARY,
    fontFamily: JAKARTA_FONTS.medium,
  },

  // Category bar
  categoryBar: {
    paddingBottom: 10,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 4,
    gap: 16,
  },

  // Section
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: TEXT_SECONDARY,
    paddingHorizontal: 18,
    fontFamily: JAKARTA_FONTS.extraBold,
  },
  sectionCard: {
    marginHorizontal: 18,
    borderRadius: 12,
    backgroundColor: SURFACE_CARD,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS_BORDER,
    opacity: 0.4,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 30,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${HERO_COLOR}26`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.fontSize,
    fontWeight: '700',
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.letterSpacing,
    color: TEXT_PRIMARY,
    fontFamily: JAKARTA_FONTS.bold,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.letterSpacing,
    color: TEXT_SECONDARY,
    fontFamily: JAKARTA_FONTS.regular,
    textAlign: 'center',
  },
});
