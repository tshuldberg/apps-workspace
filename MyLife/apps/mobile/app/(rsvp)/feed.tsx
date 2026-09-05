import { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Card, Text, EmptyState, LoadingState, ErrorState, colors, spacing } from '@mylife/ui';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';
import { useFeed } from '../../hooks/rsvp/use-feed';

const ACCENT = colors.modules.rsvp;

type FeedFilter = 'all' | 'announcements' | 'comments' | 'photos';

interface FeedItem {
  id: string;
  type: 'announcement' | 'comment' | 'photo';
  author: string;
  message: string;
  timestamp: string;
  photoUrl?: string;
}

export default function FeedScreen() {
  const { selectedEventId, selectedEvent } = useRsvpContext();
  const {
    announcements, comments, photos, loading, error, refresh,
    postAnnouncement, postComment,
  } = useFeed(selectedEventId ?? undefined);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [commentText, setCommentText] = useState('');
  const [commentAuthor] = useState('Host');
  const [announcementText, setAnnouncementText] = useState('');
  const [showCompose, setShowCompose] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => requestAnimationFrame(r));
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    if (filter === 'all' || filter === 'announcements') {
      for (const a of announcements) {
        items.push({
          id: a.id,
          type: 'announcement',
          author: 'Host',
          message: a.message,
          timestamp: a.createdAt,
        });
      }
    }

    if (filter === 'all' || filter === 'comments') {
      for (const c of comments) {
        items.push({
          id: c.id,
          type: 'comment',
          author: c.guestName,
          message: c.message,
          timestamp: c.createdAt,
        });
      }
    }

    if (filter === 'all' || filter === 'photos') {
      for (const p of photos) {
        items.push({
          id: p.id,
          type: 'photo',
          author: p.guestName,
          message: p.caption ?? 'Shared a photo',
          timestamp: p.createdAt,
          photoUrl: p.photoUrl,
        });
      }
    }

    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return items;
  }, [announcements, comments, photos, filter]);

  if (!selectedEventId || !selectedEvent) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon={'\uD83D\uDCAC'}
          title="No event selected"
          message="Select an event from the Events tab to view the feed."
        />
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <LoadingState rows={4} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <ErrorState message="Error loading feed" onRetry={refresh} />
      </View>
    );
  }

  const handlePostComment = () => {
    const msg = commentText.trim();
    if (!msg) return;
    postComment({ guestName: commentAuthor.trim() || 'Guest', message: msg });
    setCommentText('');
  };

  const handlePostAnnouncement = () => {
    const msg = announcementText.trim();
    if (!msg) return;
    postAnnouncement(msg);
    setAnnouncementText('');
    setShowCompose(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
      }
    >
      <Text variant="caption" color={colors.textTertiary}>{selectedEvent.title}</Text>

      {/* Filter Row */}
      <View style={styles.filterRow}>
        {(['all', 'announcements', 'comments', 'photos'] as const).map((f) => {
          const active = filter === f;
          const label = f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1);
          return (
            <Pressable
              key={f}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text variant="caption" color={active ? colors.background : colors.textSecondary}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Compose Announcement */}
      <Pressable style={styles.composeToggle} onPress={() => setShowCompose(!showCompose)}>
        <Text variant="label" color={ACCENT}>
          {showCompose ? 'Cancel' : '+ Announcement'}
        </Text>
      </Pressable>

      {showCompose ? (
        <Card style={styles.composeCard}>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={announcementText}
            onChangeText={setAnnouncementText}
            placeholder="Write an announcement..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
          />
          <Pressable style={styles.sendButton} onPress={handlePostAnnouncement}>
            <Text variant="label" color={colors.background}>Send Announcement</Text>
          </Pressable>
        </Card>
      ) : null}

      {/* Quick Comment Box */}
      {selectedEvent.allowComments ? (
      <Card style={styles.commentBox}>
        <View style={styles.commentInputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment..."
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable style={styles.sendSmall} onPress={handlePostComment}>
            <Text variant="caption" color={colors.background}>Post</Text>
          </Pressable>
        </View>
      </Card>
      ) : (
        <Card style={styles.commentBox}>
          <Text variant="caption" color={colors.textTertiary}>Comments are disabled for this event.</Text>
        </Card>
      )}

      {/* Empty State */}
      {feedItems.length === 0 ? (
        <EmptyState
          icon={'\uD83D\uDCE2'}
          title="No activity yet"
          message="Post an announcement or comment to get started."
        />
      ) : null}

      {/* Feed Items */}
      {feedItems.map((item) => (
        <Card key={item.id} style={styles.feedCard}>
          <View style={styles.feedHeader}>
            <TypeIcon type={item.type} />
            <View style={styles.feedMeta}>
              <Text variant="body" style={{ fontWeight: '600' }}>{item.author}</Text>
              <Text variant="caption" color={colors.textTertiary}>
                {new Date(item.timestamp).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <TypeBadge type={item.type} />
          </View>
          <Text variant="body" color={colors.textSecondary}>{item.message}</Text>
          {item.photoUrl ? (
            <View style={styles.photoPlaceholder}>
              <Text variant="caption" color={colors.textTertiary}>
                {'\uD83D\uDCF7'} {item.photoUrl}
              </Text>
            </View>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}

function TypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    announcement: '\uD83D\uDCE2',
    comment: '\uD83D\uDCAC',
    photo: '\uD83D\uDCF7',
  };
  return <Text style={{ fontSize: 20 }}>{icons[type] ?? '\u2022'}</Text>;
}

function TypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    announcement: ACCENT,
    comment: colors.textTertiary,
    photo: colors.warning,
  };
  return (
    <View style={[styles.typeBadge, { borderColor: colorMap[type] ?? colors.border }]}>
      <Text variant="caption" color={colorMap[type] ?? colors.textSecondary}>{type}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  filterRow: { flexDirection: 'row', gap: spacing.xs },
  filterChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  filterChipActive: { borderColor: ACCENT, backgroundColor: ACCENT },
  composeToggle: { alignSelf: 'flex-end', paddingVertical: 4 },
  composeCard: { gap: spacing.sm },
  commentBox: { gap: spacing.xs },
  commentInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 15,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  sendButton: {
    borderRadius: 8,
    backgroundColor: ACCENT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  sendSmall: {
    borderRadius: 8,
    backgroundColor: ACCENT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  feedCard: { gap: spacing.xs },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedMeta: { flex: 1, gap: 1 },
  typeBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photoPlaceholder: {
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    marginTop: 4,
  },
});
