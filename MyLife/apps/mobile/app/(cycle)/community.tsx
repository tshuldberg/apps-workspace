import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  getCachedCommunityByModule,
  getCachedThreads,
  getCachedReplies,
  upsertCachedThread,
  type DatabaseAdapter as ForumsDb,
  type Thread,
} from '@mylife/forums';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import type { DatabaseAdapter } from '@mylife/db';

const accentColor = colors.modules.cycle;
const MODULE_ID = 'cycle';

/** Wrap the hub DatabaseAdapter to match the forums module's expected interface. */
function toForumsDb(db: DatabaseAdapter): ForumsDb {
  return {
    run: (sql: string, params?: unknown[]) => db.execute(sql, params),
    get: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params)[0] as T | undefined,
    all: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params),
  };
}

type SortMode = 'new' | 'top';

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function CycleCommunityScreen() {
  const hubDb = useDatabase();
  const fdb = useMemo(() => toForumsDb(hubDb), [hubDb]);
  const [sort, setSort] = useState<SortMode>('new');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const community = useMemo(() => getCachedCommunityByModule(fdb, MODULE_ID), [fdb]);

  const threads = useMemo(
    () =>
      community
        ? getCachedThreads(fdb, community.id, { sort, limit: 50 })
        : [],
    [fdb, community, sort],
  );

  const replies = useMemo(
    () =>
      selectedThread
        ? getCachedReplies(fdb, selectedThread.id, { limit: 50 })
        : [],
    [fdb, selectedThread],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // In production, this would fetch from Supabase and update cache.
    // For now, just re-read from cache.
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleCreateThread = useCallback(() => {
    if (!community) return;
    const title = newTitle.trim();
    const body = newBody.trim();
    if (title.length < 3) {
      Alert.alert('Title required', 'Title must be at least 3 characters.');
      return;
    }
    if (!body) {
      Alert.alert('Body required', 'Please write something for your post.');
      return;
    }
    // In production, this calls cloudCreateThread then upserts cache.
    // For offline-first preview, create a local-only cached thread.
    const now = new Date().toISOString();
    const thread: Thread = {
      id: `local-${Date.now()}`,
      communityId: community.id,
      authorId: 'local-user',
      title,
      body,
      status: 'open',
      isPinned: false,
      voteScore: 0,
      replyCount: 0,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    upsertCachedThread(fdb, thread);
    setNewTitle('');
    setNewBody('');
    setShowCreateForm(false);
  }, [fdb, community, newTitle, newBody]);

  if (!community) {
    return (
      <View style={styles.centeredScreen}>
        <Text variant="subheading" color={colors.textSecondary}>
          Enable MyForums to join the MyCycle community
        </Text>
        <Text variant="caption" color={colors.textTertiary} style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          The community feature requires the MyForums module. Enable it from the hub dashboard to browse discussions, ask questions, and connect with other cycle trackers.
        </Text>
      </View>
    );
  }

  if (selectedThread) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={() => setSelectedThread(null)} style={styles.backButton}>
          <Text variant="caption" color={accentColor}>Back to threads</Text>
        </Pressable>

        <Card style={styles.threadDetail}>
          <Text variant="subheading">{selectedThread.title}</Text>
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
            {formatRelativeTime(selectedThread.createdAt)} · {selectedThread.voteScore} votes
          </Text>
          <Text variant="body" style={{ marginTop: spacing.sm }}>
            {selectedThread.body}
          </Text>
        </Card>

        <Text variant="subheading" style={{ marginTop: spacing.md }}>
          Replies ({selectedThread.replyCount})
        </Text>

        {replies.length === 0 ? (
          <Text variant="body" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
            No replies yet. Be the first to respond.
          </Text>
        ) : (
          replies.map((reply) => (
            <Card key={reply.id} style={[styles.replyCard, { marginLeft: reply.depth * 16 }]}>
              <Text variant="body">{reply.body}</Text>
              <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                {formatRelativeTime(reply.createdAt)} · {reply.voteScore} votes
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />
      }
    >
      <View style={styles.header}>
        <Text variant="heading" style={{ color: accentColor }}>Community</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {community.displayName} · {community.memberCount} members
        </Text>
      </View>

      <View style={styles.sortRow}>
        <Pressable
          style={[styles.sortPill, sort === 'new' && styles.sortPillActive]}
          onPress={() => setSort('new')}
        >
          <Text variant="caption" color={sort === 'new' ? colors.text : colors.textSecondary}>
            Recent
          </Text>
        </Pressable>
        <Pressable
          style={[styles.sortPill, sort === 'top' && styles.sortPillActive]}
          onPress={() => setSort('top')}
        >
          <Text variant="caption" color={sort === 'top' ? colors.text : colors.textSecondary}>
            Top
          </Text>
        </Pressable>
      </View>

      {showCreateForm ? (
        <Card style={styles.createForm}>
          <Text variant="subheading">New Thread</Text>
          <TextInput
            style={styles.input}
            placeholder="Title (3-300 characters)"
            placeholderTextColor={colors.textTertiary}
            value={newTitle}
            onChangeText={setNewTitle}
            maxLength={300}
          />
          <TextInput
            style={[styles.input, styles.bodyInput]}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.textTertiary}
            value={newBody}
            onChangeText={setNewBody}
            multiline
            maxLength={40000}
          />
          <View style={styles.formActions}>
            <Pressable style={styles.cancelButton} onPress={() => setShowCreateForm(false)}>
              <Text variant="caption" color={colors.textSecondary}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.postButton, { backgroundColor: accentColor }]} onPress={handleCreateThread}>
              <Text variant="caption" color={colors.text}>Post</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <Pressable
          style={[styles.createButton, { backgroundColor: accentColor }]}
          onPress={() => setShowCreateForm(true)}
        >
          <Text variant="caption" color={colors.text}>New Thread</Text>
        </Pressable>
      )}

      {threads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="subheading" color={colors.textSecondary}>
            Start a conversation
          </Text>
          <Text variant="body" color={colors.textTertiary} style={{ textAlign: 'center', marginTop: spacing.xs }}>
            Ask questions, share experiences, and connect with other cycle trackers.
          </Text>
        </View>
      ) : (
        threads.map((thread) => (
          <Pressable key={thread.id} onPress={() => setSelectedThread(thread)}>
            <Card style={styles.threadCard}>
              <Text variant="subheading" numberOfLines={2}>{thread.title}</Text>
              <Text variant="body" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: spacing.xs }}>
                {thread.body}
              </Text>
              <View style={styles.threadMeta}>
                <Text variant="caption" color={colors.textTertiary}>
                  {thread.voteScore} votes · {thread.replyCount} replies · {formatRelativeTime(thread.createdAt)}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  centeredScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  header: { gap: spacing.xs },
  sortRow: { flexDirection: 'row', gap: spacing.xs },
  sortPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.glass,
    minHeight: 44,
    justifyContent: 'center',
  },
  sortPillActive: { backgroundColor: accentColor },
  threadCard: { gap: spacing.xs },
  threadMeta: { marginTop: spacing.xs },
  createButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  createForm: { gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  bodyInput: { minHeight: 100, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  cancelButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  postButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, minHeight: 44, justifyContent: 'center' },
  emptyState: { paddingVertical: spacing.xxl, alignItems: 'center' },
  backButton: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  threadDetail: { gap: spacing.xs },
  replyCard: { marginTop: spacing.xs },
});
