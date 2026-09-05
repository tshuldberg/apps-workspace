import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Trash2, Mail } from 'lucide-react-native';
import type { NotificationViewModel } from '@mylife/bestchef';
import { markNotificationRead, removeNotification } from '@mylife/bestchef';
import { JAKARTA_FONTS, RECIPES_TYPOGRAPHY_ROUNDED } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { relativeTimeParts } from '../utils/relative-time';
import { renderNotificationCopy } from '../i18n/notification-copy';

const HERO_COLOR = '#22C55E';
const SURFACE_CARD = '#1B1B20';
const READ_TINT = 'rgba(34, 197, 94, 0.045)';

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

interface NotificationRowProps {
  notification: NotificationViewModel;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
}

export function NotificationRow({ notification, onRead, onRemove }: NotificationRowProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const swipeRef = useRef<Swipeable>(null);
  const { t, formatRelativeTime, tp } = useI18n();
  const rel = relativeTimeParts(notification.createdAt);
  // Typed rows (kind+params) render in the app language; legacy rows fall
  // back to their stored copy (plan 33 Phase 2.1).
  const copy = renderNotificationCopy(notification, t, tp);

  function handleTap() {
    if (!notification.isRead) {
      void markNotificationRead(null, { id: notification.id });
      onRead(notification.id);
    }
    if (notification.targetRoute) {
      router.push(notification.targetRoute as Parameters<typeof router.push>[0]);
    }
    swipeRef.current?.close();
  }

  function handleDelete() {
    void removeNotification(null, { id: notification.id });
    onRemove(notification.id);
    swipeRef.current?.close();
  }

  function handleMarkRead() {
    void markNotificationRead(null, { id: notification.id });
    onRead(notification.id);
    swipeRef.current?.close();
  }

  function renderRightAction(
    progress: Animated.AnimatedInterpolation<number>,
  ) {
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
    return (
      <Animated.View style={[styles.swipeAction, styles.swipeRight, { transform: [{ scale }] }]}>
        <Pressable onPress={handleDelete} style={styles.swipeActionInner}>
          <Trash2 size={20} color="#fff" />
        </Pressable>
      </Animated.View>
    );
  }

  function renderLeftAction(
    progress: Animated.AnimatedInterpolation<number>,
  ) {
    if (notification.isRead) return null;
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
    return (
      <Animated.View style={[styles.swipeAction, styles.swipeLeft, { transform: [{ scale }] }]}>
        <Pressable onPress={handleMarkRead} style={styles.swipeActionInner}>
          <Mail size={20} color="#fff" />
        </Pressable>
      </Animated.View>
    );
  }

  const kindTint = kindTintColor(notification.kind);
  const kindIcon = kindIconChar(notification.kind);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightAction}
      renderLeftActions={notification.isRead ? undefined : renderLeftAction}
      rightThreshold={40}
      leftThreshold={40}
      overshootRight={false}
      overshootLeft={false}
    >
      <Pressable
        onPress={handleTap}
        style={[
          styles.row,
          !notification.isRead && { backgroundColor: READ_TINT },
        ]}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {notification.actorName ? (
            <>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: notification.actorColor ?? '#555' },
                ]}
              >
                <Text style={styles.avatarInitials}>
                  {initials(notification.actorName)}
                </Text>
              </View>
              {/* Kind icon overlay */}
              <View style={[styles.kindBadge, { backgroundColor: SURFACE_CARD }]}>
                <Text style={[styles.kindBadgeIcon, { color: kindTint }]}>
                  {kindIcon}
                </Text>
              </View>
            </>
          ) : (
            <View
              style={[
                styles.avatar,
                { backgroundColor: `${kindTint}28` },
              ]}
            >
              <Text style={[styles.kindIcon, { color: kindTint }]}>{kindIcon}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: colors.text },
                notification.isRead ? styles.titleRead : styles.titleUnread,
              ]}
              numberOfLines={2}
            >
              {copy.title}
            </Text>
            <Text style={[styles.timeAgo, { color: colors.textSecondary }]}>
              {rel.isNow ? t('now') : formatRelativeTime(rel.value, rel.unit)}
            </Text>
          </View>
          <Text
            style={[styles.body, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {copy.body}
          </Text>
        </View>

        {/* Unread dot */}
        {!notification.isRead && (
          <View style={[styles.unreadDot, { backgroundColor: HERO_COLOR }]} />
        )}
      </Pressable>
    </Swipeable>
  );
}

// ── Kind helpers ──────────────────────────────────────────────────────────────

function kindTintColor(kind: string): string {
  switch (kind) {
    case 'upvote': return '#22C55E';
    case 'reviewed_vote': return '#30D158';
    case 'rank_up':
    case 'rank_milestone': return '#C9894D';
    case 'follow':
    case 'mention': return '#8BCFF0';
    case 'comment': return '#9955CC';
    case 'badge': return '#F28C35';
    case 'competition': return '#22C55E';
    case 'moderation_decision': return '#FFB4AB';
    case 'appeal_resolved': return '#8BCFF0';
    case 'system':
    default: return '#9F8E81';
  }
}

function kindIconChar(kind: string): string {
  switch (kind) {
    case 'upvote': return '↑';
    case 'reviewed_vote': return '✓';
    case 'rank_up': return '↗';
    case 'rank_milestone': return '🏆';
    case 'follow': return '+';
    case 'comment': return '💬';
    case 'mention': return '@';
    case 'badge': return '★';
    case 'competition': return '🔥';
    case 'moderation_decision': return '⚑';
    case 'appeal_resolved': return '⚖';
    case 'system': return '✦';
    default: return '•';
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    includeFontPadding: false,
    textAlign: 'center',
    color: '#fff',
    fontFamily: JAKARTA_FONTS.bold,
  },
  kindIcon: {
    fontSize: 17,
    fontWeight: '700',
  },
  kindBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindBadgeIcon: {
    fontSize: 9,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcBody.fontSize,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcBody.letterSpacing,
    fontFamily: JAKARTA_FONTS.bold,
  },
  titleUnread: {
    fontFamily: JAKARTA_FONTS.bold,
  },
  titleRead: {
    fontFamily: JAKARTA_FONTS.semiBold,
  },
  timeAgo: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.fontSize,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.letterSpacing,
    fontFamily: JAKARTA_FONTS.medium,
    marginTop: 2,
  },
  body: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.letterSpacing,
    fontFamily: JAKARTA_FONTS.regular,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
  swipeAction: {
    justifyContent: 'center',
    marginVertical: 1,
    borderRadius: 0,
  },
  swipeRight: {
    backgroundColor: '#93000A',
  },
  swipeLeft: {
    backgroundColor: '#30D158',
  },
  swipeActionInner: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
});
